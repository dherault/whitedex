/* eslint-disable import/no-unresolved */
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const Dexters = require('dexters')

const serviceAccount = require('../service-key.json')

const blockchainId = 1666600000

async function main() {
  initializeApp({
    credential: cert(serviceAccount),
  })

  const db = getFirestore()

  const dexters = new Dexters(blockchainId)

  const dexIds = dexters.getDexIds()

  const dexIdToPairs = {}

  for (const dexId of dexIds) {
    dexIdToPairs[dexId] = await dexters.getDex(dexId).getPairs()

    for (const [pairAddress, tokenAddresses] of Object.entries(dexIdToPairs[dexId])) {
      const docRef = db.collection('pairs').doc(pairAddress)
      const now = new Date().toISOString()

      await docRef.set({
        blockchainId,
        dexId,
        tokenAddresses,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

}

main()
