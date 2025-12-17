'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Smartphone, Activity, Clock, Minus, Maximize2, Zap, Shield, FileText, Image as ImageIcon, Music, Video, Edit2, Save, ArrowDown, Send, MessageSquare, Wifi, LogOut } from 'lucide-react';
import { useNearShareStore } from '../../store/useNearShareStore';
import { useDiscovery } from '../../hooks/useDiscovery';
import { useFileTransfer } from '../../hooks/useFileTransfer';
import { cn } from '../../lib/utils';
import Lobby from '../../components/Lobby';

export default function SharePage() {
  const { activeUsers, displayName, networkHash, socketId, messages, unreadMessages, setDisplayName, clearUnread, setNetworkHash } = useNearShareStore();
  useDiscovery();
  
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'chat'>('file');
  const [isminimized, setIsMinimized] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinTab, setJoinTab] = useState<'scan' | 'code' | 'share'>('scan');
  
  const { transferState, startSender, broadcastFile, acceptFile, declineFile } = useFileTransfer(selectedUser || undefined);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { addMessage } = useNearShareStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && selectedUser) {
      startSender(e.target.files[0]);
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
      e.preventDefault();
      
      const myself = useNearShareStore.getState().myself;
      if (textInput.trim() && selectedUser && myself) {
          
          // Optimistic UI Update
          addMessage({
              id: Date.now().toString(),
              senderId: 'me',
              content: textInput,
              timestamp: Date.now(),
              isMe: true
          });
          
          const msgContent = textInput;
          setTextInput('');

          try {
              await fetch('/api/nearshare/messages', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      room: myself.networkHash,
                      sender: myself.socketId || 'rest-' + useNearShareStore.getState().fingerprint,
                      recipient: selectedUser,
                      type: 'chat',
                      content: msgContent
                  })
              });
          } catch (e) { console.error("Send failed", e); }
      }
  };
  
  const handleSaveName = () => {
      if (tempName.trim()) {
          setDisplayName(tempName.trim());
          setIsEditingName(false);
      }
  };
  
  const handleLogout = () => {
    //@ts-ignore
      setNetworkHash(null); // Clears hash, kicks to lobby
      localStorage.removeItem('nearshare_room'); // Clear persistent session
      window.history.replaceState(null, '', '/share'); // Clear URL param
  };
  
  // Persist Room Session
  useEffect(() => {
      if (networkHash) {
          localStorage.setItem('nearshare_room', networkHash);
      }
  }, [networkHash]);

  // Clear unread when entering chat tab or selecting user
  useEffect(() => {
      if (selectedUser && activeTab === 'chat') {
          clearUnread(selectedUser);
      }
  }, [selectedUser, activeTab, clearUnread, messages]);

  useEffect(() => {
      if (displayName) setTempName(displayName);
  }, [displayName]);

  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [messages, selectedUser, activeTab]);
  
  const currentMessages = messages.filter(m => 
      (m.senderId === selectedUser && !m.isMe) || (m.senderId === 'me' && selectedUser) 
  );
  
  const formatSize = (bytes?: number) => {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName?: string) => {
      if (!fileName) return <FileText className="w-8 h-8 opacity-50" />;
      const ext = fileName.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext!)) return <ImageIcon className="w-8 h-8 text-purple-400" />;
      if (['mp4', 'mov', 'webm'].includes(ext!)) return <Video className="w-8 h-8 text-rose-400" />;
      if (['mp3', 'wav'].includes(ext!)) return <Music className="w-8 h-8 text-cyan-400" />;
      return <FileText className="w-8 h-8 text-blue-400" />;
  };
  
  // MAIN RENDER
  // If no networkHash, show Lobby
  if (!networkHash) {
      const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const initialRoom = urlParams.get('room');
      
      return (
            <div className="min-h-screen font-sans text-gray-100 selection:bg-cyan-500/30 selection:text-cyan-100 flex items-center justify-center relative overflow-hidden">
             {/* Dynamic Background */}
            <div className="fixed inset-0 -z-20 bg-[#0a0a0f]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-900/50 to-black/80"></div>
            </div>
             <Lobby 
                 onJoin={(room) => {
                     setNetworkHash(room);
                     // If we had a room param, clean it up or keep it? Keeping it enables refresh to stay in room context (Lobby will auto-fill again if we reload)
                     // But we want to feel "joined". 
                     // Let's actually UPDATE the URL to reflect the room we just joined, so it is shareable
                     const newUrl = new URL(window.location.href);
                     newUrl.searchParams.set('room', room);
                     window.history.pushState({}, '', newUrl.toString());
                 }} 
                 initialRoom={initialRoom}
             />
          </div>
      );
  }

  return (
    <div className="min-h-screen font-sans text-gray-100 selection:bg-cyan-500/30 selection:text-cyan-100 overflow-hidden relative">
      {/* Dynamic Background */}
      <div className="fixed inset-0 -z-20 bg-[#0a0a0f]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-900/50 to-black/80"></div>
      </div>

      {/* Header */}
      <header className="px-6 py-6 sm:px-12 flex justify-between items-center relative z-10 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md shadow-lg shadow-black/20">
              <Zap className="w-6 h-6 text-cyan-400 fill-cyan-400/20" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-black animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              NearShare 
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-[10px] font-bold text-cyan-400 border border-cyan-500/20 tracking-wider">BETA</span>
            </h1>
            <p className="text-sm text-gray-400 font-medium tracking-wide">Secure Local P2P</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
            {/* Network ID Display */}
            {networkHash && (
                 <>
                    {/* Broadcast Button */}
                    <div className="hidden md:flex relative group/broadcast">
                        <button 
                            onClick={() => {
                                // Pre-select everyone other than me
                                const others = activeUsers.filter(u => u.socketId !== socketId).map(u => u.socketId);
                                setSelectedRecipients(new Set(others));
                                setIsBroadcastModalOpen(true);
                            }}
                            className="cursor-pointer flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-5 py-2 rounded-full font-bold shadow-lg shadow-cyan-900/20 active:scale-95 transition-all"
                        >
                            <Upload className="w-4 h-4" />
                            <span className="text-xs uppercase tracking-wider">Broadcast</span>
                        </button>
                    </div>

                    <button 
                      onClick={() => setIsJoinModalOpen(true)}
                      className="hidden md:flex items-center gap-2 bg-[#1f1f2e] hover:bg-[#2a2a3d] border border-white/10 text-gray-300 hover:text-white px-4 py-2 rounded-full font-bold shadow-lg transition-all ml-2"
                    >
                        <Smartphone className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Join</span>
                    </button>
                 </>
            )}

            {/* Network ID Display */}
            {networkHash && (
                <div className="hidden md:flex flex-col items-end mr-4">
                     <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Room</span>
                        <button onClick={handleLogout} className="text-red-400 hover:text-red-300 transition-colors" title="Leave Room"><LogOut className="w-3 h-3" /></button>
                     </div>
                    <div className="flex items-center gap-2 group cursor-pointer">
                        <span className="text-sm font-bold font-mono text-cyan-400 transition-colors tracking-widest">
                            {networkHash}
                        </span>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4 bg-white/5 px-2 pl-6 py-2 rounded-full border border-white/10 backdrop-blur-md shadow-xl hover:bg-white/10 transition-colors group">
            <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Your Device</span>
                {isEditingName ? (
                    <div className="flex items-center gap-2">
                        <input 
                                autoFocus
                                type="text" 
                                value={tempName} 
                                onChange={e => setTempName(e.target.value)}
                                onBlur={handleSaveName}
                                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                                className="bg-transparent border-b border-cyan-500 text-sm font-semibold text-white focus:outline-none w-32"
                        />
                        <button onClick={handleSaveName}><Save className="w-3 h-3 text-cyan-400" /></button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setIsEditingName(true); setTempName(displayName || ''); }}>
                        <span className="text-sm font-semibold text-gray-200 group-hover:text-cyan-400 transition-colors">{displayName || 'Identifying...'}</span>
                        <Edit2 className="w-3 h-3 text-gray-600 group-hover:text-cyan-400 transition-colors" />
                    </div>
                )}
            </div>
            <div className="h-8 w-px bg-white/10 mx-2" />
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-inner">
                <span className="text-sm font-bold">{displayName?.charAt(0)}</span>
            </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 sm:px-12 pb-24 relative z-0">
        
        {/* Empty State */}
        <AnimatePresence>
            {activeUsers.length <= 1 && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center min-h-[60vh] pointer-events-none"
                >
                    <div className="relative">
                        <motion.div 
                            animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 bg-cyan-500/20 rounded-full blur-md"
                        />
                         <motion.div 
                            animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                            className="absolute inset-0 bg-purple-500/20 rounded-full blur-md"
                        />
                        <div className="w-24 h-24 rounded-full bg-[#13131f] border border-white/10 flex items-center justify-center relative z-10 shadow-2xl shadow-cyan-900/20">
                            <Wifi className="w-10 h-10 text-cyan-400" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold text-gray-200 mt-8 tracking-tight">Scanning for Peers</h2>
                    <p className="text-gray-500 mt-3 text-lg font-medium">Open NearShare on another device to connect</p>
                </motion.div>
            )}
        </AnimatePresence>

        {/* User Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 relative z-10">
          <AnimatePresence mode="popLayout">
            {activeUsers
              .filter(u => u.socketId !== socketId) 
              .map((user, idx) => (
              <motion.div
                layout
                key={user.socketId}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className={cn(
                  "relative overflow-hidden rounded-[2rem] transition-all duration-500 group border flex flex-col",
                  selectedUser === user.socketId 
                    ? "bg-[#161621]/90 backdrop-blur-2xl border-cyan-500/30 shadow-[0_0_50px_-12px_rgba(34,211,238,0.2)] h-[600px] row-span-2 col-span-1 md:col-span-2 lg:col-span-2" 
                    : "bg-white/5 backdrop-blur-lg border-white/5 hover:bg-white/10 hover:border-white/10 shadow-2xl cursor-pointer h-[240px]"
                )}
                onClick={() => !selectedUser && setSelectedUser(user.socketId)}
              >
                  {/* Card Background Effects */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  {/* Header Section */}
                  <div className="p-8 flex items-start justify-between relative z-20">
                      <div className="flex items-center gap-5">
                          <div className={cn(
                              "w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-2xl transition-all duration-500 relative overflow-hidden",
                              selectedUser === user.socketId ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white scale-110" : "bg-white/10 text-gray-400 group-hover:scale-105"
                          )}>
                              <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
                              {user.displayName.charAt(0)}
                              
                              {/* Online/Badge status */}
                              {!selectedUser && unreadMessages[user.socketId] > 0 && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-[#161621] flex items-center justify-center text-[10px] animate-bounce">
                                      {unreadMessages[user.socketId]}
                                  </div>
                              )}
                          </div>
                          <div>
                              <h3 className={cn("font-bold text-xl leading-tight transition-colors", selectedUser === user.socketId ? "text-white" : "text-gray-300 group-hover:text-white")}>
                                  {user.displayName}
                              </h3>
                              <p className="text-sm text-cyan-400/80 font-medium flex items-center gap-1.5 mt-1">
                                  <Shield className="w-3 h-3" /> Secure Connection
                              </p>
                          </div>
                      </div>
                      
                      {selectedUser === user.socketId && (
                          <button 
                              onClick={(e) => { e.stopPropagation(); setSelectedUser(null); }}
                              className="p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white transition-all hover:rotate-90"
                          >
                              <X className="w-6 h-6" />
                          </button>
                      )}
                  </div>

                  {/* Expanded View Content */}
                  {selectedUser === user.socketId ? (
                       <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="flex-1 flex flex-col min-h-0 bg-[#0f0f16]/50"
                       >
                           {/* Navigation Tabs */}
                           <div className="flex items-center px-8 border-b border-white/5 bg-black/20 backdrop-blur-sm">
                               {['file', 'chat'].map((tab) => (
                                   <button
                                       key={tab}
                                       onClick={() => setActiveTab(tab as any)}
                                       className={cn(
                                           "relative px-6 py-4 text-sm font-medium transition-colors outline-none flex items-center gap-2",
                                           activeTab === tab ? "text-cyan-400" : "text-gray-500 hover:text-gray-300"
                                       )}
                                   >
                                       {tab === 'file' ? 'File Transfer' : 'Secure Chat'}
                                       
                                       {/* Tab Badge */}
                                       {tab === 'chat' && unreadMessages[user.socketId] > 0 && activeTab !== 'chat' && (
                                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                       )}

                                       {activeTab === tab && (
                                           <motion.div 
                                               layoutId="activeTab"
                                               className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                                           />
                                       )}
                                   </button>
                               ))}
                           </div>

                           {/* Content Area */}
                           <div className="flex-1 p-6 relative overflow-hidden">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'file' ? (
                                        <motion.div 
                                            key="file"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="h-full flex flex-col"
                                        >
                                            {transferState.status === 'idle' ? (
                                                 <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all cursor-pointer group/upload relative overflow-hidden">
                                                    <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover/upload:scale-110 transition-transform duration-500 shadow-2xl">
                                                        <Upload className="w-10 h-10 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                                                    </div>
                                                    <h4 className="text-xl font-semibold text-white mb-2">Drop files to send</h4>
                                                    <p className="text-gray-500 font-medium">or click to browse</p>
                                                    <input type="file" className="hidden" onChange={handleFileChange} />
                                                 </label>
                                            ) : (
                                                 <div className="flex-1 flex flex-col justify-center items-center bg-black/20 rounded-3xl p-8 border border-white/5 relative overflow-hidden">
                                                     {/* Transfer State Visualization */}
                                                     <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />
                                                     
                                                     <div className="relative z-10 w-full max-w-sm text-center">
                                                         <div className="mx-auto w-24 h-24 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl flex items-center justify-center mb-6 shadow-2xl border border-white/5">
                                                             {getFileIcon(transferState.fileName)}
                                                         </div>
                                                         <h3 className="text-xl font-bold text-white mb-1 truncate">{transferState.fileName}</h3>
                                                         <p className="text-sm font-mono text-gray-500 mb-8">{formatSize(transferState.fileSize)}</p>

                                                         <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden shadow-inner mb-6">
                                                             <motion.div 
                                                                 className={cn("absolute inset-y-0 left-0 rounded-full", transferState.status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-cyan-500 to-blue-500')}
                                                                 initial={{ width: 0 }}
                                                                 animate={{ width: `${transferState.progress}%` }}
                                                                 transition={{ ease: "linear" }}
                                                             >
                                                                 <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite_linear]" style={{backgroundImage: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)'}}></div>
                                                             </motion.div>
                                                         </div>
                                                         
                                                         <div className="grid grid-cols-3 gap-2">
                                                             <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                                                 <span className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Status</span>
                                                                 <span className={cn("text-xs font-bold", transferState.status === 'completed' ? 'text-emerald-400' : 'text-white capitalize')}>{transferState.status}</span>
                                                             </div>
                                                             <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                                                 <span className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Speed</span>
                                                                 <span className="text-xs font-mono text-cyan-300">{(transferState.speed && transferState.status === 'transferring') ? `${formatSize(transferState.speed)}/s` : '--'}</span>
                                                             </div>
                                                             <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                                                 <span className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Time</span>
                                                                 <span className="text-xs font-mono text-purple-300">{(transferState.eta && transferState.status === 'transferring') ? `${Math.ceil(transferState.eta)}s` : '--'}</span>
                                                             </div>
                                                         </div>
                                                     </div>
                                                 </div>
                                            )}
                                        </motion.div>
                                    ) : (
                                        <motion.div 
                                            key="chat"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="h-full flex flex-col"
                                        >
                                            <div className="flex-1 overflow-y-auto pr-2 space-y-4" ref={scrollRef}>
                                                {currentMessages.length === 0 ? (
                                                    <div className="h-full flex flex-col items-center justify-center opacity-30">
                                                        <MessageSquare className="w-12 h-12 mb-3" />
                                                        <p>No secure messages yet</p>
                                                    </div>
                                                ) : currentMessages.map((msg, i) => (
                                                    <motion.div 
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        key={msg.id} 
                                                        className={cn("flex w-full", msg.isMe ? "justify-end" : "justify-start")}
                                                    >
                                                        <div className={cn(
                                                            "max-w-[75%] px-5 py-3 rounded-2xl text-sm font-medium shadow-sm relative group",
                                                            msg.isMe 
                                                                ? "bg-cyan-500 text-black rounded-tr-none ml-12" 
                                                                : "bg-[#252530] text-gray-100 rounded-tl-none mr-12 border border-white/5"
                                                        )}>
                                                            {msg.content}
                                                            <div className={cn(
                                                                "absolute bottom-0 text-[9px] opacity-40 font-mono mb-1 w-max",
                                                                msg.isMe ? "right-full mr-2 text-gray-400" : "left-full ml-2 text-gray-600"
                                                            )}>
                                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                            <form onSubmit={handleSendText} className="mt-4 flex gap-3">
                                                <input 
                                                    type="text" 
                                                    value={textInput}
                                                    onChange={e => setTextInput(e.target.value)}
                                                    placeholder="Type a secure message..."
                                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-colors placeholder:text-gray-600"
                                                />
                                                <button 
                                                    type="submit"
                                                    disabled={!textInput.trim()}
                                                    className="p-3.5 rounded-xl bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-400 transition-colors"
                                                >
                                                    <Send className="w-5 h-5" />
                                                </button>
                                            </form>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                           </div>
                       </motion.div>
                  ) : (
                      /* Collapsed State Badge */
                      <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-end opacity-40 group-hover:opacity-100 transition-opacity">
                           <div>
                               <p className="text-xs uppercase tracking-wider font-bold text-gray-500">Device</p>
                               <span className="text-xs font-mono text-gray-400">{user.networkHash.slice(0, 6)}</span>
                           </div>
                           <div className="relative">
                               <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                   <ArrowDown className="w-4 h-4 -rotate-90 text-gray-400" />
                               </div>
                               {unreadMessages[user.socketId] > 0 && (
                                   <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
                               )}
                           </div>
                      </div>
                  )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Persistent Overlay Elements */}
      <AnimatePresence>
         {/* INCOMING REQUEST MODAL */}
         {transferState.status === 'requesting' && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
                <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="bg-[#12121a] border border-white/10 p-1 w-full max-w-sm rounded-[2rem] shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 pointer-events-none" />
                    <div className="bg-[#181820] rounded-[1.8rem] p-8 text-center relative z-10">
                        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-cyan-500/20">
                            <ArrowDown className="w-8 h-8 text-white animate-bounce" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Incoming File</h3>
                        <div className="bg-white/5 rounded-2xl p-4 mb-8 border border-white/5">
                            <p className="font-medium text-gray-200 truncate">{transferState.fileName}</p>
                            <p className="text-xs text-gray-500 font-mono mt-1">{formatSize(transferState.fileSize)}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={declineFile}
                                className="py-3.5 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                            >
                                Decline
                            </button>
                            <button 
                                onClick={acceptFile}
                                className="py-3.5 rounded-xl bg-white text-black font-bold hover:bg-gray-100 transition-all shadow-lg"
                            >
                                Accept File
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
         )}

         {/* MINIMIZED STATUS */}
         {(transferState.status === 'transferring' || transferState.status === 'completed') && !selectedUser && (
            <motion.div 
                drag
                dragMomentum={false}
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className={cn(
                    "fixed bottom-6 right-6 z-40 bg-[#12121a]/90 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300",
                    isminimized ? "rounded-full w-auto" : "rounded-3xl w-[360px]"
                )}
            >
                {/* Header Actions */}
                <div className={cn("flex justify-between items-center p-4", isminimized ? "p-2 pr-4" : "border-b border-white/5")}>
                     {!isminimized && (
                         <div className="flex items-center gap-3">
                             <div className={cn("w-2 h-2 rounded-full animate-pulse", transferState.status === 'completed' ? 'bg-emerald-500' : 'bg-cyan-500')} />
                             <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Transfer</span>
                         </div>
                     )}

                     {isminimized ? (
                         <div className="flex items-center gap-3">
                             <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold", transferState.status === 'completed' ? 'bg-emerald-500' : 'bg-cyan-500')}>
                                 {Math.round(transferState.progress)}%
                             </div>
                             <button onClick={() => setIsMinimized(false)} className="text-gray-400 hover:text-white">
                                 <Maximize2 className="w-4 h-4" />
                             </button>
                         </div>
                     ) : (
                         <button onClick={() => setIsMinimized(true)} className="text-gray-400 hover:text-white transition-colors">
                             <Minus className="w-4 h-4" />
                         </button>
                     )}
                </div>

                {!isminimized && (
                    <div className="p-5">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-gray-400 shrink-0">
                                {getFileIcon(transferState.fileName)}
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-bold text-gray-200 truncate">{transferState.fileName}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500 font-mono">{formatSize(transferState.fileSize)}</span>
                                    {transferState.status !== 'completed' && <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-gray-400 font-mono">{formatSize(transferState.speed)}/s</span>}
                                </div>
                            </div>
                        </div>

                        <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                             <motion.div 
                                className={cn("h-full relative", transferState.status === 'completed' ? 'bg-emerald-500' : 'bg-cyan-500')}
                                initial={{ width: 0 }}
                                animate={{ width: `${transferState.progress}%` }}
                             >
                                 <div className="absolute inset-0 bg-white/30 animate-[shimmer_1s_infinite_linear]" style={{backgroundImage: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)'}}></div>
                             </motion.div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 font-medium">
                            <span>{Math.round(transferState.progress)}%</span>
                            <span>{transferState.status === 'completed' ? 'Done' : (transferState.eta ? `~${Math.ceil(transferState.eta)}s left` : 'Calculating...')}</span>
                        </div>
                    </div>
                )}
            </motion.div>
         )}
      </AnimatePresence>

         {/* JOIN / SHARE MODAL */}
         <AnimatePresence>
            {isJoinModalOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
                    onClick={(e) => {
                         if (e.target === e.currentTarget) setIsJoinModalOpen(false);
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-[#12121a] border border-white/10 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h3 className="text-xl font-bold text-white">Connect Device</h3>
                            <button onClick={() => setIsJoinModalOpen(false)}><X className="w-6 h-6 text-gray-400 hover:text-white" /></button>
                        </div>

                        {/* Tabs */}
                        <div className="flex p-2 bg-black/40">
                            {['scan', 'code', 'share'].map((t) => (
                                <button 
                                    key={t}
                                    onClick={() => setJoinTab(t as any)}
                                    className={cn(
                                        "flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all",
                                        joinTab === t ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                    )}
                                >
                                    {t === 'scan' ? 'Scan QR' : (t === 'code' ? 'Enter Code' : 'Share QR')}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="p-8 flex-1 overflow-y-auto min-h-[400px] flex flex-col items-center justify-center text-center">
                            {joinTab === 'scan' && (
                                <div className="w-full">
                                    <div className="aspect-square bg-black rounded-2xl overflow-hidden border border-white/10 relative">
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                                            Loading Camera...
                                        </div>
                                         {/* Dynamic import hack for browser-only lib */}
                                         {(() => {
                                            const QRScanner = require('../../components/QRScanner').default;
                                            return <QRScanner 
                                                onScan={(text: string) => {
                                                    // Handle URL or raw code
                                                    try {
                                                        const url = new URL(text);
                                                        const room = url.searchParams.get('room');
                                                        if (room) {
                                                            useNearShareStore.getState().setNetworkHash(room);
                                                            setIsJoinModalOpen(false);
                                                            alert(`Joined Network: ${room.slice(0,6)}...`);
                                                        }
                                                    } catch (e) {
                                                        // Fallback: assume raw code
                                                        useNearShareStore.getState().setNetworkHash(text);
                                                        setIsJoinModalOpen(false);
                                                        alert(`Joined Network: ${text.slice(0,6)}...`);
                                                    }
                                                }} 
                                            />
                                         })()}
                                    </div>
                                    <p className="mt-6 text-gray-400 text-sm">Point camera at another device's "Share QR" screen.</p>
                                </div>
                            )}

                            {joinTab === 'code' && (
                                <div className="w-full">
                                    <h4 className="text-lg font-bold text-white mb-6">Manual Entry</h4>
                                    <input 
                                        type="text" 
                                        placeholder="Enter Network ID" 
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-center text-xl font-mono text-cyan-400 focus:outline-none focus:border-cyan-500 transition-colors mb-6"
                                        defaultValue={networkHash || ''}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                useNearShareStore.getState().setNetworkHash(e.currentTarget.value);
                                                setIsJoinModalOpen(false);
                                            }
                                        }}
                                    />
                                    <p className="text-gray-500 text-sm">Enter the code displayed on the other device.</p>
                                </div>
                            )}

                            {joinTab === 'share' && networkHash && (
                                <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                    <div className="bg-white p-4 rounded-xl shadow-2xl mb-6">
                                       <img
                                            src=""
                                            ref={(img) => {
                                                if (img && !img.src) {
                                                     const url = `${window.location.origin}/share?room=${networkHash}`;
                                                     import('qrcode').then(QRCode => {
                                                        QRCode.toDataURL(url, { width: 300, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
                                                            .then(d => img.src = d);
                                                     });
                                                }
                                            }}
                                            className="w-64 h-64 block"
                                            alt="Network QR"
                                       />
                                    </div>
                                    <p className="font-mono text-cyan-400 text-3xl tracking-[0.2em] font-bold bg-cyan-500/10 px-6 py-4 rounded-xl border border-cyan-500/20 mb-2 select-all shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                                        {networkHash}
                                    </p>
                                    <p className="text-gray-500 text-xs uppercase tracking-wider font-bold">Network ID</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
         </AnimatePresence>

          {/* BROADCAST SELECTION MODAL */}
          <AnimatePresence>
            {isBroadcastModalOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
                    onClick={(e) => {
                         if (e.target === e.currentTarget) setIsBroadcastModalOpen(false);
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-[#12121a] border border-white/10 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Upload className="w-5 h-5 text-cyan-400" /> Broadcast File
                            </h3>
                            <button onClick={() => setIsBroadcastModalOpen(false)}><X className="w-6 h-6 text-gray-400 hover:text-white" /></button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">
                             <p className="text-sm text-gray-400 mb-4">Select recipients:</p>
                             <div className="space-y-2">
                                 {activeUsers.filter(u => u.socketId !== socketId).length === 0 ? (
                                     <p className="text-center text-gray-500 py-8">No other users in room.</p>
                                 ) : (
                                     activeUsers.filter(u => u.socketId !== socketId).map(user => (
                                         <div 
                                            key={user.socketId}
                                            onClick={() => {
                                                const newSet = new Set(selectedRecipients);
                                                if (newSet.has(user.socketId)) newSet.delete(user.socketId);
                                                else newSet.add(user.socketId);
                                                setSelectedRecipients(newSet);
                                            }}
                                            className={cn(
                                                "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all",
                                                selectedRecipients.has(user.socketId) 
                                                    ? "bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-900/10" 
                                                    : "bg-white/5 border-white/5 hover:bg-white/10"
                                            )}
                                         >
                                             <div className="flex items-center gap-3">
                                                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center font-bold text-white">
                                                     {user.displayName.charAt(0)}
                                                 </div>
                                                 <div>
                                                     <p className={cn("font-bold text-sm", selectedRecipients.has(user.socketId) ? "text-cyan-400" : "text-gray-300")}>{user.displayName}</p>
                                                     <p className="text-xs text-gray-500 font-mono">{user.networkHash.slice(0,6)}</p>
                                                 </div>
                                             </div>
                                             <div className={cn(
                                                 "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                                                 selectedRecipients.has(user.socketId) ? "bg-cyan-500 border-cyan-500" : "border-gray-600"
                                             )}>
                                                 {selectedRecipients.has(user.socketId) && <div className="w-2 h-2 bg-black rounded-full" />}
                                             </div>
                                         </div>
                                     ))
                                 )}
                             </div>
                        </div>

                        <div className="p-6 border-t border-white/5 bg-black/20">
                            <input 
                                type="file" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        broadcastFile(e.target.files[0], Array.from(selectedRecipients));
                                        setIsBroadcastModalOpen(false);
                                    }
                                }}
                            />
                            <button 
                                disabled={selectedRecipients.size === 0}
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                <span>Select File & Send to {selectedRecipients.size} Device{selectedRecipients.size !== 1 && 's'}</span>
                                <Upload className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
         </AnimatePresence>
    </div>
  );
}
