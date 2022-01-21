/* eslint-disable import/no-unresolved */
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const Dexters = require('dexters')
const chalk = require('chalk')

const serviceAccount = require('../service-key.json')

const formatAddress = require('./utils/formatAddress')

const blockchainId = 1666600000
// const blockchainId = 137

async function main() {
  const log = (...args) => console.log(chalk.green(`[Pairs|${blockchainId}]`), ...args)
  const logDex = (dexId, ...args) => console.log(chalk.green(`[Pairs|${blockchainId}|${dexId}]`), ...args)

  log('Initializing pairs service')

  initializeApp({
    credential: cert(serviceAccount),
  })

  const db = getFirestore()

  const dexters = new Dexters(blockchainId)

}

main()
