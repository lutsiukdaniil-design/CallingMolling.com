# CallingMolling

Peer-to-peer audio calling app. Create a room, share the code, talk. No sign-up, no servers in between, just WebRTC.

Live at **[callingmolling.com](https://callingmolling.com)**

## How it works

1. One person creates a room and gets a 6-character code
2. The other person enters the code and joins
3. Audio connection is established directly between browsers via WebRTC

The server only handles signaling (exchanging connection info). The actual audio goes peer-to-peer.

## Tech

- **Frontend:** React + Vite
- **Backend:** Node.js + Express + Socket.io (signaling only)
- **WebRTC** with Google STUN servers for NAT traversal

## Run locally

```bash
# server
cd server && npm install && npm run dev

# client (in another terminal)
cd client && npm install && npm run dev
```

Server starts on `localhost:3001`, client on `localhost:5173`.

## Project structure

```
server/
  index.js          signaling server, room management

client/src/
  hooks/useWebRTC.js    WebRTC logic, mic access, ICE handling
  components/Home.jsx   create/join room UI
  components/Room.jsx   call screen with controls
  services/socket.js    socket.io client
  utils/roomId.js       room code generator
```

## Security

- Room IDs validated on both client and server
- CORS restricted to production domain
- Signaling events verified against socket's actual room
- Stale rooms auto-cleaned after 30 min
- All WebRTC operations wrapped in error handling
