require('dotenv').config()
const Web3 = require('web3')
const isArray = require('lodash/isArray')

const {
  RPC,
  DAI_POINTS_ADDRESS,
  COMPOUND_ADDRESS
} = process.env

const COMPOUND_ABI = require('../../abis/cDAI.abi')
const DAI_POINTS_ABI = require('../../abis/DAIp.abi')

const web3 = new Web3(new Web3.providers.HttpProvider(RPC))
const { toWei, fromWei, toBN } = web3.utils

const Compound = new web3.eth.Contract(COMPOUND_ABI, COMPOUND_ADDRESS)
const DAIp = new web3.eth.Contract(DAI_POINTS_ABI, DAI_POINTS_ADDRESS)

const DECIMALS = toBN(1e18)

const getBlockNumber = async () => {
  return web3.eth.getBlockNumber()
}

const getNonce = async (account) => {
  return web3.eth.getTransactionCount(account)
}

const getTxReciept = async (txHash) => {
  return web3.eth.getTransactionReceipt(txHash)
}

const logsToEvents = (logs, contract) => {
  if (isArray(logs)) {
    const events = {}
    logs.forEach((log, index) => {
      log = contract.events.allEventsLogDecoder.decode(contract.abiModel, log)
      if (log.event) {
        if (events[log.event]) {
          if (isArray(events[log.event])) {
            events[log.event].push(log)
            return
          }
          events[log.event] = [events[log.event], log]
          return
        }
        events[log.event] = log
        return
      }
      events[index] = log
    })
    return events
  }
}

const contracts = {
  DAIp: {
    totalSupply: async () => {
      return toBN(await DAIp.methods.totalSupply.call())
    },
    rate: async () => {
      return toBN(await DAIp.methods.daiToDaipConversionRate.call())
    },
    fee: async () => {
      return toBN(await DAIp.methods.fee.call())
    },
    instance: DAIp
  },
  Compound: {
    getAccountSnapshot: async () => {
      const result = await Compound.methods.getAccountSnapshot(DAI_POINTS_ADDRESS).call()
      const compoundBalance = toBN(result[1])
      const exchangeRateMantissa = toBN(result[3])
      return {
        compoundBalance,
        exchangeRateMantissa
      }
    },
    supplyRatePerBlock: async () => {
      return toBN(await Compound.methods.supplyRatePerBlock().call())
    },
    instance: Compound
  }
}

module.exports = {
  getBlockNumber,
  getNonce,
  getTxReciept,
  contracts,
  toWei,
  fromWei,
  toBN,
  DECIMALS,
  logsToEvents
}
