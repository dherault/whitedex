const { ethers } = require('ethers')
const BigNumber = require('bignumber.js')

const configuration = require('../configuration')

const { unhashPair } = require('../utils/hashPair')

class Portfolio {

  constructor(dexters, pairHashToMetadata) {
    if (!process.env.PRIVATE_KEY) {
      throw new Error('No PRIVATE_KEY environment variable found')
    }

    this.dexters = dexters
    this.pairHashToMetadata = pairHashToMetadata
    this.tokenAddressToMetadata = this._extractTokens(pairHashToMetadata)

    this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.dexters.provider)
  }

  // Return the total Eth value of the portfolio
  async getTotalValue() {
    if (!process.env.PUBLIC_KEY) {
      throw new Error('PUBLIC_KEY environment variable is not set')
    }

    let sum = new BigNumber(0)
    const entries = Object.entries(this.tokenAddressToMetadata)

    console.log('About to compute portfolio total value for', entries.length, 'tokens')

    for (const [tokenAddress, { dexIds: [dexId], symbol }] of entries) {
      console.log('___')
      console.log(symbol, dexId)
      const balanceEth = await this._getBalanceEth(dexId, tokenAddress, symbol)

      if (balanceEth === null) continue

      sum = sum.plus(balanceEth)

      console.log('balance', balanceEth.toString())
    }

    return sum
  }

  // Make sure every token has a minimum balance defined in the configuration
  async populate() {
    if (!process.env.PUBLIC_KEY) {
      throw new Error('PUBLIC_KEY environment variable is not set')
    }

    const entries = Object.entries(this.tokenAddressToMetadata)

    console.log('About to populate portfolio for', entries.length, 'tokens')

    const batches = [[]]

    entries
    .sort(() => Math.random() > 0.5 ? 1 : -1) // We suffle th tokens for dev purposes: the buying goes faster
    .forEach(entry => {
      const count = batches[batches.length - 1].push(entry)

      if (count >= configuration.portfolioPopulationBatchSize) {
        batches.push([])
      }
    })

    for (const entries of batches) {
      console.log('Batching', entries.length, 'tokens')

      const promises = []

      for (const [tokenAddress, { dexIds: [dexId], symbol }] of entries) {
        promises.push(this._populateToken(dexId, tokenAddress, symbol))
      }

      await Promise.all(promises)
    }
  }

  // Buy a token in Eth
  async buy(dexId, tokenAddress, amountEth) {
    const { symbol } = this.tokenAddressToMetadata[tokenAddress]

    console.log(`[Abex|${this.dexters.chainId}|${dexId}] Buying ${symbol}: ${amountEth.toString()}`)

    const { wrappedNativeTokenAddress } = this.dexters.chainMetadata
    const routerContract = this.dexters.getDex(dexId).getRouterContract().connect(this.signer)

    try {
      const tx = await routerContract.swapExactETHForTokens(
        0,
        [wrappedNativeTokenAddress, tokenAddress],
        process.env.PUBLIC_KEY,
        Math.floor(Date.now() / 1000) + 3600,
        { value: ethers.BigNumber.from(amountEth.toString()) },
      )

      await tx.wait()
    }
    catch (error) {
      console.log(`[Abex|${this.dexters.chainId}|${dexId}] Error buying ${symbol}`)
    }
  }

  // Swap two tokens
  async swap(dexId, sellTokenAddress, buyTokenAddress) {
    const { symbol: sellSymbol } = this.tokenAddressToMetadata[sellTokenAddress]
    const { symbol: buySymbol } = this.tokenAddressToMetadata[buyTokenAddress]

    const sellBalance = await this._getBalance(dexId, sellTokenAddress)

    if (sellBalance.isZero()) {
      console.log(`[Abex|${this.dexters.chainId}|${dexId}] Cannot swap ${sellSymbol} for ${buySymbol}: balance is 0`)

      return
    }

    const sellAmount = sellBalance.times(configuration.swapRatio).integerValue(BigNumber.ROUND_UP)

    console.log(`[Abex|${this.dexters.chainId}|${dexId}] Swaping ${sellSymbol} for ${buySymbol}: ${sellAmount.toString()}`)

    const routerContract = this.dexters.getDex(dexId).getRouterContract().connect(this.signer)

    try {
      const tx = await routerContract.swapExactTokensForTokens(
        ethers.BigNumber.from(sellAmount.toString()),
        0,
        [sellTokenAddress, buyTokenAddress],
        process.env.PUBLIC_KEY,
        Math.floor(Date.now() / 1000) + 3600,
        {
          gasLimit: 20000000,
          gasPrice: 100000000000,
        }
      )

      await tx.wait()

      console.log(`[Abex|${this.dexters.chainId}|${dexId}] /!\\ Swap successfull ${sellSymbol} for ${buySymbol}`)
    }
    catch (error) {
      console.log(`[Abex|${this.dexters.chainId}|${dexId}] Error swaping ${sellSymbol} for ${buySymbol}`)
      console.log(error)
    }
  }

  // Populate a token with portfolioPopulationMinimumEthAmount from configuration
  async _populateToken(dexId, tokenAddress, symbol) {
    const balanceEth = await this._getBalanceEth(dexId, tokenAddress, symbol)

    if (balanceEth === null) return

    const { portfolioPopulationMinimumEthAmount } = configuration.blockchains[this.dexters.chainId]
    const remainingToBuy = portfolioPopulationMinimumEthAmount.minus(balanceEth)

    if (remainingToBuy.isLessThanOrEqualTo(0)) return

    try {
      await this.buy(dexId, tokenAddress, remainingToBuy.integerValue(BigNumber.ROUND_UP))
    }
    catch (error) {
      console.log(`[Abex|${this.dexters.chainId}|${dexId}] Error populating ${symbol}`)
    }
  }

  // Get the balance of a token
  async _getBalance(dexId, tokenAddress) {
    const dex = this.dexters.getDex(dexId)

    try {
      const balance = await dex.getTokenContract(tokenAddress).balanceOf(process.env.PUBLIC_KEY)

      return new BigNumber(balance.toString())
    }
    catch (error) {
      return null
    }
  }

  // Get the balance of a token in Eth
  async _getBalanceEth(dexId, tokenAddress, symbol) {
    const balance = await this._getBalance(dexId, tokenAddress)

    if (balance === null) return null

    let price
    const dex = this.dexters.getDex(dexId)
    const { wrappedNativeTokenAddress } = this.dexters.chainMetadata

    if (tokenAddress === wrappedNativeTokenAddress) {
      price = new BigNumber(1)
    }
    else {
      try {
        ({ [tokenAddress]: price } = await dex.getCurrentRelativePrices(wrappedNativeTokenAddress, tokenAddress))
      }
      catch (error) {
        //
      }
    }

    if (!price || price.isEqualTo(0)) {
      console.log(`[Abex|${this.dexters.chainId}|${dexId}] Price for ${symbol} is 0 or unkown`)

      return null
    }

    return balance.div(price)
  }

  // Extract tokens from the common data structure
  _extractTokens(pairHashToMetadata) {
    const tokenAddressToMetadata = {}

    Object.entries(pairHashToMetadata).forEach(([hash, { symbols }]) => {
      const [tokenAddress0, tokenAddress1] = unhashPair(hash)

      if (!tokenAddressToMetadata[tokenAddress0]) {
        tokenAddressToMetadata[tokenAddress0] = { dexIds: [], pairHashes: [], symbol: symbols[0] }
      }

      if (!tokenAddressToMetadata[tokenAddress1]) {
        tokenAddressToMetadata[tokenAddress1] = { dexIds: [], pairHashes: [], symbol: symbols[1] }
      }

      pairHashToMetadata[hash].dexIds.forEach(dexId => {
        if (!tokenAddressToMetadata[tokenAddress0].dexIds.includes(dexId)) {
          tokenAddressToMetadata[tokenAddress0].dexIds.push(dexId)
        }

        if (!tokenAddressToMetadata[tokenAddress1].dexIds.includes(dexId)) {
          tokenAddressToMetadata[tokenAddress1].dexIds.push(dexId)
        }
      })

      tokenAddressToMetadata[tokenAddress0].pairHashes.push(hash)
      tokenAddressToMetadata[tokenAddress1].pairHashes.push(hash)
    })

    return tokenAddressToMetadata
  }

}

module.exports = Portfolio
