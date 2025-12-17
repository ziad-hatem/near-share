import { useEffect, useRef } from 'react';
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

       
       // Sockets Removed - Pure REST Implementation
       // setSocket(null); 
       // setIsDiscoveryActive(true); -- Handled by heartbeat presence

       
       
       // Sockets Removed - Pure REST Implementation
       // Message handling is now done via the pollMessages interval below.

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

  // 4. Vercel Optimization: REST Heartbeat (Bypasses Socket Limits)
  useEffect(() => {
      if (!currentHash || !currentName) return;

      const beat = async () => {
          try {
              // 1. Announce Presence via API (Socket independent)
              await fetch('/api/nearshare/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      socketId: socket?.id || 'rest-' + currentFp, // Fallback ID if socket dead
                      networkHash: currentHash,
                      displayName: currentName,
                      fingerprint: currentFp
                  })
              });
          } catch(e) { console.error("Heartbeat failed", e); }
      };

      // Initial Beat
      beat();

      // Set "Myself" active immediately since we don't have socket connect event anymore
      if (currentHash && currentName) {
           setMyself({ socketId: 'rest-' + currentFp, networkHash: currentHash, displayName: currentName });
           setIsDiscoveryActive(true);
      }

      // Periodic Beat (Keep active in DB)
      const heartbeatInterval = setInterval(beat, 4000); // 4s heartbeat
      
      const pollInterval = setInterval(async () => {
          try {
              const res = await fetch(`/api/nearshare/room?room=${currentHash}`);
              if (res.ok) {
                  const data = await res.json();
                  if (data.users && Array.isArray(data.users)) {
                      setUsers(data.users);
                  }
              }
          } catch (e) {}
      }, 3000); // 3s polling for peers

      return () => {
          clearInterval(heartbeatInterval);
          clearInterval(pollInterval);
      };
  }, [currentHash, currentName, currentFp, socket, setUsers]);

  // 4. Message Polling (Replaces Socket Listeners)
  useEffect(() => {
      if (!currentHash || !currentName || !currentFp) return;

      let lastTimestamp = Date.now();

      const pollMessages = async () => {
          try {
              // Fix: Recipient ID must match what sender uses (rest-fingerprint)
              // If we only use fingerprint, we miss messages sent to our "Socket ID"
              const myId = 'rest-' + currentFp;
              
              const res = await fetch(`/api/nearshare/messages?room=${currentHash}&recipient=${myId}&since=${lastTimestamp}`);
              if (res.ok) {
                  const messages = await res.json();
                  if (Array.isArray(messages) && messages.length > 0) {
                      // Update timestamp to last received message
                      lastTimestamp = messages[messages.length - 1].timestamp;

                      messages.forEach((msg: any) => {
                          if (msg.type === 'chat' && msg.sender !== currentName) { // Don't process own echo
                              const messageId = msg._id || Date.now().toString();
                              
                              addMessage({
                                  id: messageId,
                                  senderId: msg.sender, // Using name as ID for simplicity in REST
                                  content: msg.content,
                                  timestamp: msg.timestamp,
                                  isMe: false
                              });
                              incrementUnread(msg.sender);
                              
                              // Play Sound
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
                          }
                      });
                  }
              }
          } catch (e) { console.error("Message poll error", e); }
      };

      const interval = setInterval(pollMessages, 2000); // 2s Polling for Chat
      return () => clearInterval(interval);
  }, [currentHash, currentName, currentFp, addMessage, incrementUnread]);

  return socket;
};
