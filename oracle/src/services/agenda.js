require('dotenv').config()
const Agenda = require('agenda')
const moment = require('moment')
const logger = require('./logger')
const cache = require('./cache')
const { selectWinner, models } = require('../utils/utils')
const { Draw, Snapshot } = models
const { reward } = require('../utils/tx')
const { getCommunityMembersWithBalances, getCommunityMembers } = require('../utils/graph')

const {
  MONGO_URI,
  PERIODIC_INTERVAL_SECONDS
} = process.env

const agenda = new Agenda({ db: { address: MONGO_URI, options: { useUnifiedTopology: true, autoReconnect: false, reconnectTries: 0, reconnectInterval: 0 } } })

const drawTask = async () => {
  const draw = await Draw.findOne({ state: 'OPEN' })
  if (draw) {
    logger.info(`there's an open draw: ${draw}, ending at: ${draw.endTime}`)
    const now = moment()
    if (now.isSameOrAfter(draw.endTime)) {
      logger.info('need to close draw and open a new one')
      const winner = await selectWinner(draw.id)
      const { rewardAmount } = await reward(winner)
      await Draw.close(draw.id, winner, rewardAmount)
      await Draw.create()
    }
  } else {
    logger.info('there\'s no open draw - creating one...')
    await Draw.create()
  }
}

const snapshotTask = async () => {
  const communityMembersWithBalances = await getCommunityMembersWithBalances()
  logger.trace({ communityMembersWithBalances })
  const draw = await Draw.findOne({ state: 'OPEN' })
  if (draw) {
    logger.info(`there's an open draw: ${draw}, ending at: ${draw.endTime}`)
    await Snapshot.create(draw.id, communityMembersWithBalances)
  } else {
    logger.warn('there\'s no open draw - creating one...')
  }
}

const communityMembersTask = async () => {
  const communityMembers = await getCommunityMembers()
  cache.set('communityMembers', communityMembers)
}

async function start () {
  logger.info('Starting Agenda job scheduling')

  agenda.on('start', job => logger.info(`Job ${job.attrs.name} starting. id: ${job.attrs._id}`))
  agenda.on('complete', job => logger.info(`Job ${job.attrs.name} finished. id: ${job.attrs._id}`))
  agenda.on('success', job => logger.info(`Job ${job.attrs.name} succeeded. id: ${job.attrs._id}`))
  agenda.on('fail', (error, job) => logger.error(`Job ${job.attrs.name} failed. id: ${job.attrs._id}. ${error}`))

  await agenda.start()

  agenda.define('draw-state', async (job) => {
    logger.info('draw-state')
    await drawTask()
  })

  agenda.define('snapshot', async (job) => {
    logger.info('snapshot')
    await snapshotTask()
  })

  agenda.define('community-members', async (job) => {
    logger.info('community-members')
    await communityMembersTask()
  })

  await agenda.every(`${PERIODIC_INTERVAL_SECONDS} seconds`, 'draw-state')
  await agenda.every('0 0 * * *', 'snapshot')
  await agenda.every('1 hour', 'community-members')

  logger.info('Agenda job scheduling is successfully defined')
}

module.exports = {
  start,
  agenda,
  snapshotTask
}
