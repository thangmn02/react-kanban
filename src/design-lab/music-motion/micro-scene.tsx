import { useEffect, useRef, useState, type RefObject } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import type { MicroInput } from './dock-micro-visual';
import { advanceLane, createLanes, frameSummary, laneStations, quietActivity, smoothActivity, tau } from './visual-activity';

const W = 280, H = 100, colors = ['#9b82cb', '#54aba5', '#c19461'];
function point(radius: number, angle: number, tilt: number) {
  const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .44;
  return { x: 140 + x * Math.cos(tilt) - y * Math.sin(tilt), y: 50 + x * Math.sin(tilt) + y * Math.cos(tilt) };
}

export default function MicroScene({ mode, input, low }: { mode: 'vinyl' | 'orbit'; input: RefObject<MicroInput>; low: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null), panel = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update); update();
    return () => preference.removeEventListener('change', update);
  }, []);
  const x = useMotionValue(190), y = useMotionValue(39), stride = useMotionValue(0), backStride = useMotionValue(0);
  const bob = useMotionValue(0), tilt = useSpring(0, { stiffness: 180, damping: 17 });
  const scarf = useSpring(0, { stiffness: 110, damping: 13 });
  useEffect(() => {
    const el = canvas.current, root = panel.current; if (!el || !root) return;
    const c = el.getContext('2d'); if (!c) return;
    const lanes = createLanes().slice(0, 3);
    let visible = true, raf = 0, last = 0, lastPaint = 0, time = 0, phase = 0, frames = 0, lastStats = 0;
    let energy = quietActivity();
    const costs: number[] = [], intervals: number[] = [];
    const arrivals: { lane: number; station: number; angle: number; at: number }[] = [];
    const stats = () => { root.dataset.metrics = JSON.stringify({ mode, frames, drawMs: frameSummary(costs), intervals: frameSummary(intervals),
      trails: lanes.map(l => l.trail.length), arrivals, activity: energy, playing: input.current.playing,
      reduced: Boolean(reduced), active: visible && !document.hidden }); };
    const resize = () => {
      const dpr = Math.min(low ? 1 : 1.5, devicePixelRatio || 1);
      el.width = Math.round(Math.min(280, root.clientWidth) * dpr); el.height = Math.round(root.clientHeight * dpr);
    };
    function paint(dt: number, now: number) {
      const start = performance.now();
      const playing = input.current.playing && !reduced;
      time += dt;
      energy = smoothActivity(energy, input.current.playing ? input.current.sample(dt, time) : quietActivity(), dt);
      const activity = (energy.low + energy.mid + energy.high) / 3;
      if (playing) phase += dt * (.6 + activity * 2.3);
      c!.setTransform(el!.width / W, 0, 0, el!.height / H, 0, 0); c!.clearRect(0, 0, W, H);
      c!.lineCap = 'round';
      if (mode === 'vinyl') {
        c!.fillStyle = '#76668c13'; c!.beginPath(); c!.ellipse(140, 88, 73, 6, 0, 0, tau); c!.fill();
        c!.fillStyle = '#4f4862'; c!.beginPath(); c!.ellipse(140, 65, 91, 29, 0, 0, tau); c!.fill();
        c!.fillStyle = '#5d5573'; c!.beginPath(); c!.ellipse(140, 61, 91, 29, 0, 0, tau); c!.fill();
        for (let i = 0; i < (low ? 9 : 15); i++) {
          const r = .35 + i / (low ? 9 : 15) * .64;
          c!.strokeStyle = i % 3 ? '#c6b7dd38' : '#ddd2ed70'; c!.lineWidth = .65;
          c!.beginPath(); c!.ellipse(140, 61, 91 * r, 29 * r, 0, 0, tau); c!.stroke();
        }
        c!.fillStyle = '#bcaad6'; c!.beginPath(); c!.ellipse(140, 61, 28, 9, 0, 0, tau); c!.fill();
        c!.strokeStyle = '#eee6f79a'; c!.lineWidth = 1;
        c!.beginPath(); c!.ellipse(140, 61, 23, 7, 0, phase * .7, phase * .7 + Math.PI); c!.stroke();
        c!.fillStyle = '#6b5a84'; c!.beginPath(); c!.ellipse(140, 61, 2, 1, 0, 0, tau); c!.fill();
        // Legible counter-moving groove marks establish speed at small scale.
        for (let i = 0; i < 5; i++) {
          const a = i * tau / 5 - phase * .3;
          c!.fillStyle = '#d4c9e977'; const p = { x: 140 + Math.cos(a) * 82, y: 61 + Math.sin(a) * 26 };
          c!.beginPath(); c!.ellipse(p.x, p.y, 2, .7, a, 0, tau); c!.fill();
        }
        const a = .32 + Math.sin(phase * .42) * .12, px = 140 + Math.cos(a) * 74, py = 61 + Math.sin(a) * 24;
        x.set(px); y.set(py - 22);
        c!.strokeStyle = '#8bcbb9'; c!.lineWidth = 1.6 + energy.low * 1.6;
        c!.beginPath(); c!.ellipse(140, 61, 74, 24, 0, a - .35 - energy.mid * .65, a); c!.stroke();
        c!.fillStyle = '#31294330'; c!.beginPath(); c!.ellipse(px, py + 1, 8, 2, 0, 0, tau); c!.fill();
        const gait = playing ? Math.sin(phase * 8) * 28 : 0;
        stride.set(gait); backStride.set(-gait);
        bob.set(playing ? -Math.abs(Math.sin(phase * 8)) * (1.2 + energy.low) : 0);
        if (playing) { tilt.set(4 + energy.attack * 6); scarf.set(-8 - energy.mid * 16); }
        else { tilt.jump(0); scarf.jump(0); }
        // Two restrained high accents have a fixed population and no flash filler.
        for (let i = 0; i < 2; i++) {
          c!.globalAlpha = energy.high * .6;
          c!.fillStyle = '#bd9668'; c!.beginPath(); c!.arc(px - 14 - i * 8, py - 8 - Math.sin(phase + i) * 4, 1.2, 0, tau); c!.fill();
        } c!.globalAlpha = 1;
      } else {
        for (let i = 0; i < lanes.length; i++) {
          const lane = lanes[i], radius = 35 + i * 26, turn = -.5 + i * .48;
          const emphasis = [energy.low, energy.mid, energy.high][i];
          const hits = playing ? advanceLane(lane, dt, emphasis) : [];
          if (!playing) lane.glows = lane.glows.map(g => g * Math.exp(-dt * 4));
          for (const station of hits) { arrivals.push({ lane: i, station, angle: lane.angle, at: time }); if (arrivals.length > 16) arrivals.shift(); }
          c!.strokeStyle = `${colors[i]}40`; c!.lineWidth = .8;
          c!.beginPath(); c!.ellipse(140, 50, radius, radius * .44, turn, 0, tau); c!.stroke();
          laneStations.forEach((station, j) => {
            const glow = lane.glows[j], p = point(radius, station, turn);
            // Anticipation is positional. The illuminated arc still begins only at crossing.
            const approach = Math.max(0, 1 - ((station - lane.angle + tau * 4) % tau) / .3);
            if (glow > .01) {
              c!.save(); c!.globalAlpha = glow; c!.strokeStyle = colors[i]; c!.lineWidth = 1.6 + glow;
              c!.shadowColor = colors[i]; c!.shadowBlur = low ? 0 : 7;
              c!.beginPath(); c!.ellipse(140, 50, radius, radius * .44, turn, station - .19, station + .31); c!.stroke(); c!.restore();
            }
            c!.fillStyle = `${colors[i]}${Math.round((.35 + glow * .65) * 255).toString(16).padStart(2, '0')}`;
            c!.beginPath(); c!.arc(p.x, p.y, 1.5 + approach * .6 + glow * .8, 0, tau); c!.fill();
          });
          const p = point(radius, lane.angle, turn);
          if (playing) { lane.trail.push(p); if (lane.trail.length > (low ? 6 : 12)) lane.trail.shift(); }
          c!.strokeStyle = `${colors[i]}55`; c!.lineWidth = 1.4;
          c!.beginPath(); lane.trail.forEach((p, j) => j ? c!.lineTo(p.x, p.y) : c!.moveTo(p.x, p.y)); c!.stroke();
          c!.save(); c!.shadowColor = colors[i]; c!.shadowBlur = low ? 0 : 8;
          c!.fillStyle = colors[i]; c!.beginPath(); c!.arc(p.x, p.y, 2.4 + emphasis * .8, 0, tau); c!.fill(); c!.restore();
        }
        const radius = 7 + energy.low * 2;
        const g = c!.createRadialGradient(140, 50, 1, 140, 50, 23);
        g.addColorStop(0, '#a28dc670'); g.addColorStop(1, '#a28dc600');
        c!.fillStyle = g; c!.beginPath(); c!.arc(140, 50, 23, 0, tau); c!.fill();
        c!.fillStyle = '#9e87c7'; c!.beginPath(); c!.arc(140, 50, radius, 0, tau); c!.fill();
        c!.strokeStyle = '#c1addb80'; c!.lineWidth = .8; c!.beginPath(); c!.arc(140, 50, radius + 3, 0, tau); c!.stroke();
      }
      frames++; costs.push(performance.now() - start); if (costs.length > 180) costs.shift();
      if (lastPaint) { intervals.push(now - lastPaint); if (intervals.length > 180) intervals.shift(); } lastPaint = now;
      if (now - lastStats > 700) { stats(); lastStats = now; }
    }
    function tick(now: number) {
      if (!visible || document.hidden) { raf = 0; last = 0; stats(); return; }
      if (!last || now - last >= 1000 / (low ? 24 : 30) - 1) { paint(last ? Math.min((now - last) / 1000, .1) : 1 / 30, now); last = now; }
      raf = requestAnimationFrame(tick);
    }
    function restart() {
      cancelAnimationFrame(raf); raf = 0; last = 0; lastPaint = 0;
      if (!visible || document.hidden) { stats(); return; }
      if (reduced) { paint(1 / 30, performance.now()); stats(); return; }
      raf = requestAnimationFrame(tick);
    }
    resize(); const ro = new ResizeObserver(() => { resize(); restart(); }); ro.observe(root);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; restart(); }); io.observe(root);
    document.addEventListener('visibilitychange', restart); restart();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', restart); tilt.jump(0); scarf.jump(0); };
  }, [mode, input, low, reduced, x, y, stride, backStride, bob, tilt, scarf]);
  return <div className="km-scene" ref={panel} data-testid="music-micro-scene" aria-label={mode === 'vinyl' ? 'Groove Steps' : 'Halo Relay'}>
    <canvas ref={canvas} aria-hidden="true" />
    {mode === 'vinyl' && <svg className="km-character" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <motion.g style={{ x, y }}><motion.g style={{ y: bob, rotate: tilt }}>
        <motion.path d="M-2 14 L-7 21 L-3 23" stroke="#5c5375" strokeWidth="3.5" strokeLinecap="round" fill="none" style={{ rotate: backStride, transformOrigin: '-2px 14px' }} />
        <motion.path d="M2 14 L7 21 L11 22" stroke="#75618f" strokeWidth="3.5" strokeLinecap="round" fill="none" style={{ rotate: stride, transformOrigin: '2px 14px' }} />
        <path d="M-6 1 Q0-2 6 1 L5 15 L-5 15 Z" fill="#ddd7ec" stroke="#a39ab7" strokeWidth=".5" />
        <motion.path d="M-3 2 Q-12-2-15 1" fill="none" stroke="#8fc8bb" strokeWidth="3" strokeLinecap="round" style={{ rotate: scarf, transformOrigin: '-3px 2px' }} />
        <circle cx="1" cy="-5" r="6" fill="#e7c8aa" />
        <path d="M-5-5 Q-6-14 2-13 Q9-12 8-5" fill="none" stroke="#696382" strokeWidth="2" />
        <rect x="-6" y="-7" width="3" height="6" rx="1.5" fill="#9185aa" /><rect x="7" y="-7" width="3" height="6" rx="1.5" fill="#9185aa" />
        <path d="M3-5 L4-5" stroke="#594758" strokeWidth="1" strokeLinecap="round" />
        <motion.path d="M3 3 L7 8 L10 5" fill="none" stroke="#e7c8aa" strokeWidth="2.5" strokeLinecap="round" style={{ rotate: backStride, transformOrigin: '3px 3px' }} />
      </motion.g></motion.g>
    </svg>}
  </div>;
}
