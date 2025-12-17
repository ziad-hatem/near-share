import { useState, useEffect, useRef } from 'react';
import SimplePeer, { Instance as PeerInstance } from 'simple-peer';
import { useNearShareStore } from '../store/useNearShareStore';

interface TransferState {
  progress: number;
  status: 'idle' | 'requesting' | 'waiting' | 'transferring' | 'completed' | 'error' | 'rejected';
  fileName?: string;
  fileSize?: number;
  error?: string;
  
  // Stats
  speed?: number; // bytes per second
  startTime?: number;
  eta?: number; // seconds remaining
}

// Simple beep sound
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'; // (Truncated placeholder, will use real short beep data or AudioContext)

export const useFileTransfer = (targetSocketId?: string) => {
  const [transferState, setTransferState] = useState<TransferState>({ progress: 0, status: 'idle' });
  const socket = useNearShareStore(state => state.socket);
  const addMessage = useNearShareStore(state => state.addMessage);
  const incrementUnread = useNearShareStore(state => state.incrementUnread);

  const peerRef = useRef<PeerInstance | null>(null);
  
  // Refs for stats
  const statsRef = useRef({
      startTime: 0,
      lastBytes: 0,
      lastTime: 0,
  });

  const playNotificationSound = () => {
      try {
          const context = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = context.createOscillator();
          const gainNode = context.createGain();

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(800, context.currentTime); // High pitch notification
          oscillator.frequency.exponentialRampToValueAtTime(400, context.currentTime + 0.1); 
          
          gainNode.gain.setValueAtTime(0.1, context.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);

          oscillator.connect(gainNode);
          gainNode.connect(context.destination);

          oscillator.start();
          oscillator.stop(context.currentTime + 0.1);
      } catch (e) { console.error("Audio error", e); }
  };

  useEffect(() => {
    if (!socket) return;

    const handleSignal = (data: { signal: any; from: string }) => {
      console.log("signal from", data.from);

      if (!peerRef.current) {
         startReceiver(data.from, data.signal, socket);
      } else {
         if (peerRef.current && !peerRef.current.destroyed) {
             peerRef.current.signal(data.signal);
         }
      }
    };

    socket.on('signal', handleSignal);

    return () => {
      socket.off('signal', handleSignal);
    };
  }, [socket]);

  const sendText = (text: string) => {
      if (peerRef.current && peerRef.current.connected) {
          const msg = { type: 'text', content: text };
          peerRef.current.send(JSON.stringify(msg));
          addMessage({
              id: Date.now().toString(),
              senderId: 'me',
              content: text,
              timestamp: Date.now(),
              isMe: true
          });
      }
  };

  const acceptFile = () => {
      if (peerRef.current && transferState.status === 'requesting') {
          console.log("Accepting file...");
          peerRef.current.send(JSON.stringify({ type: 'accept' }));
          setTransferState(prev => ({ ...prev, status: 'transferring', startTime: Date.now() }));
          statsRef.current.startTime = Date.now();
      }
  };

  const declineFile = () => {
      if (peerRef.current && transferState.status === 'requesting') {
          console.log("Declining file...");
          peerRef.current.send(JSON.stringify({ type: 'reject' }));
          setTransferState({ status: 'idle', progress: 0 });
      }
  };

  const startSender = (file: File) => {
    if (!socket || !targetSocketId) return;

    statsRef.current = { startTime: 0, lastBytes: 0, lastTime: 0 };
    setTransferState({ status: 'waiting', progress: 0, fileName: file.name, fileSize: file.size });

    if (peerRef.current) {
        peerRef.current.destroy();
    }

    const peer = new SimplePeer({
      initiator: true, 
      trickle: false, 
    });

    peer.on('signal', (signal) => {
      socket.emit('signal', {
        signal,
        to: targetSocketId
      });
    });

    peer.on('connect', () => {
      console.log('Peer Connected (Sender)');
      peer.send(JSON.stringify({ type: 'request', name: file.name, size: file.size }));
    });
    
    peer.on('data', (data) => {
        try {
            const text = new TextDecoder().decode(data);
            if (text.startsWith('{')) {
                 const msg = JSON.parse(text);
                 
                 if (msg.type === 'accept') {
                     setTransferState(prev => ({ ...prev, status: 'transferring', startTime: Date.now() }));
                     startSendingData(peer, file);
                     
                 } else if (msg.type === 'reject') {
                     setTransferState({ status: 'rejected', progress: 0, error: 'Recipient declined the file.' });
                     
                 } else if (msg.type === 'ack') {
                     setTransferState(prev => ({ ...prev, status: 'completed', progress: 100 }));
                     
                 } else if (msg.type === 'text') {
                     addMessage({
                        id: Date.now().toString(),
                        senderId: targetSocketId,
                        content: msg.content,
                        timestamp: Date.now(),
                        isMe: false
                    });
                    // Sender getting text back from receiver? Rare in File Transfer UI but possible if chat is active.
                    // If targetSocketId is NOT currently selected, notify? 
                    // Usually this hook is bound to a specific target in the UI or 'undefined'.
                    // If bound, we see it. If 'undefined', this code block isn't running?
                    // Actually useFileTransfer is instantiated per component? usually once at top level or per user card.
                    // Wait, if we have multiple peers (one per user), we need to manage this better.
                    // BUT for now, strict P2P logic:
                    
                    incrementUnread(targetSocketId);
                    playNotificationSound();
                 }
             }
        } catch (e) {}
    });

    peer.on('error', (err) => {
        console.error("Peer error", err);
        setTransferState({ status: 'error', progress: 0, error: err.message });
    });

    peerRef.current = peer;
  };
  
  const startSendingData = (peer: PeerInstance, file: File) => {
      statsRef.current.startTime = Date.now();
      const chunkSize = 16 * 1024; 
      let offset = 0;
      const reader = new FileReader();
      
      const readNextChunk = () => {
        const slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
      };

      reader.onload = (e) => {
        if (!e.target?.result) return;
        peer.send(e.target.result as ArrayBuffer);
        offset += chunkSize;
        
        // Stats Calculation
        const now = Date.now();
        const progress = Math.min((offset / file.size) * 100, 100);
        
        if (now - statsRef.current.lastTime > 500) {
             const bytesSinceLast = offset - statsRef.current.lastBytes;
             const timeSinceLast = (now - statsRef.current.lastTime) / 1000;
             const speed = bytesSinceLast / timeSinceLast; 
             
             const remainingBytes = file.size - offset;
             const eta = speed > 0 ? remainingBytes / speed : 0;
             
             statsRef.current.lastTime = now;
             statsRef.current.lastBytes = offset;
             
             setTransferState(prev => ({ ...prev, progress, speed, eta }));
        } else {
             setTransferState(prev => ({ ...prev, progress }));
        }

        if (offset < file.size) {
            readNextChunk();
        } else {
            console.log("File data sent");
        }
      };

      readNextChunk();
  };

  const startReceiver = (senderId: string, initialSignal: any, socket: any) => {
      const peer = new SimplePeer({
          initiator: false,
          trickle: false
      });

      peer.signal(initialSignal);

      peer.on('signal', (signal) => {
          socket.emit('signal', {
              signal,
              to: senderId
          });
      });
      
      let incomingFileInfo: { name: string; size: number } | null = null;
      let receivedBytes = 0;
      let receivedChunks: ArrayBuffer[] = [];
      
      // Receiver Stats
      let recvStartTime = 0;
      let lastRecvTime = 0;
      let lastRecvBytes = 0;

      peer.on('data', (data: any) => {
          try {
             const text = new TextDecoder().decode(data);
             if (text.startsWith('{')) {
                 const msg = JSON.parse(text);
                 
                 if (msg.type === 'request') {
                     incomingFileInfo = msg;
                     receivedChunks = []; 
                     receivedBytes = 0;
                     setTransferState({ 
                         status: 'requesting', 
                         progress: 0, 
                         fileName: msg.name, 
                         fileSize: msg.size 
                     });
                     return;
                     
                 } else if (msg.type === 'text') {
                     addMessage({
                         id: Date.now().toString(),
                         senderId: senderId,
                         content: msg.content,
                         timestamp: Date.now(),
                         isMe: false
                     });
                     incrementUnread(senderId);
                     playNotificationSound();
                     return; 
                 }
             }
          } catch (e) { }

          if (incomingFileInfo) {
              receivedChunks.push(data);
              receivedBytes += data.byteLength;
              
              const now = Date.now();
              if (recvStartTime === 0) recvStartTime = now;
              
              const progress = Math.min((receivedBytes / incomingFileInfo.size) * 100, 100);
              
              if (now - lastRecvTime > 500) {
                  const bytesSince = receivedBytes - lastRecvBytes;
                  const timeSince = (now - lastRecvTime) / 1000;
                  const speed = bytesSince / timeSince;
                  
                  const remaining = incomingFileInfo.size - receivedBytes;
                  const eta = speed > 0 ? remaining / speed : 0;
                  
                  lastRecvTime = now;
                  lastRecvBytes = receivedBytes;
                  
                  setTransferState(prev => ({ ...prev, progress, speed, eta, status: 'transferring' }));
              } else {
                  setTransferState(prev => ({ ...prev, progress, status: 'transferring' }));
              }


              if (receivedBytes >= incomingFileInfo.size) {
                  const blob = new Blob(receivedChunks);
                  downloadFile(blob, incomingFileInfo.name);
                  setTransferState(prev => ({ ...prev, status: 'completed', progress: 100, speed: 0, eta: 0 }));
                  
                  peer.send(JSON.stringify({ type: 'ack' }));
                  
                  incomingFileInfo = null;
                  receivedChunks = [];
                  receivedBytes = 0;
              }
          }
      });

      peer.on('error', (err) => {
          console.log("Receiver error", err);
          setTransferState({ status: 'error', progress: 0 });
      });

      peerRef.current = peer;
  };

  const downloadFile = (blob: Blob, name: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  return { transferState, startSender, sendText, acceptFile, declineFile };
};
