const mongoose = require('mongoose')
const { Schema } = mongoose

const SnapshotSchema = new Schema({
  draw: { type: Schema.Types.ObjectId, ref: 'Draw' },
  data: { type: Schema.Types.Mixed }
}, { timestamps: true })

const Snapshot = mongoose.model('Snapshot', SnapshotSchema)

Snapshot.create = async (draw, addressesWithBalances) => {
  return new Snapshot({ draw, data: addressesWithBalances }).save()
}

module.exports = Snapshot
