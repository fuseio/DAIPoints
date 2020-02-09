require('dotenv').config()
const HDWalletProvider = require('truffle-hdwallet-provider')
const Web3 = require('web3')
const axios = require('axios')
const { getNonce, contracts, toBN, toWei } = require('./web3')
const logger = require('../services/logger')

const {
  PRIVATE_KEY,
  RPC,
  GAS_PRICE_PROVIDER,
  GAS_PRICE_DIVIDER,
  GAS_PRICE_SPEED
} = process.env

const walletProvider = new HDWalletProvider(PRIVATE_KEY, RPC)
const web3 = new Web3(walletProvider)

const reward = async (winner) => {
  logger.info(`reward - winner: ${winner}`)
  const account = walletProvider.addresses[0]
  const nonce = await getNonce(account)
  logger.debug(`nonce for account ${account} is ${nonce}`)

  const gasEstimate = await contracts.DAIp.instance.methods.reward(winner).estimateGas({ from: account })
  logger.debug(`gasEstimate: ${gasEstimate}`)

  let { data } = await axios.get(GAS_PRICE_PROVIDER)
  let gasPrice = toWei(toBN(data[GAS_PRICE_SPEED]/GAS_PRICE_DIVIDER), 'gwei')
  logger.debug(`gasPrice: ${gasPrice} wei`)

  contracts.DAIp.instance.methods.reward(winner).send({ from: account, gas: gasEstimate, gasPrice, nonce })
    .on('transactionHash', hash => {
      logger.info(`transactionHash: ${hash}`)
    })
    .on('confirmation', (confirmationNumber, receipt) => {
      if (confirmationNumber == 1) {
        logger.debug(`receipt: ${JSON.stringify(receipt)}`)
      }
      return toBN(0) // TODO return real rewardAmount
    })
    .on('error', error => {
      logger.error(error); resolve()
    })
}

module.exports = {
  reward
}
