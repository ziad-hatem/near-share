
import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  password: { 
    type: String, 
    minlength: 4,
    required: false
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    expires: 86400 // 24 hours TTL
  }
});

// HMR Safe
const Room = mongoose.models.Room || mongoose.model('Room', RoomSchema);
export default Room;
