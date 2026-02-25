import { useState, Component } from "react";
import Home from "./components/Home.jsx";
import Room from "./components/Room.jsx";
import "./App.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("App error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-page">
          <h1 className="title">
            Calling<span className="accent">Molling</span>
          </h1>
          <p>Something went wrong.</p>
          <button
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeRoomId, setActiveRoomId] = useState(null);

  return (
    <ErrorBoundary>
      {activeRoomId ? (
        <Room roomId={activeRoomId} onLeave={() => setActiveRoomId(null)} />
      ) : (
        <Home onJoinRoom={(id) => setActiveRoomId(id)} />
      )}
    </ErrorBoundary>
  );
}
