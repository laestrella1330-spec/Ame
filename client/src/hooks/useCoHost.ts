/**
 * useCoHost — Phase 3: AI Co-Host (silent mode)
 *
 * Detects silence in the remote stream using Web Audio API.
 * After SILENCE_THRESHOLD_MS of quiet, emits a whisper prompt.
 * Prompts are dismissible and never auto-play audio.
 *
 * No server round-trip needed — prompt bank is local.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { ConnectionState } from './useWebRTC';

const SILENCE_THRESHOLD_MS = 7000; // 7 seconds of detected silence
const SILENCE_AUDIO_LEVEL = 0.01;  // RMS below this = "silent"

const PROMPT_BANK = [
  "Ask them: what's the most interesting thing that happened to you this week?",
  "Try: if you could switch lives with anyone for a day, who would it be?",
  "Ask: what's something you're really good at that most people don't know about?",
  "Try: what's the last thing that made you genuinely laugh out loud?",
  "Ask: if you had a free day with no obligations, what would you do?",
  "Try: what's a movie or show you could re-watch endlessly?",
  "Ask: what's something you've always wanted to try but haven't yet?",
];

function randomPrompt(): string {
  return PROMPT_BANK[Math.floor(Math.random() * PROMPT_BANK.length)];
}

export interface CoHostState {
  whisper: string | null;
  dismiss: () => void;
}

export function useCoHost(
  remoteStream: MediaStream | null,
  connectionState: ConnectionState,
  enabled: boolean,
): CoHostState {
  const [whisper, setWhisper] = useState<string | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastPromptRef = useRef<number>(0);

  const dismiss = useCallback(() => setWhisper(null), []);

  // Cleanup on unmount or disconnect
  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    analyserRef.current = null;
    silenceTimerRef.current = null;
    animFrameRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled || connectionState !== 'connected' || !remoteStream) {
      cleanup();
      setWhisper(null);
      return;
    }

    // Set up Web Audio analyser on remote stream
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(remoteStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Float32Array(analyser.frequencyBinCount);
    let consecutiveSilentFrames = 0;
    const framesForThreshold = Math.ceil(SILENCE_THRESHOLD_MS / (1000 / 60));

    const tick = () => {
      if (!analyserRef.current) return;
      analyser.getFloatTimeDomainData(dataArray);
      const rms = Math.sqrt(dataArray.reduce((s, v) => s + v * v, 0) / dataArray.length);

      if (rms < SILENCE_AUDIO_LEVEL) {
        consecutiveSilentFrames++;
        if (consecutiveSilentFrames >= framesForThreshold) {
          // Only suggest a new prompt every 30s to avoid spam
          const now = Date.now();
          if (now - lastPromptRef.current > 30000) {
            lastPromptRef.current = now;
            setWhisper(randomPrompt());
          }
          consecutiveSilentFrames = 0; // reset so we don't re-fire every frame
        }
      } else {
        consecutiveSilentFrames = 0;
        // Clear whisper once conversation resumes
        setWhisper(null);
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return cleanup;
  }, [enabled, connectionState, remoteStream, cleanup]);

  // Clear on disconnect
  useEffect(() => {
    if (connectionState !== 'connected') setWhisper(null);
  }, [connectionState]);

  return { whisper, dismiss };
}
