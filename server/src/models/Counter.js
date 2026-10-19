import mongoose from 'mongoose';

/** Atomic counter so every job card gets a unique OAS-xxxx number. */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

export async function nextSequence(name, pad = 4) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return String(doc.seq).padStart(pad, '0');
}

export async function setSequence(name, value) {
  await Counter.findOneAndUpdate({ _id: name }, { seq: value }, { upsert: true });
}

export default Counter;
