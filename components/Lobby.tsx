
'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, Unlock, Users, Plus, LogIn } from 'lucide-react';

interface LobbyProps {
  onJoin: (roomName: string) => void;
  initialRoom?: string | null;
}

export default function Lobby({ onJoin, initialRoom }: LobbyProps) {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [roomName, setRoomName] = useState(initialRoom || '');
  
  // Auto-switch to join mode if initialRoom is provided
  useEffect(() => {
    if (initialRoom) {
        setMode('join');
        setRoomName(initialRoom);
    }
  }, [initialRoom]);
  
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setLoading(true);
    setError('');

    try {
        const res = await fetch('/api/nearshare/room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: mode, name: roomName, password })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            setError(data.error || 'Failed');
        } else {
            onJoin(roomName);
        }
    } catch (err) {
        setError('Network error');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto w-full">
         <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-[#161621] border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
         >
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600" />
             
             <div className="mb-8">
                 <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                     <Users className="w-8 h-8 text-cyan-400" />
                 </div>
                 <h2 className="text-2xl font-bold text-white tracking-tight">
                     {mode === 'join' ? 'Join Local Room' : 'Create Secure Room'}
                 </h2>
                 <p className="text-gray-500 text-sm mt-2">
                     {mode === 'join' ? 'Enter credentials to connect' : 'Set up a private space for sharing'}
                 </p>
             </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-left space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Room Name</label>
                    <input 
                        type="text" 
                        value={roomName}
                        onChange={e => setRoomName(e.target.value)}
                        placeholder="e.g. DesignTeam"
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:outline-none transition-colors font-medium placeholder:text-gray-600"
                    />
                </div>

                <div className="text-left space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 flex justify-between">
                         <span>Password {mode === 'create' && '(Optional)'}</span>
                         <span className="text-cyan-500">{password ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3 opacity-50" />}</span>
                    </label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={mode === 'create' ? "Leave blank for public" : "Required if set"}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:outline-none transition-colors font-medium placeholder:text-gray-600"
                    />
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm py-2 rounded-lg font-medium">
                        {error}
                    </div>
                )}

                <button 
                    disabled={loading}
                    type="submit"
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-4 rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                >
                    {loading ? 'Processing...' : (mode === 'join' ? 'Join Room' : 'Create Room')}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/5">
                <button 
                    onClick={() => { setMode(mode === 'join' ? 'create' : 'join'); setError(''); setPassword(''); }}
                    className="text-gray-400 text-sm font-medium hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                    {mode === 'join' ? (
                        <>Need a room? <span className="text-cyan-400">Create one</span></>
                    ) : (
                        <>Have a room? <span className="text-cyan-400">Join existing</span></>
                    )}
                </button>
            </div>
         </motion.div>
    </div>
  );
}
