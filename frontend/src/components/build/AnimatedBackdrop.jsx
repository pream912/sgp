import React, { useEffect, useRef } from 'react';

// Ambient "workshop at night" canvas: a few warm molten blobs drifting slowly
// behind the build UI. Plain 2D canvas — no WebGL, ~zero battery cost.
// Respects prefers-reduced-motion by rendering a single static frame.
const BLOBS = [
  { hue: 24, sat: 95, light: 53, r: 0.55, speed: 0.00021, phase: 0.0, alpha: 0.16 },  // orange-500
  { hue: 38, sat: 92, light: 50, r: 0.42, speed: 0.00015, phase: 2.1, alpha: 0.12 },  // amber
  { hue: 16, sat: 80, light: 42, r: 0.65, speed: 0.00011, phase: 4.2, alpha: 0.10 },  // ember
];

export default function AnimatedBackdrop({ intensity = 1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = null;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (t) => {
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);
      for (const b of BLOBS) {
        const cx = w * (0.5 + 0.38 * Math.sin(t * b.speed + b.phase));
        const cy = h * (0.45 + 0.32 * Math.cos(t * b.speed * 1.3 + b.phase * 1.7));
        const radius = Math.max(w, h) * b.r;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, `hsla(${b.hue}, ${b.sat}%, ${b.light}%, ${b.alpha * intensity})`);
        g.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    };

    if (reduceMotion) {
      draw(8000); // one pleasant static frame
    } else {
      const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
