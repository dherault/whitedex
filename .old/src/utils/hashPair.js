const hashSeparator = '-'

// ("0x1", "0x2") -> "0x1-0x2"
function hashPair(address0, address1) {
  return address0 < address1 ? `${address0}${hashSeparator}${address1}` : `${address1}${hashSeparator}${address0}`
}

// "0x1-0x2" -> ("0x1", "0x2")
function unhashPair(hash) {
  return hash.split(hashSeparator)
}

module.exports = {
  hashPair,
  unhashPair,
}
