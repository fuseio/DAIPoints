require('dotenv').config()
const axios = require('axios')
const logger = require('../services/logger')

const {
  API_URL,
  API_JWT_TOKEN
} = process.env

const authorization = { headers: { Authorization: API_JWT_TOKEN } }

const getWalletsByPhoneNumber = async (phoneNumber) => {
  logger.debug(`getWalletByPhoneNumber: ${phoneNumber}`)
  const { data } = await axios.get(`${API_URL}/wallets/all/${phoneNumber}`, authorization)
  // logger.debug(`data: ${JSON.stringify(data)}`)
  return data.data && data.data.map(d => d.walletAddress)
}

const getWalletByAddress = async (address) => {
  logger.debug(`getWalletByAddress: ${address}`)
  const { data } = await axios.get(`${API_URL}/wallets/address/${address}`, authorization)
  // logger.debug(`data: ${JSON.stringify(data)}`)
  return data && data.data
}

module.exports = {
  getWalletsByPhoneNumber,
  getWalletByAddress
}
