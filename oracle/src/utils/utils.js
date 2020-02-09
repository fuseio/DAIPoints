require('dotenv').config()
const Web3 = require('web3')
const { GraphQLClient } = require('graphql-request')
const logger = require('../services/logger')
const mongoose = require('mongoose')
const moment = require('moment')

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
const { fromWei, toBN } = web3.utils
const graphClient = new GraphQLClient(GRAPH_URL)

const Compound = new web3.eth.Contract(COMPOUND_ABI, COMPOUND_ADDRESS)
const DAIp = new web3.eth.Contract(DAI_POINTS_ABI, DAI_POINTS_ADDRESS)

const Draw = mongoose.model('Draw')

const getBlockNumber = async () => {
  logger.info('getBlockNumber')
  return web3.eth.getBlockNumber()
}

const getReward = async () => {
  logger.info('getReward')
  const decimals = toBN(1e18)

  const result = await Compound.methods.getAccountSnapshot(DAI_POINTS_ADDRESS).call()
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

  const blockNumber = await getBlockNumber()
  logger.debug(`blockNumber: ${blockNumber}`)

  return daipRewardAmount
}

const getCommunityMembers = async (getCount) => {
  logger.info('getCommunityMembers')
  const query = `{communities(where:{address:"${DAI_POINTS_COMMUNITY_ADDRESS}"}) {entitiesList {communityEntities(where:{isUser: true, isAdmin: false}) {id, address}}}}`
  logger.debug(`query: ${query.replace('\n', '')}`)
  const data = await graphClient.request(query)
  const communityMembers = data.communities[0].entitiesList.communityEntities
  logger.debug(`found ${communityMembers.length} users`)
  return (getCount ? communityMembers.length : communityMembers)
}

const selectWinner = async () => {
  logger.info('selectWinner')
  const communityMembers = await getCommunityMembers()
  const winner = communityMembers[(Math.floor(Math.random() * communityMembers.length - 1) + 1)]
  logger.info(`winner is: ${winner.address}`)

  return winner.address
}

const getLastWinning = async () => {
  logger.info('getLastWinning')
  const draw = await Draw.findOne({ state: 'CLOSED' }).sort({ createdAt: -1 })
  return {
    lastWinner: draw.winner,
    lastPrizeAmount: draw.reward
  }
}

const getEstimatedReward = async () => {
  logger.info('getEstimatedReward')
  // TODO
  return toBN(0)
}

const getNextDrawEndTime = async () => {
  logger.info('getNextDrawEndTime')
  const { endTime } = await Draw.findOne({ state: 'OPEN' })
  return endTime
}

const getRewardGrowthRatePerSec = async () => {
  logger.info('getRewardGrowthRatePerSec')
  // TODO
}

const getDrawInfo = async () => {
  logger.info('getDrawInfo')

  const { lastWinner, lastPrizeAmount } = await getLastWinning()

  return {
    estimatedReward: fromWei(await getEstimatedReward()),
    nextPrizeTimestamp: moment(await getNextDrawEndTime()).format('x'),
    currentPrizeAmount: fromWei(await getReward()),
    currentBlockNumber: await getBlockNumber(),
    rewardGrowthRatePerSec: getRewardGrowthRatePerSec(),
    lastPrizeAmount,
    lastWinner,
    possibleWinnersCount: await getCommunityMembers(true)
  }
}

const handleDraw = async () => {
  const draw = await Draw.findOne({ state: 'OPEN' })
  if (draw) {
    logger.info(`there's an open draw: ${draw}, ending at: ${draw.endTime}`)
    const now = moment()
    if (now.isSameOrAfter(draw.endTime)) {
      logger.info('need to close draw and open a new one')
      const winner = await selectWinner()
      // TODO call the "reward" transaction and get logs for the actual reward transferred
      const reward = 0 // TODO remove this after real implementation
      await Draw.close(draw.id, winner, reward)
      await Draw.create()
    }
  } else {
    logger.info('there\'s no open draw - creating one...')
    await Draw.create()
  }
}

module.exports = {
  getDrawInfo,
  handleDraw
}
