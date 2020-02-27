const mongoose = require('mongoose')
const { Schema } = mongoose
const { ObjectId } = mongoose.Types

const SnapshotSchema = new Schema({
  draw: { type: Schema.Types.ObjectId, ref: 'Draw' },
  data: { type: Schema.Types.Mixed }
}, { timestamps: true })

const Snapshot = mongoose.model('Snapshot', SnapshotSchema)

Snapshot.create = async (draw, addressesWithBalances) => {
  return new Snapshot({ draw, data: addressesWithBalances }).save()
}

Snapshot.getRandom = async (draw) => {
  const snapshots = await Snapshot.find({ draw: ObjectId(draw) })
  return snapshots.length ? snapshots[(Math.floor(Math.random() * snapshots.length - 1) + 1)] : []
}

Snapshot.getAll = async (draw) => {
  return Snapshot.find({ draw: ObjectId(draw) })
}

module.exports = Snapshot
