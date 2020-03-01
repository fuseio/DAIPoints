const moment = require('moment')
const mongoose = require('mongoose')
const _ = require('lodash')
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

const selectWinner = async (drawId) => {
  const getWeightedRandom = (data) => {
    // First, we loop the main dataset to count up the total weight.
    // We're starting the counter at one because the upper boundary of Math.random() is exclusive.
    let total = 1
    for (let i = 0; i < data.length; ++i) {
      total += data[i].balance
    }
    logger.debug({ total })

    // Total in hand, we can now pick a random value akin to our
    // random index from before.
    const threshold = Math.floor(Math.random() * total)
    logger.debug({ threshold })

    // Now we just need to loop through the main data one more time until we discover which value would live within this particular threshold.
    // We need to keep a running count of weights as we go.
    let running = 0
    for (let i = 0; i < data.length; ++i) {
      // Add the weight to our running.
      running += data[i].balance

      // If this value falls within the threshold, we're done!
      if (running >= threshold) {
        return data[i].address
      }
    }
  }

  logger.info('selectWinner')
  const snapshot = await Snapshot.getRandom(drawId)
  if (!snapshot || !snapshot.data || !snapshot.data.length) {
    return
  }

  const winner = getWeightedRandom(snapshot.data)
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

const getPossibleWinners = async (getCount) => {
  logger.info('getCurrentRewardInfo')
  const { id } = await Draw.findOne({ state: 'OPEN' })
  logger.debug(`open draw: ${id}`)
  const snapshots = await Snapshot.getAll(id)
  logger.debug(`found ${snapshots.length} snapshots`)
  let possibleWinners
  if (snapshots && snapshots.length) {
    logger.debug('possibleWinners from snapshots')
    possibleWinners = [...new Set(_.flatten(snapshots.map(snapshot => snapshot.data.map(d => d.address))))]
  } else {
    logger.debug('possibleWinners from getCommunityMembers')
    possibleWinners = await getCommunityMembers()
  }
  return getCount ? possibleWinners.length : possibleWinners
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
      possibleWinnersCount: await getPossibleWinners(true)
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
