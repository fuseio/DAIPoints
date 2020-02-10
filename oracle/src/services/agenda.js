require('dotenv').config()
const Agenda = require('agenda')
const logger = require('./logger')
const { drawTask } = require('../utils/utils')

const {
  MONGO_URI,
  PERIODIC_INTERVAL_SECONDS
} = process.env

const agenda = new Agenda({ db: { address: MONGO_URI, options: { useUnifiedTopology: true, autoReconnect: false, reconnectTries: 0, reconnectInterval: 0 } } })

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

  await agenda.every(`${PERIODIC_INTERVAL_SECONDS} seconds`, 'draw-state')

  logger.info('Agenda job scheduling is successfully defined')
}

module.exports = {
  start,
  agenda
}
