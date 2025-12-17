
import mongoose, { Schema, Document } from 'mongoose';

export interface IFileTransfer extends Document {
  room: string;
  sender: string;
  recipient: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  s3Key?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'uploading' | 'uploaded' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const FileTransferSchema = new Schema<IFileTransfer>({
  room: { type: String, required: true },
  sender: { type: String, required: true },
  recipient: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileType: { type: String, required: true },
  s3Key: { type: String },
  status: { 
      type: String, 
      enum: ['pending', 'accepted', 'rejected', 'uploading', 'uploaded', 'completed', 'failed'],
      default: 'pending' 
  },
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // 1 hour TTL
}, { timestamps: true });

export default mongoose.models.FileTransfer || mongoose.model<IFileTransfer>('FileTransfer', FileTransferSchema);
