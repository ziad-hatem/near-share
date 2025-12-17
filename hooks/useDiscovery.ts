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
      addMessage,
      incrementUnread,
      displayName: currentName,
      fingerprint: currentFp
  } = useNearShareStore();
  
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || socket) return; 
    initialized.current = true;

    const init = async () => {
      try {
        const res = await fetch('/api/nearshare/ip');
        const { ip } = await res.json();
        
        // Simple hash of IP to create room ID
        const networkHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
          .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

        // Fingerprint & Name Persistence
        let storedName = localStorage.getItem(STORAGE_KEY_NAME);
        let storedFp = localStorage.getItem(STORAGE_KEY_FP);

        if (!storedFp) {
            storedFp = crypto.randomUUID();
            localStorage.setItem(STORAGE_KEY_FP, storedFp);
        }
        
        if (!storedName) {
             storedName = uniqueNamesGenerator({
                dictionaries: [adjectives, colors, animals],
                separator: ' ',
                style: 'capital',
            });
            localStorage.setItem(STORAGE_KEY_NAME, storedName);
        }

        setFingerprint(storedFp);
        setDisplayName(storedName);

        // API Route Initialization (Serverless Pattern)
        await fetch('/api/socket');

        // Connect to Socket
        const newSocket = io({
          path: '/socket.io',
          reconnectionAttempts: 5,
        });
        
        setSocket(newSocket);

        newSocket.on('connect', () => {
          console.log('Socket Connected', newSocket.id);
          
          if (newSocket.id) {
             setMyself({ socketId: newSocket.id, networkHash, displayName: storedName! });
             
             // Join Room with Fingerprint logic if valid?
             newSocket.emit('join-room', { 
                 networkHash, 
                 displayName: storedName,
                 fingerprint: storedFp 
             });
             setIsDiscoveryActive(true);
          }
        });

        newSocket.on('room-update', (users: any[]) => {
          setUsers(users);
        });
        
        newSocket.on('private-message', (data: { content: string, from: string }) => {
            console.log("Received message from", data.from);
             addMessage({
                id: Date.now().toString(),
                senderId: data.from,
                content: data.content,
                timestamp: Date.now(),
                isMe: false
            });
            incrementUnread(data.from);
            
            // Simple sound
            try {
                const context = new (window.AudioContext || (window as any).webkitAudioContext)();
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
        
        newSocket.on('signal', (data) => {
           // Debug signal
        });

      } catch (err) {
        console.error("Discovery failed", err);
      }
    };

    init();
  }, [socket, setSocket, setUsers, setMyself, setIsDiscoveryActive, setFingerprint, setDisplayName, addMessage, incrementUnread]);
  
  // Update name if changed in store
  useEffect(() => {
      if (socket && currentName) {
          localStorage.setItem(STORAGE_KEY_NAME, currentName);
          // Emit update to server if different from initial?
          // For now, assum join-room sets it, but if we edit it live:
          socket.emit('update-user', { displayName: currentName });
      }
  }, [currentName, socket]);

  return socket;
};
