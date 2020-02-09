require('dotenv').config()
const Web3 = require('web3')

const {
  INFURA_API_KEY,
  DAI_POINTS_ADDRESS,
  COMPOUND_ADDRESS
} = process.env

const COMPOUND_ABI = require('../../abis/cDAI.abi')
const DAI_POINTS_ABI = require('../../abis/DAIp.abi')

const web3 = new Web3(new Web3.providers.HttpProvider(`https://mainnet.infura.io/v3/${INFURA_API_KEY}`))
const { fromWei, toBN } = web3.utils

const Compound = new web3.eth.Contract(COMPOUND_ABI, COMPOUND_ADDRESS)
const DAIp = new web3.eth.Contract(DAI_POINTS_ABI, DAI_POINTS_ADDRESS)

const DECIMALS = toBN(1e18)

const getBlockNumber = async () => {
  return web3.eth.getBlockNumber()
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
    }
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
    }
  }
}

module.exports = {
  getBlockNumber,
  contracts,
  fromWei,
  toBN,
  DECIMALS
}
