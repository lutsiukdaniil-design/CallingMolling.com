import { useEffect, useRef, useState } from "react";
import useWebRTC from "../hooks/useWebRTC.js";
import StatusIndicator from "./StatusIndicator.jsx";

export default function Room({ roomId, onLeave }) {
  const {
    connectionState,
    isMuted,
    isVideoEnabled,
    localStream,
    remoteStream,
    error,
    start,
    toggleMute,
    toggleVideo,
    endCall,
  } = useWebRTC(roomId);

  const audioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);

  useEffect(() => {
    start();
  }, [start]);

  // Attach remote stream to audio and video elements
  // remoteHasVideo in deps: video element is conditionally rendered,
  // so srcObject must be re-assigned when the element appears
  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, remoteHasVideo]);

  // Detect remote video track presence and mute/unmute
  useEffect(() => {
    if (!remoteStream) {
      setRemoteHasVideo(false);
      return;
    }

    const checkVideo = () => {
      const videoTracks = remoteStream.getVideoTracks();
      const hasActive = videoTracks.some((t) => t.enabled && !t.muted);
      setRemoteHasVideo(hasActive);
    };

    checkVideo();

    const handleTrackEvent = () => checkVideo();
    remoteStream.addEventListener("addtrack", handleTrackEvent);
    remoteStream.addEventListener("removetrack", handleTrackEvent);

    // Listen for mute/unmute on each video track
    const videoTracks = remoteStream.getVideoTracks();
    videoTracks.forEach((track) => {
      track.addEventListener("mute", handleTrackEvent);
      track.addEventListener("unmute", handleTrackEvent);
    });

    return () => {
      remoteStream.removeEventListener("addtrack", handleTrackEvent);
      remoteStream.removeEventListener("removetrack", handleTrackEvent);
      videoTracks.forEach((track) => {
        track.removeEventListener("mute", handleTrackEvent);
        track.removeEventListener("unmute", handleTrackEvent);
      });
    };
  }, [remoteStream]);

  // Attach local stream to local video preview
  // isVideoEnabled in deps: PiP element is conditionally rendered,
  // so srcObject must be re-assigned when the element appears
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoEnabled]);

  const handleEndCall = () => {
    endCall();
    onLeave();
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}/${roomId}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Fallback: select text so user can copy manually
      });
  };

  const videoActive = isVideoEnabled || remoteHasVideo;

  return (
    <div className={`room ${videoActive ? "room--video" : ""}`}>
      {videoActive && (
        <>
          <div className="video-container">
            {remoteHasVideo ? (
              <video
                ref={remoteVideoRef}
                className="remote-video"
                autoPlay
                playsInline
              />
            ) : (
              <div className="remote-avatar">
                <svg
                  viewBox="0 0 24 24"
                  width="48"
                  height="48"
                  fill="currentColor"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
          </div>

          {isVideoEnabled && (
            <div className="local-video-pip">
              <video
                ref={localVideoRef}
                className="local-video"
                autoPlay
                playsInline
                muted
              />
            </div>
          )}
        </>
      )}

      <div className="room-header">
        <h1 className="title">
          Calling<span className="accent">Molling</span>
        </h1>
      </div>

      <div className="room-card">
        <div className="room-id-section">
          <span className="room-label">Room Link</span>
          <div
            className="room-id-display"
            onClick={copyRoomLink}
            title="Click to copy link"
          >
            {roomId.split("").map((char, i) => (
              <span key={i} className="room-char">
                {char}
              </span>
            ))}
          </div>
          <span className="copy-hint">
            {copied ? "Copied!" : "Click to copy link"}
          </span>
        </div>

        <StatusIndicator state={connectionState} />

        {error && <div className="error-banner">{error}</div>}

        <div className="controls">
          <button
            className={`btn-icon ${isMuted ? "btn-danger" : ""}`}
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="currentColor"
              >
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="currentColor"
              >
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              </svg>
            )}
          </button>

          <button
            className={`btn-icon ${isVideoEnabled ? "btn-active" : ""}`}
            onClick={toggleVideo}
            title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {isVideoEnabled ? (
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="currentColor"
              >
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="currentColor"
              >
                <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
              </svg>
            )}
          </button>

          <button
            className="btn-icon btn-end"
            onClick={handleEndCall}
            title="End call"
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
            >
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
          </button>
        </div>
      </div>

      <audio ref={audioRef} autoPlay playsInline />
    </div>
  );
}
