const router = require('express').Router()
const { getDrawInfo } = require('../utils/utils')
const moment = require('moment')

router.get('/is-running', (req, res, next) => {
  res.send({ response: 'ok' })
})

router.get('/draw-info', async (req, res, next) => {
  const data = await getDrawInfo()
  res.send({ data, timestamp: moment().format('x'), time: moment() })
})

module.exports = router
