import { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  label?: string;
  mirror?: boolean;
}

export default function VideoPlayer({ stream, muted = false, className = '', label, mirror = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative bg-slate-900 rounded-lg overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
        style={mirror ? { transform: 'scaleX(-1)' } : undefined}
      />
      {label && (
        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          {label}
        </div>
      )}
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
          No video
        </div>
      )}
    </div>
  );
}
