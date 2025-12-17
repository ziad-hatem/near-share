import { Server as SocketIOServer } from "socket.io";
import { NextApiRequest } from "next";
import dbConnect from "../../lib/db";
import ActiveSession from "../../models/ActiveSession";

// Extended type for NextApiResponse to include socket server
type NextApiResponseWithSocket = any;

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (!res.socket.server.io) {
    console.log("Starting Socket.io Server...");
    
    const io = new SocketIOServer(res.socket.server, {
      path: "/socket.io",
      addTrailingSlash: false,
      cors: {
          origin: "*", 
          methods: ["GET", "POST"]
      }
    });

    io.on("connection", (socket) => {
      console.log("Client connected", socket.id);

      socket.on("join-room", async (data: { networkHash: string, displayName: string, fingerprint?: string }) => {
          const { networkHash, displayName, fingerprint } = data;
          if (!networkHash) return;

          // Leave previous rooms (except socket.id) to allow switching networks
          socket.rooms.forEach((room) => {
              if (room !== socket.id) socket.leave(room);
          });

          // 1. Store data on socket instance (In-Memory Speed)
          console.log(`[Socket] JOIN REQUEST: ${socket.id} -> Room: ${networkHash} (Name: ${displayName})`);
          
          socket.data.displayName = displayName;
          socket.data.networkHash = networkHash;
          socket.data.fingerprint = fingerprint;

          socket.join(networkHash);
          
          // 2. Immediate Broadcast to Room
          const sockets = await io.in(networkHash).fetchSockets();
          console.log(`[Socket] In-Memory Sockets in ${networkHash}: ${sockets.length}`);
          
          const inMemoryUsers = sockets.map(s => ({
              socketId: s.id,
              displayName: s.data.displayName,
              networkHash: s.data.networkHash,
              fingerprint: s.data.fingerprint
          }));
          io.to(networkHash).emit("room-update", inMemoryUsers);
          
          // 3. Persist Async
          try {
              console.log(`[Socket] Attempting DB Save for ${socket.id}...`);
              await dbConnect();
              const saved = await ActiveSession.findOneAndUpdate(
                  { socketId: socket.id },
                  { 
                      socketId: socket.id, 
                      networkHash, 
                      displayName,
                      fingerprint: fingerprint || 'unknown',
                      lastActive: new Date() 
                  },
                  { upsert: true, new: true }
              );
              console.log(`[Socket] DB Save Success: ${saved ? 'YES' : 'NO'}`);
          } catch (e) {
              console.error("[Socket] DB CRITICAL FAILURE:", e);
          }
      });
      
      socket.on("update-user", async (data: { displayName: string }) => {
          try {
              await dbConnect();
              const session = await ActiveSession.findOne({ socketId: socket.id });
              if (session) {
                  session.displayName = data.displayName;
                  await session.save();
                  
                  const roomUsers = await ActiveSession.find({ networkHash: session.networkHash });
                  io.to(session.networkHash).emit("room-update", roomUsers);
              }
          } catch (e) { console.error("Update error", e); }
      });

      socket.on("signal", (data: { signal: any, to: string }) => {
          io.to(data.to).emit("signal", {
              signal: data.signal,
              from: socket.id
          });
      });

      socket.on("private-message", (data: { content: string, to: string }) => {
          io.to(data.to).emit("private-message", {
              content: data.content,
              from: socket.id
          });
      });

      socket.on("disconnect", async () => {
          console.log("Client disconnected", socket.id);
          
          // 1. Immediate Broadcast (In-Memory)
          if (socket.data.networkHash) {
              const sockets = await io.in(socket.data.networkHash).fetchSockets();
              const inMemoryUsers = sockets.map(s => ({
                  socketId: s.id,
                  displayName: s.data.displayName,
                  networkHash: s.data.networkHash,
                  fingerprint: s.data.fingerprint
              }));
              io.to(socket.data.networkHash).emit("room-update", inMemoryUsers);
          }

          // 2. Cleanup DB Async
          try {
              await dbConnect();
              await ActiveSession.findOneAndDelete({ socketId: socket.id });
          } catch (e) {
              console.error("Disconnect error", e);
          }
      });
  });

    res.socket.server.io = io;
  }
  res.end();
};

export default ioHandler;
