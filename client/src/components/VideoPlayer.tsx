import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  label?: string;
  mirror?: boolean;
  videoStyle?: React.CSSProperties;
}

export default function VideoPlayer({ stream, muted = false, className = '', label, mirror = false, videoStyle }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const computedVideoStyle: React.CSSProperties = {
    ...(mirror ? { transform: 'scaleX(-1)' } : {}),
    ...videoStyle,
  };

  return (
    <div className={`relative bg-slate-950 overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
        style={Object.keys(computedVideoStyle).length ? computedVideoStyle : undefined}
      />
      {!stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-950 to-slate-900">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="text-white/20 text-xs font-medium tracking-widest uppercase">No video</span>
        </div>
      )}
      {label && (
        <div className="absolute bottom-2 left-2">
          <span className="text-xs text-white/80 font-semibold bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
