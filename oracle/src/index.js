require('dotenv').config()
const logger = require('./utils/logger')
const { getReward, selectWinner } = require('./utils/services')

const {
  INTERVAL_SECONDS
} = process.env

async function run() {
  try {
    logger.info(`run`)
    await getReward()
    await selectWinner()
  } catch (e) {
    logger.error(e)
    process.exit(1)
  }

  setTimeout(() => {
    run()
  }, (INTERVAL_SECONDS || 5) * 1000)
}

run()