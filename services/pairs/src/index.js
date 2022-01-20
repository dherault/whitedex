/* eslint-disable import/no-unresolved */
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const Dexters = require('dexters')

const serviceAccount = require('../service-key.json')

async function main() {
  initializeApp({
    credential: cert(serviceAccount),
  })

  const db = getFirestore()

  const dexters = new Dexters(1666600000)

  const dexIds = dexters.getDexIds()

  const dexIdToPairs = {}

  for (const dexId of dexIds) {
    dexIdToPairs[dexId] = await dexters.getDex(dexId).getPairs()
  }

  // const docRef = db.collection('pairs').doc('0x0')

  // const now = new Date().toISOString()

  // await docRef.set({
  //   createdAt: now,
  //   updatedAt: now,
  // })
}

main()
