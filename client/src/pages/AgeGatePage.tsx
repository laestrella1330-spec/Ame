/**
 * AgeGatePage — shown before login/register to any new visitor.
 *
 * Flow:
 *  1. User enters date of birth.
 *  2. If calculated age ≥ 18  → store "age_verified=true" in localStorage
 *     and redirect to /login.
 *  3. If calculated age < 18  → show permanent block screen (no bypass).
 *
 * Returning users who already passed the gate skip it automatically.
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function calculateAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export default function AgeGatePage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState('');
  const [day, setDay]   = useState('');
  const [year, setYear] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [error, setError]     = useState('');

  // Already verified — skip straight to login
  useEffect(() => {
    if (localStorage.getItem('age_verified') === 'true') {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleConfirm = () => {
    setError('');
    const m = parseInt(month);
    const d = parseInt(day);
    const y = parseInt(year);

    if (!m || !d || !y || y < 1900 || y > new Date().getFullYear()) {
      setError('Please enter a valid date of birth.');
      return;
    }

    const dob = new Date(y, m - 1, d);
    if (isNaN(dob.getTime())) {
      setError('Please enter a valid date of birth.');
      return;
    }

    const age = calculateAge(dob);

    if (age < 18) {
      setBlocked(true);
      return;
    }

    // Store DOB for server-side persistence during registration
    const pad = (n: number) => String(n).padStart(2, '0');
    localStorage.setItem('pending_dob', `${y}-${pad(m)}-${pad(d)}`);
    localStorage.setItem('age_verified', 'true');
    navigate('/login');
  };

  const sel: React.CSSProperties = {
    background: 'rgba(139,92,246,0.08)',
    color: 'white',
    border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 10,
    padding: '10px 12px',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: 15,
    outline: 'none',
    cursor: 'pointer',
  };

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 20, padding: '32px 28px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔞</div>
          <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 20, color: '#f87171', marginBottom: 8 }}>Access Restricted</h1>
          <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 15, color: 'rgba(226,232,240,0.7)', lineHeight: 1.6 }}>
            Ame is an adult platform for users aged 18 and above. You are not old enough to access this service.
          </p>
          <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 12, color: 'rgba(100,116,139,0.7)', marginTop: 16 }}>
            If you believe this is an error, contact{' '}
            <span style={{ color: 'rgba(167,139,250,0.8)' }}>support@ame.app</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(rgba(139,92,246,0.12) 1px, transparent 1px)', backgroundSize: '26px 26px', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '10%', right: '5%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(109,40,217,0.28) 0%, transparent 70%)', filter: 'blur(55px)', pointerEvents: 'none', zIndex: 0 }} />

      <div className="w-full max-w-sm" style={{ position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div className="text-center mb-8 animate-float">
          <img src="/logo.png" alt="Ame" style={{ height: 72, margin: '0 auto 14px', filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.55))' }} />
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20, padding: '28px 24px' }}>
          {/* 18+ badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <span style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', padding: '3px 10px', borderRadius: 6 }}>18+</span>
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, letterSpacing: '0.14em', color: 'rgba(167,139,250,0.8)', textTransform: 'uppercase' }}>Age Verification</span>
          </div>

          <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: 'rgba(226,232,240,0.75)', marginBottom: 20, lineHeight: 1.6 }}>
            Ame is an adult platform. You must be <strong style={{ color: 'white' }}>18 or older</strong> to continue. Please enter your date of birth.
          </p>

          {/* DOB inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: 8, marginBottom: 16 }}>
            <select value={month} onChange={(e) => setMonth(e.target.value)} style={sel}>
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1)}>{m}</option>
              ))}
            </select>
            <select value={day} onChange={(e) => setDay(e.target.value)} style={sel}>
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>{d}</option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} style={sel}>
              <option value="">Year</option>
              {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>

          {error && (
            <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 13, color: '#f87171', marginBottom: 12 }}>{error}</p>
          )}

          <button
            onClick={handleConfirm}
            disabled={!month || !day || !year}
            style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg, #6d28d9, #8B5CF6)', border: 'none', borderRadius: 40, color: 'white', fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: (!month || !day || !year) ? 'not-allowed' : 'pointer', opacity: (!month || !day || !year) ? 0.5 : 1, boxShadow: '0 0 24px rgba(139,92,246,0.5)', marginBottom: 16 }}
          >
            Confirm Age
          </button>

          <p style={{ textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: 11, color: 'rgba(100,116,139,0.7)', lineHeight: 1.5 }}>
            By continuing you agree to our{' '}
            <Link to="/terms" style={{ color: 'rgba(167,139,250,0.75)' }}>Terms of Service</Link>{' '}and{' '}
            <Link to="/privacy" style={{ color: 'rgba(167,139,250,0.75)' }}>Privacy Policy</Link>.
            Your date of birth is used to verify you are 18+ and stored securely on our servers.
          </p>
        </div>
      </div>
    </div>
  );
}
