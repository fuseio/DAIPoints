const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info', prettyPrint: { translateTime: true } })

module.exports = logger