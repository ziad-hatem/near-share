
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessage extends Document {
  room: string;
  sender: string;
  recipient: string; // 'all' or specific socketId/fingerprint
  type: 'chat' | 'signal';
  content: any; // String for chat, JSON object for signal
  timestamp: number;
  createdAt: Date;
}

const MessageSchema = new Schema({
  room: { type: String, required: true, index: true },
  sender: { type: String, required: true },
  recipient: { type: String, required: true, index: true },
  type: { type: String, enum: ['chat', 'signal'], required: true },
  content: { type: Schema.Types.Mixed, required: true },
  timestamp: { type: Number, default: Date.now },
  createdAt: { type: Date, default: Date.now, expires: 600 }, // 10 minutes TTL (Transient data)
});

// Index for efficient polling: Find messages for a room/recipient after a certain time
MessageSchema.index({ room: 1, recipient: 1, timestamp: 1 });

const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);

export default Message;
