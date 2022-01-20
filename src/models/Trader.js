const configuration = require('./configuration')

class Trader {

  constructor(dexters, portfolio, tokenAddress0, tokenAddress1, symbol0, symbol1) {
    this.dexters = dexters
    this.portfolio = portfolio
    this.tokenAddress0 = tokenAddress0
    this.tokenAddress1 = tokenAddress1
    this.symbol0 = symbol0
    this.symbol1 = symbol1

    // Will hold the prices for each dex over time
    this.dexIdToTradeData = {}
    // Will help determine if a trade happens long enough afters the previous one
    this.previousTradeTimestamp = 0
    this.minimumTradeWaitingTime = configuration.blockchains[dexters.chainId].minimumTradeWaitingTime
  }

  // Evaluate a trade on price updates
  async evalutate(dexId, tradeData) {
    console.log('Price Update', dexId, this.symbol0, this.symbol1)

    this.dexIdToTradeData[dexId] = tradeData

    // If the previous trade happened too soon, no trade
    if (this.previousTradeTimestamp + this.minimumTradeWaitingTime > Date.now()) return

    const entries = Object.entries(this.dexIdToTradeData)

    for (let i = 0; i < entries.length; i++) {
      const [dexId0, { [this.tokenAddress0]: { price: price00 }, [this.tokenAddress1]: { price: price01 } }] = entries[i]

      for (let j = i + 1; j < entries.length; j++) {
        const [dexId1, { [this.tokenAddress0]: { price: price10 }, [this.tokenAddress1]: { price: price11 } }] = entries[j]

        // If prices are identical on both dexes, no trade
        if (price00 === price10 && price01 === price11) continue

        const r0 = price00.div(price01)
        const r1 = price10.div(price11)

        // If slippage is null, no trade
        if (r0.isEqualTo(r1)) continue

        console.log(`[Abex|${this.dexters.chainId}] Considering a trade between`, dexId0, dexId1, this.symbol0, this.symbol1, price00.toString(), price01.toString(), price10.toString(), price11.toString())

        this.previousTradeTimestamp = Date.now()

        // ! Unsure about this
        if (r0.isGreaterThan(r1)) {
          await this._doubleSwap(dexId0, dexId1)
        }
        else {
          await this._doubleSwap(dexId1, dexId0)
        }
      }
    }
  }

  async _doubleSwap(buyDexId, sellDexId) {
    return Promise.all([
      this.portfolio.swap(buyDexId, this.tokenAddress0, this.tokenAddress1),
      this.portfolio.swap(sellDexId, this.tokenAddress1, this.tokenAddress0),
    ])
  }

}

module.exports = Trader
