/* eslint-disable import/no-unresolved */
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const Dexters = require('dexters')
const chalk = require('chalk')

const serviceAccount = require('../service-key.json')

const formatAddress = require('./utils/formatAddress')
const { hashPair } = require('./utils/hashPair')

const blockchainId = 1666600000

async function main() {
  const log = (...args) => console.log(chalk.green(`[Pairs|${blockchainId}]`), ...args)
  const logDex = dexId => (...args) => console.log(chalk.green(`[Pairs|${blockchainId}|${dexId}]`), ...args)

  log('Initializing pairs service')

  initializeApp({
    credential: cert(serviceAccount),
  })

  const db = getFirestore()

  const dexters = new Dexters(blockchainId)

  const dexIdToPairs = {}

  for (const dexId of dexters.getDexIds()) {
    const dex = dexters.getDex(dexId)

    logDex(dexId)('Initializing pairs')

    dexIdToPairs[dexId] = await dex.getPairs()

    logDex(dexId)('Saving pairs to db')

    for (const [pairAddress, tokenAddresses] of Object.entries(dexIdToPairs[dexId])) {
      const id = formatAddress(pairAddress)

      const docRef = db.collection('pairs').doc(id)

      await docRef.set({
        id,
        blockchainId,
        dexId,
        tokenAddresses: tokenAddresses.map(formatAddress),
        type: dex.type,
      })
    }
  }

  log('Computing cross pairs')

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

  log('Collecting pairs metadata')

  const pairHashToMetadata = {}

  for (const [dexId, pairs] of Object.entries(dexIdToCrossPairs)) {
    for (const [pairAddress, [tokenAddress0, tokenAddress1]] of Object.entries(pairs)) {
      const pairId = formatAddress(pairAddress)
      const tokenId0 = formatAddress(tokenAddress0)
      const tokenId1 = formatAddress(tokenAddress1)
      const hash = hashPair(tokenId0, tokenAddress1)
      const tokenAddresses = [tokenId0, tokenId1].sort((a, b) => a < b ? -1 : 1)

      logDex(dexId)(`Resolving metadata for ${tokenAddresses[0]} and ${tokenAddresses[1]}`)

      if (!pairHashToMetadata[hash]) {
        pairHashToMetadata[hash] = {
          blockchainId,
          id: hash,
          tokenAddresses,
          pairAddresses: [],
          dexIds: [],
          names: [],
          symbols: [],
          decimals: [],
        }
      }

      pairHashToMetadata[hash].dexIds.push(dexId)
      pairHashToMetadata[hash].pairAddresses.push(pairId)

      if (!pairHashToMetadata[hash].names.length) {
        pairHashToMetadata[hash].names = await Promise.all(tokenAddresses.map(dexters.getERC20TokenName))
      }
      if (!pairHashToMetadata[hash].symbols.length) {
        pairHashToMetadata[hash].symbols = await Promise.all(tokenAddresses.map(dexters.getERC20TokenSymbol))
      }
      if (!pairHashToMetadata[hash].decimals.length) {
        pairHashToMetadata[hash].decimals = await Promise.all(tokenAddresses.map(dexters.getERC20TokenDecimals))
      }
    }
  }

  log('Saving pairs metadata')

  for (const [hash, metadata] of Object.entries(pairHashToMetadata)) {
    await db.collection('cross-pairs').doc(hash).set(metadata)
  }

  log('Listening for new pairs')
}

main()
