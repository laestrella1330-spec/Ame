import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  opacity: number;
  colorIdx: number;
}

interface Bokeh {
  x: number; y: number;
  r: number;
  opacity: number;
  colorIdx: number;
  pulsePhase: number;
  pulseSpeed: number;
}

const PARTICLE_COLORS = ['255,255,255', '100,255,218', '180,100,255'];
const BOKEH_COLORS = ['100,60,200', '30,80,180', '80,180,200'];

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let particles: Particle[] = [];
    let bokehs: Bokeh[] = [];
    let w = 0, h = 0;

    function resize() {
      w = canvas!.width = window.innerWidth;
      h = canvas!.height = window.innerHeight;
    }

    function init() {
      particles = Array.from({ length: 65 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: -(Math.random() * 0.22 + 0.08),
        r: Math.random() * 1.6 + 0.3,
        opacity: Math.random() * 0.55 + 0.12,
        colorIdx: Math.floor(Math.random() * PARTICLE_COLORS.length),
      }));
      bokehs = Array.from({ length: 11 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 110 + 55,
        opacity: Math.random() * 0.05 + 0.02,
        colorIdx: Math.floor(Math.random() * BOKEH_COLORS.length),
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.003 + 0.0008,
      }));
    }

    function draw(time: number) {
      // ── Background gradient ──────────────────────────────
      const bg = ctx!.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0,    '#1a0b2e');
      bg.addColorStop(0.40, '#130d2e');
      bg.addColorStop(0.60, '#0f1b3d');
      bg.addColorStop(1,    '#0d1526');
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, w, h);

      // ── Bokeh (soft radial blobs) ────────────────────────
      for (const b of bokehs) {
        const pulse = Math.sin(time * b.pulseSpeed + b.pulsePhase) * 0.012;
        const alpha = Math.max(0, b.opacity + pulse);
        const grad = ctx!.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        grad.addColorStop(0, `rgba(${BOKEH_COLORS[b.colorIdx]},${alpha})`);
        grad.addColorStop(0.5, `rgba(${BOKEH_COLORS[b.colorIdx]},${alpha * 0.4})`);
        grad.addColorStop(1, `rgba(${BOKEH_COLORS[b.colorIdx]},0)`);
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      // ── Constellation lines ──────────────────────────────
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 95) {
            const alpha = (1 - dist / 95) * 0.13;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(180,140,255,${alpha})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }

      // ── Particles ────────────────────────────────────────
      for (const p of particles) {
        // Soft glow halo
        const glow = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        glow.addColorStop(0, `rgba(${PARTICLE_COLORS[p.colorIdx]},${p.opacity * 0.55})`);
        glow.addColorStop(1, `rgba(${PARTICLE_COLORS[p.colorIdx]},0)`);
        ctx!.fillStyle = glow;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
        ctx!.fill();

        // Bright core
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${PARTICLE_COLORS[p.colorIdx]},${p.opacity})`;
        ctx!.fill();

        // Move
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -12) { p.y = h + 12; p.x = Math.random() * w; }
        if (p.x < -12) p.x = w + 12;
        if (p.x > w + 12) p.x = -12;
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    init();
    raf = requestAnimationFrame(draw);

    const onResize = () => { resize(); init(); };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
