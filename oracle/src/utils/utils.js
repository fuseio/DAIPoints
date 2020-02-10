const mongoose = require('mongoose')
const moment = require('moment')
const logger = require('../services/logger')
const { getBlockNumber, contracts, fromWei, toBN, DECIMALS } = require('./web3')
const { getCommunityMembers } = require('./graph')
const { reward } = require('./tx')

const Draw = mongoose.model('Draw')

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
  const winner = communityMembers[(Math.floor(Math.random() * communityMembers.length - 1) + 1)]
  logger.info(`winner is: ${winner.address}`)

  return winner.address
}

const getLastWinning = async () => {
  logger.info('getLastWinning')
  const draw = await Draw.findOne({ state: 'CLOSED' }).sort({ createdAt: -1 })
  return {
    lastWinner: draw && draw.winner,
    lastReward: draw && draw.reward
  }
}

const getEstimatedRewardAndGrowthRate = async () => {
  logger.info('getEstimatedReward')
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

  const { compoundBalance } = await contracts.Compound.getAccountSnapshot()
  logger.debug(`compoundBalance: ${compoundBalance}`)

  const estimatedInterestAccrued = interestRate.mul(compoundBalance).div(DECIMALS)
  logger.debug(`estimatedInterestAccrued: ${estimatedInterestAccrued}`)

  const rate = await contracts.DAIp.rate()
  logger.debug(`rate: ${fromWei(rate)}`)

  const daipCurrentReward = await getReward()
  logger.debug(`daipCurrentReward: ${daipCurrentReward}`)

  const daipEstimatedReward = daipCurrentReward.add(estimatedInterestAccrued.mul(rate))
  logger.debug(`daipEstimatedReward: ${fromWei(daipEstimatedReward)}`)

  const rewardGrowthRatePerSec = daipEstimatedReward.sub(daipCurrentReward).div(toBN(secondsToDrawEnd))

  return {
    estimatedReward: daipEstimatedReward,
    rewardGrowthRatePerSec
  }
}

const getNextDrawEndTime = async () => {
  logger.info('getNextDrawEndTime')
  const { endTime } = await Draw.findOne({ state: 'OPEN' })
  return endTime
}

const getDrawInfo = async () => {
  logger.info('getDrawInfo')

  const { lastWinner, lastReward } = await getLastWinning()
  const { estimatedReward, rewardGrowthRatePerSec } = await getEstimatedRewardAndGrowthRate()

  return {
    current: {
      endTimestamp: moment(await getNextDrawEndTime()).format('x'),
      reward: {
        amount: fromWei(await getReward()),
        growthRatePerSec: fromWei(rewardGrowthRatePerSec),
        estimated: fromWei(estimatedReward)
      },
      blockNumber: await getBlockNumber(),
      possibleWinnersCount: await getCommunityMembers(true)
    },
    previous: {
      reward: fromWei(toBN(lastReward)),
      winner: lastWinner
    }
  }
}

const drawTask = async () => {
  const draw = await Draw.findOne({ state: 'OPEN' })
  if (draw) {
    logger.info(`there's an open draw: ${draw}, ending at: ${draw.endTime}`)
    const now = moment()
    if (now.isSameOrAfter(draw.endTime)) {
      logger.info('need to close draw and open a new one')
      const winner = await selectWinner()
      const { rewardAmount } = await reward(winner)
      await Draw.close(draw.id, winner, rewardAmount)
      await Draw.create()
    }
  } else {
    logger.info('there\'s no open draw - creating one...')
    await Draw.create()
  }
}

module.exports = {
  getDrawInfo,
  drawTask
}
