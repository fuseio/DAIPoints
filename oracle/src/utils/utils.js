const moment = require('moment')
const mongoose = require('mongoose')
const logger = require('../services/logger')
const { getBlockNumber, contracts, fromWei, toBN, DECIMALS } = require('./web3')
const { getCommunityMembers } = require('./graph')

const Draw = mongoose.model('Draw')
const Snapshot = mongoose.model('Snapshot')

const getReward = async () => {
  logger.info('getReward')

  const { compoundBalance, exchangeRateMantissa } = await contracts.Compound.getAccountSnapshot()
  const compoundValue = compoundBalance.mul(exchangeRateMantissa).div(DECIMALS)
  logger.debug(`compoundValue: ${fromWei(toBN(compoundValue))}`)

  const daipTotalSupply = await contracts.DAIp.totalSupply()
  logger.debug(`daipTotalSupply: ${fromWei(daipTotalSupply)}`)

  const rate = await contracts.DAIp.rate()
  logger.debug(`rate: ${fromWei(rate)}`)

  const daiTotalSupply = daipTotalSupply.div(rate)
  logger.debug(`daiTotalSupply: ${fromWei(daiTotalSupply)}`)

  const grossWinnings = compoundValue.sub(daiTotalSupply)
  logger.debug(`grossWinnings: ${fromWei(grossWinnings)}`)

  const fee = toBN(await contracts.DAIp.fee())
  logger.debug(`fee: ${fromWei(fee)}`)

  const daiRewardAmount = grossWinnings.mul(DECIMALS.sub(fee)).div(DECIMALS)
  logger.debug(`daiRewardAmount: ${fromWei(daiRewardAmount)}`)

  const daipRewardAmount = daiRewardAmount.mul(rate)
  logger.info(`daipRewardAmount: ${fromWei(daipRewardAmount)}`)

  return daipRewardAmount
}

const selectWinner = async () => {
  logger.info('selectWinner')
  const communityMembers = await getCommunityMembers()
  logger.trace({ communityMembers })
  const winner = communityMembers[(Math.floor(Math.random() * communityMembers.length - 1) + 1)]
  logger.info(`winner is: ${winner}`)

  return winner
}

const getLastWinning = async () => {
  logger.info('getLastWinning')
  const draw = await Draw.findOne({ state: 'CLOSED' }).sort({ createdAt: -1 })
  return {
    lastWinner: draw && draw.winner,
    lastReward: draw && draw.reward
  }
}

const getCurrentRewardInfo = async () => {
  logger.info('getCurrentRewardInfo')
  // https://github.com/pooltogether/pooltogetherjs/blob/master/src/utils/calculatePrizeEstimate.js
  const { endTime } = await Draw.findOne({ state: 'OPEN' })
  const secondsToDrawEnd = moment(endTime).diff(moment(), 'seconds')
  logger.debug(`secondsToDrawEnd: ${secondsToDrawEnd}`)

  const blocksToDrawEnd = toBN(Math.floor(secondsToDrawEnd / 15))
  logger.debug(`blocksToDrawEnd: ${blocksToDrawEnd}`)

  const supplyRatePerBlock = await contracts.Compound.supplyRatePerBlock()
  logger.debug(`supplyRatePerBlock: ${supplyRatePerBlock}`)

  const interestRate = blocksToDrawEnd.mul(supplyRatePerBlock)
  logger.debug(`interestRate: ${interestRate}`)

  const { compoundBalance, exchangeRateMantissa } = await contracts.Compound.getAccountSnapshot()
  const compoundValue = compoundBalance.mul(exchangeRateMantissa).div(DECIMALS)
  logger.debug(`compoundValue: ${fromWei(toBN(compoundValue))}`)

  const estimatedInterestAccrued = interestRate.mul(compoundValue).div(DECIMALS)
  logger.debug(`estimatedInterestAccrued: ${estimatedInterestAccrued}`)

  const rate = await contracts.DAIp.rate()
  logger.debug(`rate: ${fromWei(rate)}`)

  const daipCurrentReward = await getReward()
  logger.debug(`daipCurrentReward: ${daipCurrentReward}`)

  const daipEstimatedReward = daipCurrentReward.add(estimatedInterestAccrued.mul(rate))
  logger.debug(`daipEstimatedReward: ${fromWei(daipEstimatedReward)}`)

  const rewardGrowthRatePerSec = daipEstimatedReward.sub(daipCurrentReward).div(toBN(secondsToDrawEnd))

  return {
    endTime,
    daipCurrentReward,
    estimatedReward: daipEstimatedReward,
    rewardGrowthRatePerSec
  }
}

const getDrawInfo = async () => {
  logger.info('getDrawInfo')

  const { lastWinner, lastReward } = await getLastWinning()
  const { daipCurrentReward, endTime, estimatedReward, rewardGrowthRatePerSec } = await getCurrentRewardInfo()

  return {
    current: {
      endTimestamp: moment(endTime).format('x'),
      reward: {
        amount: fromWei(daipCurrentReward),
        growthRatePerSec: fromWei(rewardGrowthRatePerSec),
        estimated: fromWei(estimatedReward)
      },
      blockNumber: await getBlockNumber(),
      possibleWinnersCount: await getCommunityMembers(true)
    },
    previous: {
      reward: lastReward ? fromWei(toBN(lastReward)) : 0,
      winner: lastWinner
    }
  }
}

module.exports = {
  getReward,
  selectWinner,
  getLastWinning,
  getCurrentRewardInfo,
  getDrawInfo,
  models: {
    Draw,
    Snapshot
  }
}
