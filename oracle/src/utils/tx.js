require('dotenv').config()
const HDWalletProvider = require('truffle-hdwallet-provider')
const Web3 = require('web3')
const axios = require('axios')
const { getNonce, contracts, toBN, toWei, getTxReciept, logsToEvents } = require('./web3')
const logger = require('../services/logger')

const {
  PRIVATE_KEY,
  RPC,
  GAS_PRICE_PROVIDER,
  GAS_PRICE_DIVIDER,
  GAS_PRICE_SPEED,
  GET_RECEIPT_INTERVAL_IN_MILLISECONDS
} = process.env

const walletProvider = new HDWalletProvider(PRIVATE_KEY, RPC)
const web3 = new Web3(walletProvider)

async function sendRawTx ({ params, method }) {
  // curl -X POST --data '{"jsonrpc":"2.0","method":"eth_sendRawTransaction","params":[{see above}],"id":1}'
  const body = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params,
    id: Math.floor(Math.random() * 100) + 1
  })
  const options = {
    headers: {
      'Content-type': 'application/json'
    }
  }
  const { data } = await axios.post(RPC, body, options)
  const txHash = data.result
  logger.info(`tx: ${txHash} sent`)
  return txHash
}

function timeout (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getReceipt (txHash) {
  logger.debug(`getReceipt: ${txHash}`)
  await timeout(GET_RECEIPT_INTERVAL_IN_MILLISECONDS)
  let receipt = await getTxReciept(txHash)
  if (receipt === null || receipt.blockNumber === null) {
    receipt = await getReceipt(txHash)
  }
  return receipt
}

const reward = async (winner) => {
  logger.info(`reward - winner: ${winner}`)
  const account = walletProvider.addresses[0]
  const nonce = await getNonce(account)
  logger.debug(`nonce for account ${account} is ${nonce}`)

  const gasEstimate = await contracts.DAIp.instance.methods.reward(winner).estimateGas({ from: account })
  logger.debug(`gasEstimate: ${gasEstimate}`)

  const { data } = await axios.get(GAS_PRICE_PROVIDER)
  const gasPrice = toWei(toBN(Math.ceil(data[GAS_PRICE_SPEED] / GAS_PRICE_DIVIDER)), 'gwei')
  logger.debug(`gasPrice: ${gasPrice} wei`)

  const txData = await contracts.DAIp.instance.methods.reward(winner).encodeABI({ from: account })
  logger.debug(`txData: ${txData}`)

  const serializedTx = await web3.eth.accounts.signTransaction({
    nonce: nonce,
    to: contracts.DAIp.instance.address,
    data: txData,
    value: 0,
    gasPrice,
    gas: gasEstimate
  }, `0x${PRIVATE_KEY}`)
  logger.debug(`serializedTx: ${JSON.stringify(serializedTx)}`)

  const txHash = await sendRawTx({
    method: 'eth_sendRawTransaction',
    params: [serializedTx.rawTransaction]
  })
  const receipt = await getReceipt(txHash)
  const events = logsToEvents(receipt.logs, contracts.DAIp.instance)
  logger.debug(`events: ${JSON.stringify(events)}`)
  const rewardAmount = events.Transfer[0].returnValues.value
  logger.debug(`rewardAmount: ${rewardAmount}`)

  return {
    rewardAmount
  }
}

module.exports = {
  reward
}
