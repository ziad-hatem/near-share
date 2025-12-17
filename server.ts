import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server, Socket } from "socket.io";
import dbConnect from "./lib/db";
import ActiveSession from "./models/ActiveSession";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      const { pathname } = parsedUrl;
 
      if (pathname?.startsWith("/socket.io")) {
           // Let socket.io handle it
           return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(server, {
      path: '/socket.io',
      addTrailingSlash: false,
      cors: {
          origin: "*", 
          methods: ["GET", "POST"]
      }
  });
  
  // Shared state in memory for speed (backup to Mongo)
  // Or just rely on Mongo for persistence.
  
  // NOTE: Simple in-memory room tracking for broadcast
  // Socket.io 'rooms' handles grouping, but we need user metadata list.

  io.on("connection", (socket: Socket) => {
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
              
              // Broadcast full list of users in this room
              const roomUsers = await ActiveSession.find({ networkHash });
              io.to(networkHash).emit("room-update", roomUsers);
              
          } catch (e) {
              console.error("DB Error on join", e);
          }
      });
      
      socket.on("update-user", async (data: { displayName: string }) => {
          try {
              await dbConnect();
              // Find the session for this socket
              const session = await ActiveSession.findOne({ socketId: socket.id });
              if (session) {
                  session.displayName = data.displayName;
                  await session.save();
                  
                  // Broadcast update
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

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
