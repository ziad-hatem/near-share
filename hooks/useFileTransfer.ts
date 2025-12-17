
import { useState, useEffect, useRef } from 'react';
import { useNearShareStore } from '../store/useNearShareStore';

interface TransferState {
  progress: number;
  status: 'idle' | 'requesting' | 'waiting' | 'transferring' | 'completed' | 'error' | 'rejected';
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  s3Key?: string;
  error?: string;
  
  // Stats
  speed?: number; // bytes per second
  startTime?: number;
  eta?: number; // seconds remaining
}

// Simple beep sound
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'; 

export const useFileTransfer = (targetSocketId?: string) => {
  const [transferState, setTransferState] = useState<TransferState>({ progress: 0, status: 'idle' });
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  
  const pendingFileRef = useRef<File | null>(null);
  const statsRef = useRef({ startTime: 0, lastBytes: 0, lastTime: 0 });

  const dismissedTransferIds = useRef<Set<string>>(new Set());

  // Sync / Polling Logic
  useEffect(() => {
      const myself = useNearShareStore.getState().myself;
      if (!myself) return;

      const myId = myself.socketId || 'rest-' + useNearShareStore.getState().fingerprint;

      const pollTransfers = async () => {
          try {
              const url = `/api/nearshare/transfer?room=${myself.networkHash}&user=${myId}`;
              // console.log("Polling URL:", url);
              const res = await fetch(url);
              if (res.ok) {
                  const transfers = await res.json();
                  if (Array.isArray(transfers) && transfers.length > 0) {
                      // Find first non-dismissed transfer
                      const active = transfers.find((t: any) => !dismissedTransferIds.current.has(t._id));
                      
                      if (active) {
                          // Standardize active handling
                          // console.log("Active Transfer Found:", active._id);
                          
                          const isSender = active.sender === myId;
                          
                          if (active.status === 'pending') {
                              if (!isSender) {
                                  // console.log("Action: I am Receiver -> Showing Request UI");
                                  setTransferState({ 
                                      status: 'requesting', 
                                      progress: 0, 
                                      fileName: active.fileName, 
                                      fileSize: active.fileSize, 
                                      fileType: active.fileType 
                                  });
                                  setActiveTransferId(active._id);
                              } else {
                                  // console.log("Action: I am Sender -> Waiting for Accept");
                                  setActiveTransferId(active._id);
                              }
                          } 
                          else if (active.status === 'accepted') {
                              if (isSender && pendingFileRef.current && transferState.status !== 'transferring' && transferState.status !== 'completed') {
                                   // Start Upload
                                   uploadToS3(pendingFileRef.current, active._id);
                              }
                          }
                          else if (active.status === 'uploaded') {
                              if (!isSender && transferState.status !== 'completed' && transferState.status !== 'transferring') {
                                  // Start Download
                                  setActiveTransferId(active._id); // Ensure ID is set for ignoring later
                                  downloadFromS3(active.s3Key, active.fileName);
                              }
                          }
                      }
                  }
              }
          } catch (e) {}
      };

      const interval = setInterval(pollTransfers, 1000);
      return () => clearInterval(interval);
  }, [transferState.status, useNearShareStore().myself]); // Re-run when identity is ready

  // Auto-Dismiss Timer
  useEffect(() => {
      if (['completed', 'error', 'rejected'].includes(transferState.status)) {
          const timer = setTimeout(() => {
              if (activeTransferId) {
                  dismissedTransferIds.current.add(activeTransferId);
              }
              setTransferState({ status: 'idle', progress: 0 });
              setActiveTransferId(null);
          }, 5000); // 5 Seconds
          return () => clearTimeout(timer);
      }
  }, [transferState.status, activeTransferId]);


  const startSender = async (file: File) => {
    if (!targetSocketId) return;
    const myself = useNearShareStore.getState().myself;
    if (!myself) return;

    pendingFileRef.current = file;
    setTransferState({ status: 'waiting', progress: 0, fileName: file.name, fileSize: file.size });

    // Create Transfer in DB
    try {
        const res = await fetch('/api/nearshare/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'create',
                room: myself.networkHash,
                sender: myself.socketId || 'rest-' + useNearShareStore.getState().fingerprint,
                recipient: targetSocketId,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type
            })
        });
        const transfer = await res.json();
        setActiveTransferId(transfer._id);
    } catch (e) { console.error(e); }
  };

  const acceptFile = async () => {
      if (activeTransferId) {
          setTransferState(prev => ({ ...prev, status: 'waiting' }));
          await fetch('/api/nearshare/transfer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'update', id: activeTransferId, status: 'accepted' })
          });
      }
  };

  const declineFile = async () => {
      if (activeTransferId) {
          setTransferState({ status: 'idle', progress: 0 });
          await fetch('/api/nearshare/transfer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'update', id: activeTransferId, status: 'rejected' })
          });
      }
  };

  const uploadToS3 = async (file: File, transferId: string) => {
       /* ... Same S3 Logic, but update DB on success ... */
      try {
          setTransferState(prev => ({ ...prev, status: 'transferring', progress: 0, startTime: Date.now() }));
          statsRef.current = { startTime: Date.now(), lastBytes: 0, lastTime: Date.now() };

          // 1. Get Presigned URL
          const signRes = await fetch('/api/nearshare/s3/sign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'upload', fileName: file.name, fileType: file.type })
          });
          const { url, key } = await signRes.json();
          if (!url) throw new Error("Failed to get upload URL");

          // 2. Upload via XHR for progress
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', url, true);
          xhr.setRequestHeader('Content-Type', file.type);

          xhr.upload.onprogress = (e) => {
              /* ... Same Progress Logic ... */
              if (e.lengthComputable) {
                  const percent = (e.loaded / e.total) * 100;
                  setTransferState(prev => ({ ...prev, progress: percent }));
              }
          };

          xhr.onload = async () => {
              if (xhr.status === 200) {
                  setTransferState(prev => ({ ...prev, status: 'completed', progress: 100 }));
                  // Update DB
                  await fetch('/api/nearshare/transfer', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'update', id: transferId, status: 'uploaded', s3Key: key })
                  });
                  pendingFileRef.current = null;
              }
          };
          
          xhr.send(file);
      } catch (e: any) { setTransferState(prev => ({ ...prev, status: 'error', error: e.message })); }
  };

  const downloadFromS3 = async (key: string, name: string) => {
       /* ... Same Download Logic ... */
       try {
           setTransferState(prev => ({ ...prev, status: 'transferring', progress: 0, fileName: name }));
           
           const signRes = await fetch('/api/nearshare/s3/sign', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ action: 'download', key })
           });
           const { url } = await signRes.json();

           // Direct Download for MVP Reliability or keep Fetch Stream if wanted
           // Let's use simple window.open for robustness first? 
           // No, user wants progress. Keep Fetch stream.
           
           const response = await fetch(url);
           const reader = response.body?.getReader();
           const contentLength = +response.headers.get('Content-Length')!;
           
           if (!reader) throw new Error("No reader");

           let receivedLength = 0;
           let chunks = []; 
           
           while(true) {
               const { done, value } = await reader.read();
               if (done) break;
               chunks.push(value);
               receivedLength += value.length;
               setTransferState(prev => ({ ...prev, progress: (receivedLength / contentLength) * 100 }));
           }

           const blob = new Blob(chunks);
           const downloadUrl = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = downloadUrl;
           a.download = name;
           document.body.appendChild(a);
           a.click();
           document.body.removeChild(a);
           
           setTransferState(prev => ({ ...prev, status: 'completed', progress: 100 }));
           
       } catch (e: any) { setTransferState(prev => ({ ...prev, status: 'error', error: e.message })); }
  };
  
  const sendText = () => {}; // Interface compatibility

  // Broadcast Functionality (Selective)
  const broadcastFile = async (file: File, recipientIds: string[]) => {
      const myself = useNearShareStore.getState().myself;
      if (!myself || recipientIds.length === 0) return;

      setTransferState({ 
          status: 'transferring', 
          progress: 0, 
          fileName: file.name, 
          fileSize: file.size, 
          fileType: file.type 
      });

      try {
          // 1. Upload Once
          setTransferState(prev => ({ ...prev, status: 'transferring', progress: 0, startTime: Date.now() }));
          statsRef.current = { startTime: Date.now(), lastBytes: 0, lastTime: Date.now() };

          // A. Get Sign URL
          const signRes = await fetch('/api/nearshare/s3/sign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'upload', fileName: file.name, fileType: file.type })
          });
          const { url, key } = await signRes.json();
          if (!url) throw new Error("Failed to get upload URL");

          // B. Upload XHR
          await new Promise<void>((resolve, reject) => {
               const xhr = new XMLHttpRequest();
               xhr.open('PUT', url, true);
               xhr.setRequestHeader('Content-Type', file.type);
               
               xhr.upload.onprogress = (e) => {
                  if (e.lengthComputable) {
                      const percent = (e.loaded / e.total) * 100;
                      setTransferState(prev => ({ ...prev, progress: percent }));
                  }
               };
               
               xhr.onload = () => xhr.status === 200 ? resolve() : reject(new Error(xhr.statusText));
               xhr.onerror = () => reject(new Error("Network Error"));
               xhr.send(file);
          });

          setTransferState(prev => ({ ...prev, status: 'completed', progress: 100 }));

          // 2. Create Records for Targets (Directly as 'uploaded' for auto-download)
          await Promise.all(recipientIds.map(uid => 
               fetch('/api/nearshare/transfer', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      action: 'create',
                      room: myself.networkHash,
                      sender: myself.socketId || 'rest-' + useNearShareStore.getState().fingerprint,
                      recipient: uid,
                      fileName: file.name,
                      fileSize: file.size,
                      fileType: file.type,
                      status: 'uploaded', // Trigger auto-download
                      s3Key: key
                  })
              })
          ));
          
          console.log("Broadcast Complete");

      } catch (e: any) {
          console.error("Broadcast failed", e);
          setTransferState(prev => ({ ...prev, status: 'error', error: e.message }));
      }
  };

  return { transferState, startSender, broadcastFile, sendText, acceptFile, declineFile };
};
