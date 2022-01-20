require('dotenv').config()
const Dexters = require('dexters')

const configuration = require('./configuration')
const Portfolio = require('./models/Portfolio')
const Trader = require('./models/Trader')

const cache = require('./utils/cache')
const { hashPair, unhashPair } = require('./utils/hashPair')

function main() {
  // For each blockchain, initialize trade
  Object.keys(configuration.blockchains).forEach(initializeTrade)
}

async function initializeTrade(chainId) {
  // Dexters is a middleware to the blockchain
  const dexters = new Dexters(chainId)

  // Get all cross pairs between dexes
  const pairHashToMetadata = await cache(
    async () => filterPairs(await aggregateAndNamePairs(dexters, await getCrossPairs(dexters))),
    `${chainId}-pairs`,
  )

  // Will provide methods to compute balances for each token
  const portfolio = new Portfolio(dexters, pairHashToMetadata)

  // Make sure every token has a positive balance in the portfolio
  if (configuration.shouldPopulatePortfolio) {
    await portfolio.populate()
  }

  console.log('Starting trade')

  // Start trading
  Object.entries(pairHashToMetadata).forEach(([hash, { dexIds, symbols }]) => {
    const [tokenAddress0, tokenAddress1] = unhashPair(hash)

    // A trader function has the responsbility to determine wether to trade or not
    // Based on a trading strategy
    const trader = new Trader(dexters, portfolio, tokenAddress0, tokenAddress1, symbols[0], symbols[1])

    // Trade on price updates
    dexIds.forEach(dexId => dexters.getDex(dexId).addSyncListener(tokenAddress0, tokenAddress1, data => trader.evalutate(dexId, data)))
  })
}

// Get all pairs from dexes
// Then keep only those that have 2 or more dexes
async function getCrossPairs(dexters) {
  const dexIds = dexters.getDexIds()

  const dexIdToPairs = {}

  for (const dexId of dexIds) {
    dexIdToPairs[dexId] = await dexters.getDex(dexId).getPairs()
  }

  const dexIdToCrossPairs = {}

  const entries = Object.entries(dexIdToPairs)

  entries.forEach(([dexId0, pairs0], i) => {
    const pairEntries0 = Object.entries(pairs0)

    entries.forEach(([dexId1, pairs1], j) => {
      if (i >= j) return

      const pairEntries1 = Object.entries(pairs1)

      pairEntries0.forEach(([pair0, [tokenAddress00, tokenAddress01]]) => {
        pairEntries1.forEach(([pair1, [tokenAddress10, tokenAddress11]]) => {
          if (!((tokenAddress00 === tokenAddress10 && tokenAddress01 === tokenAddress11) || (tokenAddress00 === tokenAddress11 && tokenAddress01 === tokenAddress10))) return
          if (!dexIdToCrossPairs[dexId0]) dexIdToCrossPairs[dexId0] = {}
          if (!dexIdToCrossPairs[dexId1]) dexIdToCrossPairs[dexId1] = {}

          dexIdToCrossPairs[dexId0][pair0] = [tokenAddress00, tokenAddress01]
          dexIdToCrossPairs[dexId1][pair1] = [tokenAddress10, tokenAddress11]
        })
      })
    })
  })

  return dexIdToCrossPairs
}

// Give a data structure to pairs
// Get the symbols of tokens
async function aggregateAndNamePairs(dexters, dexIdToPairs) {
  const pairHashToMetadata = {}

  for (const [dexId, pairs] of Object.entries(dexIdToPairs)) {
    for (const [tokenAddress0, tokenAddress1] of Object.values(pairs)) {
      const hash = hashPair(tokenAddress0, tokenAddress1)

      if (!pairHashToMetadata[hash]) pairHashToMetadata[hash] = { dexIds: [], symbols: [] }

      pairHashToMetadata[hash].dexIds.push(dexId)
      pairHashToMetadata[hash].symbols = await Promise.all(
        [tokenAddress0, tokenAddress1].sort((a, b) => a < b ? -1 : 1).map(token => dexters.getDex(dexId).getERC20TokenSymbol(token))
      )

      console.log(`[Abex|${dexters.chainId}|${dexId}] Resolving symbol for ${tokenAddress0} and ${tokenAddress1}`)
    }
  }

  return pairHashToMetadata
}

// Filter out pairs that are stablecoins
function filterPairs(pairHashToMetadata) {
  const filteredPairHashToMetadata = {}

  Object.entries(pairHashToMetadata).forEach(([hash, { dexIds, symbols }]) => {
    if (symbols.some(symbol => configuration.stablecoins.includes(symbol))) return

    filteredPairHashToMetadata[hash] = { dexIds, symbols }
  })

  return filteredPairHashToMetadata
}

main()
