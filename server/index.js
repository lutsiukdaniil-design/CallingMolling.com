const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

const ALLOWED_ORIGINS = [
  "https://callingmolling.com",
  "https://www.callingmolling.com",
  "http://localhost:5173",
];

app.use(cors({ origin: ALLOWED_ORIGINS }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
});

// roomId → { sockets: Set<socketId>, lastActivity: timestamp }
const rooms = new Map();

const ROOM_ID_REGEX = /^[A-Z2-9]{6}$/;
const ROOM_TTL_MS = 30 * 60 * 1000; // 30 minutes

function isValidRoomId(roomId) {
  return typeof roomId === "string" && ROOM_ID_REGEX.test(roomId);
}

// Cleanup stale rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    if (room.sockets.size === 0 && now - room.lastActivity > ROOM_TTL_MS) {
      rooms.delete(roomId);
    }
  }
}, 5 * 60 * 1000);

io.on("connection", (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on("join-room", (roomId, callback) => {
    if (typeof callback !== "function") return;

    if (!isValidRoomId(roomId)) {
      return callback({ success: false, error: "Invalid room code" });
    }

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { sockets: new Set(), lastActivity: Date.now() });
    }

    const room = rooms.get(roomId);

    if (room.sockets.size >= 2) {
      return callback({ success: false, error: "Room is full" });
    }

    const isInitiator = room.sockets.size === 0;
    room.sockets.add(socket.id);
    room.lastActivity = Date.now();
    socket.join(roomId);
    socket.data.roomId = roomId;

    callback({ success: true, isInitiator });

    if (!isInitiator) {
      socket.to(roomId).emit("peer-joined");
    }

    console.log(`${socket.id} joined room ${roomId} (${room.sockets.size}/2)`);
  });

  // Signaling — only relay to the room the socket actually joined
  socket.on("offer", (roomId, offer) => {
    if (roomId !== socket.data.roomId) return;
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", (roomId, answer) => {
    if (roomId !== socket.data.roomId) return;
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", (roomId, candidate) => {
    if (roomId !== socket.data.roomId) return;
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("leave-room", () => {
    handleLeave(socket);
  });

  socket.on("disconnect", () => {
    console.log(`Disconnected: ${socket.id}`);
    handleLeave(socket);
  });
});

function handleLeave(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (room) {
    room.sockets.delete(socket.id);
    room.lastActivity = Date.now();
    socket.to(roomId).emit("peer-left");

    if (room.sockets.size === 0) {
      rooms.delete(roomId);
    }
  }

  socket.leave(roomId);
  socket.data.roomId = null;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on http://localhost:${PORT}`);
});
