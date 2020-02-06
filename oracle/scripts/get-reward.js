require('dotenv').config()
const Web3 = require('web3')

const {
  INFURA_API_KEY,
  DAI_POINTS_ADDRESS,
  COMPOUND_ADDRESS
} = process.env

const COMPOUND_ABI = require('../abis/cDAI.abi')
const DAI_POINTS_ABI = require('../abis/DAIp.abi')

const web3 = new Web3(new Web3.providers.HttpProvider(`https://mainnet.infura.io/v3/${INFURA_API_KEY}`))

const { fromWei, toBN } = web3.utils

const compound = new web3.eth.Contract(COMPOUND_ABI, COMPOUND_ADDRESS)
const DAIp = new web3.eth.Contract(DAI_POINTS_ABI, DAI_POINTS_ADDRESS)

const main = async () => {
  const result = await compound.methods.getAccountSnapshot(DAI_POINTS_ADDRESS).call()
  const compoundBalance = toBN(result[1])
  const exchangeRateMantissa = toBN(result[3])
  const compoundValue = compoundBalance.mul(exchangeRateMantissa).div(toBN(1e18))
  console.log(`compoundValue: ${fromWei(toBN(compoundValue))}`)

  const daiTotalSupply = toBN((await DAIp.methods.totalSupply.call()).div(await DAIp.methods.daiToDaipConversionRate.call()))
  console.log(`daiTotalSupply: ${fromWei(daiTotalSupply)}`)

  const grossWinnings = compoundValue.sub(daiTotalSupply)
  console.log(`grossWinnings: ${fromWei(grossWinnings)}`)
}

main()
