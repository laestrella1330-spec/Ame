/**
 * CameraPermissionModal
 *
 * Shown once before the OS camera/mic permission dialog fires.
 * Explains WHY the app needs camera and microphone access.
 * Persists the user's acknowledgement in localStorage so it only
 * appears on the very first session-start attempt.
 *
 * Usage:
 *   const [showCamModal, setShowCamModal] = useState(!localStorage.getItem('cam_rationale_seen'));
 *
 *   {showCamModal && (
 *     <CameraPermissionModal onContinue={() => {
 *       localStorage.setItem('cam_rationale_seen', 'true');
 *       setShowCamModal(false);
 *       startMedia(); // call getUserMedia after modal is dismissed
 *     }} />
 *   )}
 */
interface CameraPermissionModalProps {
  onContinue: () => void;
}

const item = (icon: string, text: string) => (
  <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12 }}>
    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: 'rgba(226,232,240,0.85)', letterSpacing: '0.02em', lineHeight: 1.5 }}>{text}</span>
  </div>
);

export default function CameraPermissionModal({ onContinue }: CameraPermissionModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div style={{ background: 'rgba(15,10,30,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 22, padding: '28px 24px', maxWidth: 400, width: '100%', boxShadow: '0 0 40px rgba(139,92,246,0.2)' }}>

        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📷</div>
          <div>
            <p style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: '0.08em', margin: 0 }}>Camera & Microphone</p>
            <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 12, color: 'rgba(167,139,250,0.7)', margin: 0, letterSpacing: '0.06em' }}>Required for video chat</p>
          </div>
        </div>

        <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: 'rgba(226,232,240,0.75)', marginBottom: 16, lineHeight: 1.6 }}>
          Before we connect you, Ame needs access to your <strong style={{ color: 'white' }}>camera</strong> and <strong style={{ color: 'white' }}>microphone</strong>:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {item('🎥', 'Your video goes directly to your match — never recorded or stored by us.')}
          {item('🔇', 'You can turn off your camera or mute your mic at any time during a chat.')}
          {item('🔒', 'Streams are peer-to-peer (WebRTC) and do not pass through our servers.')}
          {item('💬', 'You can use Ame in text-only mode if you prefer not to share video.')}
        </div>

        <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 12, color: 'rgba(100,116,139,0.7)', marginBottom: 20, lineHeight: 1.5 }}>
          After tapping Continue, your device will ask for permission. If you deny it, you can still use text chat — or update the permission later in your device settings.
        </p>

        <button
          onClick={onContinue}
          style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #6d28d9, #8B5CF6)', border: 'none', borderRadius: 40, color: 'white', fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 0 24px rgba(139,92,246,0.5)' }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
