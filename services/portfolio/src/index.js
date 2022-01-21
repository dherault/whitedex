/* eslint-disable import/no-unresolved */
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
// const Dexters = require('dexters')
const chalk = require('chalk')

const serviceAccount = require('../service-key.json')

// const formatAddress = require('./utils/formatAddress')
// const { hashPair } = require('./utils/hashPair')

const blockchainId = 1666600000
// const blockchainId = 137

async function main() {
  const log = (...args) => console.log(chalk.green(`[Portfolio|${blockchainId}]`), ...args)

  log('Initializing portfolio service')

  initializeApp({
    credential: cert(serviceAccount),
  })

  const db = getFirestore()

  log('Fetching cross-pairs')

  const crossPairsSnapshot = await db.collection('cross-pairs').where('blockchainId', '==', blockchainId).get()

  if (crossPairsSnapshot.empty) {
    log('No cross-pairs found.')

    process.exit(0)
  }

  const tokenAddresses = new Set()

  crossPairsSnapshot.forEach(doc => {
    const [tokenAddress0, tokenAddress1] = doc.data().tokenAddresses

    tokenAddresses.add(tokenAddress0)
    tokenAddresses.add(tokenAddress1)
  })

  log('Working with', tokenAddresses.size, 'tokens')
}

main()
