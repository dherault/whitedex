// A simple swap example
require('dotenv').config()
const { ethers } = require('ethers')
const Dexters = require('dexters')
const BigNumber = require('bignumber.js')

const wone = '0xcf664087a5bb0237a0bad6742852ec6c8d69a27a'
const sushi = '0xbec775cb42abfa4288de81f387a9b1a3c4bc552a'

const publicKey = process.env.PUBLIC_KEY
const privateKey = process.env.PRIVATE_KEY

const dexters = new Dexters(1666600000)
const dex = dexters.getDex('sushiswap')

const signer = new ethers.Wallet(privateKey, dexters.provider)

let nonce = 0
const noncePromise = dexters.provider.getTransactionCount(signer.getAddress()).then(x => nonce = x)

async function getNonce() {
  return noncePromise.then(() => nonce++)
}

async function main() {
  console.log('publicKey', publicKey)

  let balance0 = new BigNumber((await dex.getTokenContract(wone).balanceOf(publicKey)).toString())
  let balance1 = new BigNumber((await dex.getTokenContract(sushi).balanceOf(publicKey)).toString())

  console.log('balance0', balance0.toString())
  console.log('balance1', balance1.toString())

  const routerContract = dex.getRouterContract().connect(signer)
  const sellAmount = balance0.times(0.1).integerValue(BigNumber.ROUND_UP)

  console.log('swaping', sellAmount.toString())

  const tx = await routerContract.swapExactTokensForTokens(
    ethers.BigNumber.from(sellAmount.toString()),
    0,
    [wone, sushi],
    process.env.PUBLIC_KEY,
    Math.floor(Date.now() / 1000) + 3600,
    {
      gasLimit: 20000000,
      gasPrice: 100000000000,
      nonce: getNonce(),
    },
  )

  console.log('waiting')

  await tx.wait()

  console.log('done')

  balance0 = new BigNumber((await dex.getTokenContract(wone).balanceOf(publicKey)).toString())
  balance1 = new BigNumber((await dex.getTokenContract(sushi).balanceOf(publicKey)).toString())

  console.log('balance0', balance0.toString())
  console.log('balance1', balance1.toString())
}

main()
// .then(main)
// .then(main)
