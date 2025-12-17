import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IActiveSession extends Document {
  socketId: string;
  networkHash: string;
  displayName: string;
  createdAt: Date;
}

const ActiveSessionSchema: Schema = new Schema({
  socketId: { type: String, required: true, unique: true },
  networkHash: { type: String, required: true, index: true },
  displayName: { type: String, required: true },
  fingerprint: { type: String },
  lastActive: { type: Date, default: Date.now, expires: 7200 }, // 2 hours sliding TTL
  createdAt: { type: Date, default: Date.now },
});

// Check if model already exists to prevent overwrite error in HMR
const ActiveSession: Model<IActiveSession> = mongoose.models.ActiveSession || mongoose.model<IActiveSession>('ActiveSession', ActiveSessionSchema);

export default ActiveSession;
