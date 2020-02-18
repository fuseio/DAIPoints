require('dotenv').config()
const axios = require('axios')
const logger = require('../services/logger')

const {
  API_URL,
  API_JWT_TOKEN
} = process.env

const authorization = { headers: { Authorization: API_JWT_TOKEN } }

const getWalletsByPhoneNumber = async (phoneNumber) => {
  logger.trace(`getWalletByPhoneNumber: ${phoneNumber}`)
  const { data } = await axios.get(`${API_URL}/wallets/all/${phoneNumber}`, authorization)
  return data.data && data.data.map(d => d.walletAddress)
}

const isExistWalletByAddress = async (address) => {
  logger.trace(`isExistWalletByAddress: ${address}`)
  const { data } = await axios.get(`${API_URL}/wallets/exists/${address}`, authorization)
  return { address, exists: data && data.data }
}

module.exports = {
  getWalletsByPhoneNumber,
  isExistWalletByAddress
}
