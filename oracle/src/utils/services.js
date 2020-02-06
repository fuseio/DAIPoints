require('dotenv').config()
const Web3 = require('web3')
const { GraphQLClient } = require('graphql-request')
const logger = require('./logger')

const {
  INFURA_API_KEY,
  GRAPH_URL,
  DAI_POINTS_ADDRESS,
  COMPOUND_ADDRESS,
  DAI_POINTS_COMMUNITY_ADDRESS
} = process.env

const COMPOUND_ABI = require('../../abis/cDAI.abi')
const DAI_POINTS_ABI = require('../../abis/DAIp.abi')

const web3 = new Web3(new Web3.providers.HttpProvider(`https://mainnet.infura.io/v3/${INFURA_API_KEY}`))
const graphClient = new GraphQLClient(GRAPH_URL)


async function getReward () {
  logger.info(`getReward`)
  const { fromWei, toBN } = web3.utils
  const decimals = toBN(1e18)
  const compound = new web3.eth.Contract(COMPOUND_ABI, COMPOUND_ADDRESS)
  const DAIp = new web3.eth.Contract(DAI_POINTS_ABI, DAI_POINTS_ADDRESS)

  const result = await compound.methods.getAccountSnapshot(DAI_POINTS_ADDRESS).call()
  const compoundBalance = toBN(result[1])
  const exchangeRateMantissa = toBN(result[3])
  const compoundValue = compoundBalance.mul(exchangeRateMantissa).div(decimals)
  logger.debug(`compoundValue: ${fromWei(toBN(compoundValue))}`)

  const daiTotalSupply = toBN((await DAIp.methods.totalSupply.call()).div(await DAIp.methods.daiToDaipConversionRate.call()))
  logger.debug(`daiTotalSupply: ${fromWei(daiTotalSupply)}`)

  const grossWinnings = compoundValue.sub(daiTotalSupply)
  logger.debug(`grossWinnings: ${fromWei(grossWinnings)}`)

  const fee = toBN(await DAIp.methods.fee.call())
  logger.debug(`fee: ${fromWei(fee)}`)

  const daiRewardAmount = grossWinnings.mul(decimals.sub(fee)).div(decimals)
  logger.debug(`daiRewardAmount: ${fromWei(daiRewardAmount)}`)

  const rate = toBN(await DAIp.methods.daiToDaipConversionRate.call())
  const daipRewardAmount = daiRewardAmount.mul(rate)
  logger.info(`daipRewardAmount: ${fromWei(daipRewardAmount)}`)

  return daipRewardAmount
}

async function selectWinner () {
  logger.info(`selectWinner`)
  const query = `{communities(where:{address:"${DAI_POINTS_COMMUNITY_ADDRESS}"}) {entitiesList {communityEntities(where:{isUser: true, isAdmin: false}) {id, address}}}}`
  logger.debug(`query: ${query.replace('\n', '')}`)
  const data = await graphClient.request(query)
  const communityUsers = data.communities[0].entitiesList.communityEntities
  logger.debug(`found ${communityUsers.length} users`)
  const winner = communityUsers[(Math.floor(Math.random() * communityUsers.length - 1) + 1)]
  logger.info(`winner is: ${winner.address}`)

  return winner
}

module.exports = {
  getReward,
  selectWinner
}