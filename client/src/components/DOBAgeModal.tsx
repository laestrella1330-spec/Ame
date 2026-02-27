/**
 * DOBAgeModal — full-screen overlay shown on first visit to any page.
 *
 * Rendered globally in App.tsx. Blocks all content until the user
 * confirms they are 18+. Stores age_verified + pending_dob in localStorage.
 *
 * Skipped on /admin/* routes so admin logins are not affected.
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';

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

interface Props {
  onVerified: () => void;
}

export default function DOBAgeModal({ onVerified }: Props) {
  const location = useLocation();
  const [month, setMonth] = useState('');
  const [day, setDay]     = useState('');
  const [year, setYear]   = useState('');
  const [blocked, setBlocked] = useState(false);
  const [error, setError]     = useState('');

  // Skip for admin routes
  if (location.pathname.startsWith('/admin')) return null;

  const sel: CSSProperties = {
    background: 'rgba(139,92,246,0.10)',
    color: 'white',
    border: '1px solid rgba(139,92,246,0.35)',
    borderRadius: 10,
    padding: '11px 12px',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: 15,
    outline: 'none',
    cursor: 'pointer',
    width: '100%',
    appearance: 'none',
    WebkitAppearance: 'none',
  };

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

    if (calculateAge(dob) < 18) {
      setBlocked(true);
      return;
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    localStorage.setItem('pending_dob', `${y}-${pad(m)}-${pad(d)}`);
    localStorage.setItem('age_verified', 'true');
    onVerified();
  };

  // ── Blocked (under 18) ──────────────────────────────────────────────────────
  if (blocked) {
    return (
      <div style={OVERLAY}>
        <div style={{ ...CARD, borderColor: 'rgba(239,68,68,0.35)', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🔞</div>
          <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 19, color: '#f87171', margin: '0 0 10px' }}>
            Access Restricted
          </h2>
          <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 15, color: 'rgba(226,232,240,0.7)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Ame is an adult platform for users aged 18 and above. You are not old enough to access this service.
          </p>
          <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 12, color: 'rgba(100,116,139,0.7)' }}>
            If you believe this is an error, contact{' '}
            <span style={{ color: 'rgba(167,139,250,0.8)' }}>support@ame.app</span>
          </p>
        </div>
      </div>
    );
  }

  // ── Age verification modal ──────────────────────────────────────────────────
  return (
    <div style={OVERLAY}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '15%', right: '10%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(109,40,217,0.3) 0%, transparent 70%)', filter: 'blur(55px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', left: '8%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)', filter: 'blur(45px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: '0 16px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/logo.png" alt="Ame" style={{ height: 68, margin: '0 auto', filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.55))' }} />
        </div>

        <div style={CARD}>
          {/* 18+ badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', padding: '3px 10px', borderRadius: 6 }}>
              18+
            </span>
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, letterSpacing: '0.14em', color: 'rgba(167,139,250,0.8)', textTransform: 'uppercase' }}>
              Age Verification
            </span>
          </div>

          <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: 'rgba(226,232,240,0.75)', marginBottom: 20, lineHeight: 1.6 }}>
            Ame is an adult platform. You must be <strong style={{ color: 'white' }}>18 or older</strong> to continue. Please enter your date of birth.
          </p>

          {/* DOB selects */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: 8, marginBottom: 14 }}>
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
            <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 13, color: '#f87171', marginBottom: 10 }}>
              {error}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={!month || !day || !year}
            style={{
              width: '100%',
              padding: '13px',
              background: 'linear-gradient(135deg, #6d28d9, #8B5CF6)',
              border: 'none',
              borderRadius: 40,
              color: 'white',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: (!month || !day || !year) ? 'not-allowed' : 'pointer',
              opacity: (!month || !day || !year) ? 0.5 : 1,
              boxShadow: '0 0 24px rgba(139,92,246,0.5)',
              marginBottom: 14,
            }}
          >
            Confirm Age
          </button>

          <p style={{ textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: 11, color: 'rgba(100,116,139,0.7)', lineHeight: 1.5 }}>
            By continuing you agree to our{' '}
            <Link to="/terms" style={{ color: 'rgba(167,139,250,0.75)' }}>Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" style={{ color: 'rgba(167,139,250,0.75)' }}>Privacy Policy</Link>.
            Your date of birth is used to verify you are 18+ and stored securely.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const OVERLAY: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'radial-gradient(ellipse at 50% 25%, #1e0a4e 0%, #0d0720 45%, #06050f 100%)',
  backgroundImage: `
    radial-gradient(ellipse at 50% 25%, #1e0a4e 0%, #0d0720 45%, #06050f 100%),
    radial-gradient(rgba(139,92,246,0.10) 1px, transparent 1px)
  `,
  backgroundSize: 'cover, 26px 26px',
  overflowY: 'auto',
  padding: '32px 0',
};

const CARD: CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(14px)',
  border: '1px solid rgba(139,92,246,0.3)',
  borderRadius: 20,
  padding: '26px 22px',
};
