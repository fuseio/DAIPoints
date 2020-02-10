require('dotenv').config()
const logger = require('./services/logger')
const appLogger = require('express-pino-logger')({ logger })
const express = require('express')
const bodyParser = require('body-parser')
require('express-async-errors')
const mongoose = require('mongoose')

const {
  MONGO_URI,
  API_PORT,
  SKIP_TASKS
} = process.env

async function init () {
  var app = express()
  app.use(appLogger)
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(bodyParser.json())
  if (MONGO_URI) {
    mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }).catch((error) => {
      console.error(error)
      process.exit(1)
    })
    require('./models')(mongoose)
    if (SKIP_TASKS) {
      logger.warn('Running without agenda tasks!')
    } else {
      require('./services/agenda').start()
    }
  }
  app.use(require('./routes'))
  app.use((req, res, next) => {
    var err = new Error('Not Found')
    err.status = 404
    next(err)
  })

  app.use((err, req, res, next) => {
    logger.error(err.stack)
    res.status(err.status || 500)
    res.json({ errors: { message: err.message, error: err } })
  })

  const server = app.listen(API_PORT || 8080, () => {
    logger.info(`Listening on port ${server.address().port}`)
  })
}

init()
