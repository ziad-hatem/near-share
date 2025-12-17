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
      try {
        const res = await fetch('/api/nearshare/ip');
        const { ip } = await res.json();
        
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
          .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

        setNetworkHash(hash); // Set initial hash

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

        await fetch('/api/socket');

        const newSocket = io({
          path: '/socket.io',
          reconnectionAttempts: 5,
        });
        
        setSocket(newSocket);

        newSocket.on('connect', () => {
          console.log('Socket Connected', newSocket.id);
          // Set initial self state mostly for ID.
          // Discovery active waits for room join
        });

        newSocket.on('room-update', (users: any[]) => {
          setUsers(users);
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

      } catch (err) {
        console.error("Discovery failed", err);
      }
    };

    init();
  }, [socket, setSocket, setUsers, setNetworkHash, setFingerprint, setDisplayName, addMessage, incrementUnread]);
  
  // 2. Room Management: Join when socket + hash + name + fp are ready
  // Also re-join if hash changes (Manual override)
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

  // 3. Update Sync
  useEffect(() => {
      if (socket && currentName) {
          localStorage.setItem(STORAGE_KEY_NAME, currentName);
          socket.emit('update-user', { displayName: currentName });
      }
  }, [currentName, socket]);

  return socket;
};
