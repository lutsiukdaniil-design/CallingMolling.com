export default function StatusIndicator({ state }) {
  const config = {
    new: { color: "var(--status-gray)", text: "Initializing..." },
    waiting: { color: "var(--status-yellow)", text: "Waiting for peer..." },
    connecting: { color: "var(--status-yellow)", text: "Connecting..." },
    connected: { color: "var(--status-green)", text: "Connected" },
    disconnected: { color: "var(--status-red)", text: "Peer disconnected" },
    failed: { color: "var(--status-red)", text: "Connection failed" },
    closed: { color: "var(--status-gray)", text: "Call ended" },
  };

  const { color, text } = config[state] || config.new;
  const isPulsing = state === "waiting" || state === "connecting";

  return (
    <div className="status-indicator">
      <span
        className={`status-dot ${isPulsing ? "pulse" : ""}`}
        style={{ backgroundColor: color }}
      />
      <span className="status-text">{text}</span>
    </div>
  );
}
