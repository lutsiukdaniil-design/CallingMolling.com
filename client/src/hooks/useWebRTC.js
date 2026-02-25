import { useRef, useState, useCallback, useEffect } from "react";
import socket from "../services/socket.js";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export default function useWebRTC(roomId) {
  const [connectionState, setConnectionState] = useState("new");
  const [isMuted, setIsMuted] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const pendingCandidatesRef = useRef([]);
  const offerCreatedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    offerCreatedRef.current = false;
    setRemoteStream(null);
    setConnectionState("new");
    setIsMuted(false);
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

    const pc = new RTCPeerConnection(ICE_SERVERS);

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

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pcRef.current = pc;
    return pc;
  }, [roomId]);

  const createOffer = useCallback(async () => {
    if (offerCreatedRef.current) return;
    offerCreatedRef.current = true;

    try {
      const pc = createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", roomId, offer);
      setConnectionState("connecting");
    } catch (err) {
      console.error("Failed to create offer:", err);
      setError("Failed to establish connection.");
      offerCreatedRef.current = false;
    }
  }, [roomId, createPeerConnection]);

  const handleOffer = useCallback(
    async (offer) => {
      try {
        const pc = createPeerConnection();
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
    remoteStream,
    error,
    start,
    toggleMute,
    endCall,
  };
}
