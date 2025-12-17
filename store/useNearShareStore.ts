import { create } from 'zustand';

// Define types locally or import if shared (keeping simple for now)
interface User {
  socketId: string;
  networkHash: string;
  displayName: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  isMe: boolean;
}

interface NearShareState {
  activeUsers: User[];
  socket: any | null; 
  socketId: string | null;
  networkHash: string | null;
  displayName: string | null;
  isDiscoveryActive: boolean;
  messages: ChatMessage[];
  unreadMessages: Record<string, number>;
  
  // Identity
  fingerprint: string | null;

  // Actions
  setSocket: (socket: any) => void;
  setUsers: (users: User[]) => void;
  setMyself: (data: { socketId: string, networkHash: string, displayName: string }) => void;
  setIsDiscoveryActive: (active: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
  incrementUnread: (senderId: string) => void;
  clearUnread: (senderId: string) => void;
  
  // New actions
  setFingerprint: (fp: string) => void;
  setDisplayName: (name: string) => void;
  setNetworkHash: (hash: string) => void;
}

export const useNearShareStore = create<NearShareState>((set) => ({
  activeUsers: [],
  socket: null,
  socketId: null,
  networkHash: null,
  displayName: null,
  isDiscoveryActive: false,
  messages: [],
  unreadMessages: {},
  fingerprint: null,

  setSocket: (socket) => set({ socket }),
  setUsers: (users) => set({ activeUsers: users }),
  setMyself: (data) => set({ 
    socketId: data.socketId, 
    networkHash: data.networkHash, 
    displayName: data.displayName 
  }),
  setIsDiscoveryActive: (active) => set({ isDiscoveryActive: active }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  incrementUnread: (senderId) => set((state) => ({
      unreadMessages: { 
          ...state.unreadMessages, 
          [senderId]: (state.unreadMessages[senderId] || 0) + 1 
      }
  })),
  clearUnread: (senderId) => set((state) => {
      const newUnread = { ...state.unreadMessages };
      delete newUnread[senderId];
      return { unreadMessages: newUnread };
  }),
  
  setFingerprint: (fingerprint) => set({ fingerprint }),
  setDisplayName: (displayName) => set({ displayName }),
  setNetworkHash: (networkHash) => set({ networkHash }),
}));
