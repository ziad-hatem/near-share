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

          socket.join(networkHash);
          
          try {
              await dbConnect();
              
              const session = await ActiveSession.findOneAndUpdate(
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
              
              const roomUsers = await ActiveSession.find({ networkHash });
              io.to(networkHash).emit("room-update", roomUsers);
              
          } catch (e) {
              console.error("DB Error on join", e);
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
          try {
              await dbConnect();
              const session = await ActiveSession.findOneAndDelete({ socketId: socket.id });
              
              if (session) {
                  const roomUsers = await ActiveSession.find({ networkHash: session.networkHash });
                  io.to(session.networkHash).emit("room-update", roomUsers);
              }
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
