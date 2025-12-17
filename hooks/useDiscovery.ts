import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNearShareStore } from '../store/useNearShareStore';
import { uniqueNamesGenerator, adjectives, animals, colors } from 'unique-names-generator';

const STORAGE_KEY_NAME = 'nearshare_device_name';
const STORAGE_KEY_FP = 'nearshare_fingerprint';

export const useDiscovery = () => {
  const { 
      setUsers, 
      setMyself, 
      setIsDiscoveryActive, 
      setSocket, 
      socket,
      setFingerprint,
      setDisplayName,
      setNetworkHash,
      addMessage,
      incrementUnread,
      displayName: currentName,
      fingerprint: currentFp,
      networkHash: currentHash
  } = useNearShareStore();
  
  const initialized = useRef(false);

  // 1. Init: Fetch IP, Names, Fingerprint, Connect Socket
  useEffect(() => {
    if (initialized.current || socket) return; 
    initialized.current = true;

    const init = async () => {
       // 1. Check LocalStorage for persistent session
       if (typeof window !== 'undefined') {
           const storedRoom = localStorage.getItem('nearshare_room');
           if (storedRoom) {
               useNearShareStore.getState().setNetworkHash(storedRoom);
           }
       }

       await fetch('/api/socket');
       
       // 2. Init Identity (Restore missing logic)
       let name = localStorage.getItem(STORAGE_KEY_NAME);
       if (!name) {
           name = uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals], separator: '-' });
           localStorage.setItem(STORAGE_KEY_NAME, name);
       }
       setDisplayName(name);

       let fp = localStorage.getItem(STORAGE_KEY_FP);
       if (!fp) {
           fp = Math.random().toString(36).substring(2, 15);
           localStorage.setItem(STORAGE_KEY_FP, fp);
       }
       setFingerprint(fp);

       const newSocket = io({ path: '/socket.io', reconnectionAttempts: 5 });
       setSocket(newSocket);

       newSocket.on('connect', () => { console.log('Socket Connected', newSocket.id); });
       newSocket.on('room-update', (users: any) => { 
           console.log("Room Update:", users);
           if (Array.isArray(users)) setUsers(users);
           else if (users && Array.isArray(users.users)) setUsers(users.users);
           else console.warn("Invalid room-update format:", users);
       });
       
       newSocket.on('private-message', (data: { content: string, from: string }) => {
             addMessage({
                id: Date.now().toString(),
                senderId: data.from,
                content: data.content,
                timestamp: Date.now(),
                isMe: false
            });
            incrementUnread(data.from);
            try {
                const context = new (window.AudioContext || (window as any).webkitAudioContext)();
                if (context.state === 'suspended') context.resume();
                const oscillator = context.createOscillator();
                const gainNode = context.createGain();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, context.currentTime); 
                oscillator.frequency.exponentialRampToValueAtTime(400, context.currentTime + 0.1); 
                gainNode.gain.setValueAtTime(0.1, context.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
                oscillator.connect(gainNode);
                gainNode.connect(context.destination);
                oscillator.start();
                oscillator.stop(context.currentTime + 0.1);
            } catch (e) {}
        });
    };

    init();
  }, [socket, setSocket, setUsers, addMessage, incrementUnread]);
  
  // 2. Room Management: Join ONLY when hash is explicitly set (by Lobby or URL)
  useEffect(() => {
      if (socket && socket.connected && currentHash && currentName && currentFp) {
          console.log("Joining Network Room:", currentHash);
          
          socket.emit('join-room', { 
             networkHash: currentHash, 
             displayName: currentName,
             fingerprint: currentFp 
          });
          
          setMyself({ socketId: socket.id, networkHash: currentHash, displayName: currentName });
          setIsDiscoveryActive(true);
      }
  }, [socket, currentHash, currentName, currentFp, setIsDiscoveryActive, setMyself]);

  // 3. Update Sync & Polling Fallback
  useEffect(() => {
      if (socket && currentName) {
          localStorage.setItem(STORAGE_KEY_NAME, currentName);
          socket.emit('update-user', { displayName: currentName });
      }

      // Polling fallback for Vercel/Serverless environments where sockets might split
      // We only poll if we have a hash and users, checking the socket state isn't enough?
      if (currentHash) {
          const poll = setInterval(async () => {
              try {
                  const res = await fetch(`/api/nearshare/room?room=${currentHash}`);
                  if (res.ok) {
                      const data = await res.json();
                      if (Array.isArray(data)) {
                          setUsers(data);
                      } else if (data.users && Array.isArray(data.users)) {
                          setUsers(data.users);
                      }
                  }
              } catch (e) {}
          }, 3000); // 3s polling

          return () => clearInterval(poll);
      }
  }, [currentName, socket, currentHash, setUsers]);

  return socket;
};
