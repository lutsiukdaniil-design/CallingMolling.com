import { io } from "socket.io-client";

const socket = io(window.location.origin, {
  autoConnect: false,
  path: "/socket.io",
});

socket.on("connect_error", (err) => {
  console.error("Socket connection error:", err.message);
});

export default socket;
