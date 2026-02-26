import { useRef, useState, useCallback, useEffect } from "react";
import socket from "../services/socket.js";

const STUN_ONLY = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

async function fetchIceServers() {
  try {
    const res = await fetch("/turn-credentials");
    if (!res.ok) return STUN_ONLY;
    const data = await res.json();
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        ...data.uris.map((uri) => ({
          urls: uri,
          username: data.username,
          credential: data.credential,
        })),
      ],
    };
  } catch {
    return STUN_ONLY;
  }
}

export default function useWebRTC(roomId) {
  const [connectionState, setConnectionState] = useState("new");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const pendingCandidatesRef = useRef([]);
  const offerCreatedRef = useRef(false);
  const iceConfigRef = useRef(STUN_ONLY);
  const videoTrackRef = useRef(null);
  const videoSenderRef = useRef(null);
  const makingOfferRef = useRef(false);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (videoTrackRef.current) {
      videoTrackRef.current.stop();
      videoTrackRef.current = null;
    }
    videoSenderRef.current = null;
    offerCreatedRef.current = false;
    makingOfferRef.current = false;
    setRemoteStream(null);
    setLocalStream(null);
    setConnectionState("new");
    setIsMuted(false);
    setIsVideoEnabled(false);
    setError(null);
    pendingCandidatesRef.current = [];
  }, []);

  const removeSocketListeners = useCallback(() => {
    socket.off("peer-joined");
    socket.off("offer");
    socket.off("answer");
    socket.off("ice-candidate");
    socket.off("peer-left");
  }, []);

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection(iceConfigRef.current);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", roomId, e.candidate);
      }
    };

    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === "failed") {
        setError("Connection failed. The peer may be behind a strict firewall.");
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        setError("ICE connection failed. Try refreshing the page.");
      }
    };

    pc.onnegotiationneeded = async () => {
      if (makingOfferRef.current) return;
      if (pc.signalingState !== "stable") return;
      try {
        makingOfferRef.current = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", roomId, pc.localDescription);
      } catch (err) {
        console.error("Renegotiation failed:", err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, localStreamRef.current);
        if (track.kind === "video") {
          videoSenderRef.current = sender;
        }
      });
    }

    pcRef.current = pc;
    return pc;
  }, [roomId]);

  const createOffer = useCallback(async () => {
    if (offerCreatedRef.current) return;
    offerCreatedRef.current = true;

    try {
      makingOfferRef.current = true;
      const pc = createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", roomId, offer);
      setConnectionState("connecting");
    } catch (err) {
      console.error("Failed to create offer:", err);
      setError("Failed to establish connection.");
      offerCreatedRef.current = false;
    } finally {
      makingOfferRef.current = false;
    }
  }, [roomId, createPeerConnection]);

  const handleOffer = useCallback(
    async (offer) => {
      try {
        let pc = pcRef.current;
        if (!pc) {
          pc = createPeerConnection();
        } else {
          // Glare protection: polite peer rolls back
          if (pc.signalingState !== "stable") {
            if (!isInitiatorRef.current) {
              await pc.setLocalDescription({ type: "rollback" });
              makingOfferRef.current = false;
            } else {
              return;
            }
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        for (const candidate of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", roomId, answer);
        setConnectionState("connecting");
      } catch (err) {
        console.error("Failed to handle offer:", err);
        setError("Failed to establish connection.");
      }
    },
    [roomId, createPeerConnection]
  );

  const handleAnswer = useCallback(async (answer) => {
    if (!pcRef.current) return;
    try {
      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );

      for (const candidate of pendingCandidatesRef.current) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
    } catch (err) {
      console.error("Failed to handle answer:", err);
      setError("Failed to establish connection.");
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate) => {
    if (!pcRef.current || !pcRef.current.remoteDescription) {
      pendingCandidatesRef.current.push(candidate);
      return;
    }
    try {
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Failed to add ICE candidate:", err);
    }
  }, []);

  const handlePeerLeft = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    offerCreatedRef.current = false;
    videoSenderRef.current = null;
    makingOfferRef.current = false;
    setRemoteStream(null);
    setConnectionState("disconnected");
    pendingCandidatesRef.current = [];
  }, []);

  const start = useCallback(async () => {
    // Get microphone access
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("Microphone access denied:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access and try again."
          : "Could not access microphone. Check that it is connected and not in use."
      );
      setConnectionState("failed");
      return;
    }
    localStreamRef.current = stream;
    setLocalStream(stream);

    iceConfigRef.current = await fetchIceServers();

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("join-room", roomId, (response) => {
      if (!response || !response.success) {
        const msg = (response && response.error) || "Failed to join room";
        setError(msg);
        cleanup();
        return;
      }
      isInitiatorRef.current = response.isInitiator;
      setConnectionState("waiting");
    });

    // Remove old listeners before adding new ones
    removeSocketListeners();

    socket.on("peer-joined", () => {
      createOffer();
    });

    socket.on("offer", (offer) => {
      handleOffer(offer);
    });

    socket.on("answer", (answer) => {
      handleAnswer(answer);
    });

    socket.on("ice-candidate", (candidate) => {
      handleIceCandidate(candidate);
    });

    socket.on("peer-left", () => {
      handlePeerLeft();
    });
  }, [
    roomId,
    cleanup,
    removeSocketListeners,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handlePeerLeft,
  ]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((prev) => !prev);
  }, []);

  const toggleVideo = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;

    // Currently sending video → turn off via replaceTrack(null)
    // This stops RTP, causing remote track to fire 'mute'
    if (videoSenderRef.current && videoSenderRef.current.track) {
      await videoSenderRef.current.replaceTrack(null);
      setIsVideoEnabled(false);
      return;
    }

    // Sender exists but track was nulled → re-enable with existing live track
    if (
      videoSenderRef.current &&
      videoTrackRef.current &&
      videoTrackRef.current.readyState === "live"
    ) {
      await videoSenderRef.current.replaceTrack(videoTrackRef.current);
      setIsVideoEnabled(true);
      return;
    }

    // First time or track was stopped → acquire new camera
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      const videoTrack = videoStream.getVideoTracks()[0];
      videoTrackRef.current = videoTrack;

      // Add video track to local stream for PiP preview
      if (localStreamRef.current) {
        localStreamRef.current.addTrack(videoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      if (videoSenderRef.current) {
        // Reuse existing sender (track ended, sender still has transceiver)
        await videoSenderRef.current.replaceTrack(videoTrack);
      } else {
        // First time — addTrack triggers onnegotiationneeded
        videoSenderRef.current = pc.addTrack(videoTrack, localStreamRef.current);
      }

      setIsVideoEnabled(true);
    } catch (err) {
      console.error("Camera access failed:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera access and try again."
          : "Could not access camera. Check that it is connected and not in use."
      );
    }
  }, []);

  const endCall = useCallback(() => {
    socket.emit("leave-room");
    removeSocketListeners();
    socket.disconnect();
    cleanup();
  }, [cleanup, removeSocketListeners]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socket.emit("leave-room");
      removeSocketListeners();
      socket.disconnect();
      cleanup();
    };
  }, [cleanup, removeSocketListeners]);

  return {
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
  };
}
