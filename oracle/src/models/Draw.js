require('dotenv').config()
const mongoose = require('mongoose')
const { Schema } = mongoose
const { ObjectId } = mongoose.Types
const moment = require('moment')

const {
  DRAW_DURATION_SECONDS
} = process.env

const DrawSchema = new Schema({
  endTime: { type: Date },
  state: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
  reward: { type: Number },
  winner: { type: String }
}, { timestamps: true })

const Draw = mongoose.model('Draw', DrawSchema)

Draw.create = async () => {
  const endTime = moment().add(DRAW_DURATION_SECONDS, 'seconds')
  return new Draw({ endTime }).save()
}

Draw.close = async (id, winner, reward) => {
  return Draw.updateOne({ _id: ObjectId(id) }, { winner, reward, state: 'CLOSED' })
}

module.exports = Draw
