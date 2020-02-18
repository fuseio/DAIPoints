require('dotenv').config()
const NodeCache = require('node-cache')

const {
  CACHE_TTL_SECONDS
} = process.env

const cache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS || 600, checkperiod: 120 })

module.exports = cache