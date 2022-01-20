const BigNumber = require('bignumber.js')

const configuration = {
  swapRatio: 0.5, // Swap 50% of the current balance
  blockchains: {
    1666600000: {
      portfolioPopulationMinimumEthAmount: BigNumber('1e+18'), // 1 ONE
      minimumTradeWaitingTime: 1000 * 30, // 30 seconds minimum wait between trades
    },
    // 137: {
    //   portfolioPopulationMinimumEthAmount: BigNumber('0.1e+18'), // 1 MATIC
    //   minimumTradeWaitingTime: 1000 * 30, // 30 seconds minimum wait between trades
    // },
  },
  shouldPopulatePortfolio: false,
  portfolioPopulationBatchSize: 1,
  stablecoins: [
    '1USDC',
    'BUSD',
    '1USDT',
    'bscBUSD',
    '1DAI',
    'UST',
    'bscUSDC',
    'bscUSDT',
    'bscDAI',
  ],
}

module.exports = configuration
