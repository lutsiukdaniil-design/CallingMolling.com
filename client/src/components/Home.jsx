import { useState } from "react";
import { generateRoomId, isValidRoomId } from "../utils/roomId.js";

const faqItems = [
  {
    q: "How do I start a call?",
    a: 'Click "Create Room" to get a unique room code, then share it with the person you want to call. They enter the code in "Join Room" and you\'re connected instantly.',
  },
  {
    q: "Do I need to sign up?",
    a: "No. CallingMolling requires no account, no downloads, and no personal information. Just open the site and start calling.",
  },
  {
    q: "Is it secure?",
    a: "Yes. All calls use WebRTC peer-to-peer connections, meaning audio and video travel directly between you and the other person — our server is only used to establish the connection.",
  },
  {
    q: "Can I use video?",
    a: "Yes. Once connected, click the camera button to enable video. Both participants can toggle video on and off at any time during the call.",
  },
  {
    q: "What browsers are supported?",
    a: "CallingMolling works in all modern browsers — Chrome, Firefox, Safari, and Edge. We recommend keeping your browser up to date for the best experience.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. The app is fully responsive and works on iOS Safari, Android Chrome, and other mobile browsers. No app install needed.",
  },
];

export default function Home({ onJoinRoom }) {
  const [joinId, setJoinId] = useState("");
  const [inputError, setInputError] = useState("");
  const [openFaq, setOpenFaq] = useState(null);

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

      <section className="faq">
        <h2 className="faq-title">Frequently Asked Questions</h2>
        <div className="faq-list">
          {faqItems.map((item, i) => (
            <div key={i} className={`faq-item${openFaq === i ? " faq-item--open" : ""}`}>
              <button
                className="faq-question"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
              >
                <span>{item.q}</span>
                <svg
                  className="faq-chevron"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 8 10 12 14 8" />
                </svg>
              </button>
              <div className="faq-answer">
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
