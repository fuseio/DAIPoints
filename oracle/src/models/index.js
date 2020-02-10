require('./Draw')

module.exports = (mongoose) => {
  mongoose = mongoose || require('mongoose')
  return mongoose
}
