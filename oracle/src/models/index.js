require('./Draw')
require('./Snapshot')

module.exports = (mongoose) => {
  mongoose = mongoose || require('mongoose')
  return mongoose
}
