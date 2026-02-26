import { useState, useCallback, useRef, useEffect } from 'react';

export function useMediaStream() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const streamRef = useRef<MediaStream | null>(null);
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const isCameraOffRef = useRef(false);

  useEffect(() => { facingModeRef.current = facingMode; }, [facingMode]);
  useEffect(() => { isCameraOffRef.current = isCameraOff; }, [isCameraOff]);

  const startMedia = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setError(null);
    } catch (err: any) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera/microphone access denied. Please allow access in your browser settings.'
          : 'Could not access camera/microphone.'
      );
    }
  }, []);

  const stopMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  const switchCamera = useCallback(async (): Promise<MediaStreamTrack | null> => {
    // Must stop the current video track FIRST — Android blocks opening a new
    // camera while the previous track is still live.
    const audioTracks = streamRef.current?.getAudioTracks() ?? [];
    streamRef.current?.getVideoTracks().forEach((t) => t.stop());

    const newFacing: 'user' | 'environment' =
      facingModeRef.current === 'user' ? 'environment' : 'user';

    let newVideoStream: MediaStream | null = null;

    // Strategy A: exact facingMode — semantically correct, no index guessing
    try {
      newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacing } },
        audio: false,
      });
    } catch {
      // Strategy B: soft facingMode hint (fallback for devices that reject "exact")
      try {
        newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacing },
          audio: false,
        });
      } catch {
        return null;
      }
    }

    const newVideoTrack = newVideoStream?.getVideoTracks()[0];
    if (!newVideoTrack) return null;
    if (isCameraOffRef.current) newVideoTrack.enabled = false;

    const newStream = new MediaStream([...audioTracks, newVideoTrack]);
    streamRef.current = newStream;
    setStream(newStream);

    facingModeRef.current = newFacing;
    setFacingMode(newFacing);

    return newVideoTrack;
  }, []);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => { track.enabled = !track.enabled; });
      setIsMuted((prev) => !prev);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => { track.enabled = !track.enabled; });
      setIsCameraOff((prev) => !prev);
    }
  }, []);

  useEffect(() => { return () => { stopMedia(); }; }, [stopMedia]);

  return { stream, error, isMuted, isCameraOff, facingMode, startMedia, stopMedia, switchCamera, toggleMute, toggleCamera };
}
