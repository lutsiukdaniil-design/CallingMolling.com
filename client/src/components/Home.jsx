import { useState } from "react";
import { generateRoomId, isValidRoomId } from "../utils/roomId.js";

export default function Home({ onJoinRoom }) {
  const [joinId, setJoinId] = useState("");
  const [inputError, setInputError] = useState("");

  const handleCreate = () => {
    const id = generateRoomId();
    onJoinRoom(id);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    const trimmed = joinId.trim().toUpperCase();
    if (trimmed.length === 0) return;
    if (!isValidRoomId(trimmed)) {
      setInputError("Room code must be 6 characters (letters A-Z, digits 2-9)");
      return;
    }
    setInputError("");
    onJoinRoom(trimmed);
  };

  return (
    <div className="home">
      <div className="hero">
        <h1 className="title">
          Calling<span className="accent">Molling</span>
        </h1>
        <p className="subtitle">Secure peer-to-peer calls</p>
      </div>

      <div className="cards">
        <div className="card">
          <h2>Create Room</h2>
          <p>Start a new call and share the room code</p>
          <button className="btn btn-primary" onClick={handleCreate}>
            Create Room
          </button>
        </div>

        <div className="divider">or</div>

        <div className="card">
          <h2>Join Room</h2>
          <p>Enter a room code to join an existing call</p>
          <form onSubmit={handleJoin} className="join-form">
            <input
              type="text"
              className="input"
              placeholder="Room code"
              value={joinId}
              onChange={(e) => {
                setJoinId(e.target.value);
                setInputError("");
              }}
              maxLength={6}
              autoFocus
            />
            {inputError && <span className="input-error">{inputError}</span>}
            <button type="submit" className="btn btn-secondary">
              Join Room
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
