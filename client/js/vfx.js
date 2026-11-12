// ===== Skill VFX library: projectile shapes + impact / field styles keyed by the skill's `v` =====
const TAU = Math.PI * 2;
function star(ctx, x, y, r, n, rot) { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r * 0.45 : r; const a = rot + (i / (n * 2)) * TAU; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
function bolt(ctx, x1, y1, x2, y2, jit) { ctx.beginPath(); ctx.moveTo(x1, y1); const n = 6; for (let i = 1; i < n; i++) { const t = i / n; ctx.lineTo(x1 + (x2 - x1) * t + (Math.random() - 0.5) * jit, y1 + (y2 - y1) * t + (Math.random() - 0.5) * jit); } ctx.lineTo(x2, y2); }

// projectile: returns true if drawn
export function drawProjectile(ctx, p, x, y, c, g, t) {
  const a = Math.atan2(p.vy, p.vx); const r = Math.max(4, p.r);
  ctx.save(); ctx.translate(x, y);
  switch (p.v) {
    case 'arrow': ctx.rotate(a); ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(5, -4); ctx.lineTo(5, 4); ctx.fill(); ctx.fillStyle = g; ctx.fillRect(-15, -3, 4, 6); break;
    case 'dagger': ctx.rotate(a); ctx.fillStyle = '#d8e0ea'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-4, -3); ctx.lineTo(-4, 3); ctx.fill(); ctx.fillStyle = c; ctx.fillRect(-8, -2, 4, 4); break;
    case 'shard': ctx.rotate(a); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(r * 2.2, 0); ctx.lineTo(0, -r * 0.7); ctx.lineTo(-r * 1.4, 0); ctx.lineTo(0, r * 0.7); ctx.fill(); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(r * 1.6, 0); ctx.lineTo(0, -r * 0.3); ctx.lineTo(-r * 0.6, 0); ctx.fill(); break;
    case 'spinblade': ctx.rotate(t * 18); ctx.fillStyle = c; for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 2, -3); ctx.lineTo(r * 1.4, 3); ctx.fill(); } ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill(); break;
    case 'bomb': ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, TAU); ctx.fill(); ctx.fillStyle = c; ctx.fillRect(-1, -r - 7, 2, 5); ctx.fillStyle = Math.sin(t * 30) > 0 ? '#fff' : '#ffd84a'; ctx.fillRect(-2, -r - 9, 4, 3); break;
    case 'tracer': ctx.rotate(a); ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(6, 0); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.stroke(); break;
    case 'ghost': { ctx.fillStyle = c; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, r + 2, Math.PI, 0); ctx.lineTo(r + 2, r); for (let i = 0; i < 3; i++) ctx.lineTo(r + 2 - ((i + 0.5) * (2 * r + 4)) / 3, r + (i % 2 ? -3 : 3)); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(-4, -2, 2, 3); ctx.fillRect(2, -2, 2, 3); break; }
    case 'star': ctx.rotate(t * 8); ctx.fillStyle = c; star(ctx, 0, 0, r + 4, 5, 0); ctx.fill(); ctx.fillStyle = g; star(ctx, 0, 0, r, 5, 0); ctx.fill(); break;
    case 'net': ctx.rotate(t * 3); ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 1.5; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 4, -10); ctx.lineTo(i * 4, 10); ctx.moveTo(-10, i * 4); ctx.lineTo(10, i * 4); ctx.stroke(); } break;
    case 'chain': ctx.rotate(a); ctx.strokeStyle = '#b8b8c8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(4, 0, 6, -1.2, 1.2); ctx.stroke(); ctx.fillStyle = '#d8d8e8'; ctx.fillRect(-10, -1, 10, 2); break;
    case 'tornado': for (let i = 0; i < 5; i++) { ctx.strokeStyle = c; ctx.globalAlpha = 0.8 - i * 0.12; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(Math.sin(t * 10 + i) * 4, -i * 9, 8 + i * 6, 3 + i * 1.5, 0, 0, TAU); ctx.stroke(); } break;
    case 'wave': ctx.rotate(a); ctx.strokeStyle = c; ctx.lineWidth = 6; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(-r, 0, r * 1.6, -1, 1); ctx.stroke(); ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.stroke(); break;
    case 'holy': ctx.fillStyle = g; ctx.fillRect(-2, -9, 4, 18); ctx.fillRect(-7, -4, 14, 4); ctx.globalAlpha = 0.4; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); break;
    case 'orb': { const gr = ctx.createRadialGradient(0, 0, 1, 0, 0, r + 6); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, g); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, TAU); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r + 1 + Math.sin(t * 20) * 2, 0, TAU); ctx.stroke(); break; }
    default: ctx.restore(); return false;
  }
  ctx.restore(); return true;
}

// impact (instant area) styles. p = progress 0..1 over ~0.4s
export function drawImpact(ctx, f, x, y, p, c, g, R) {
  const r = f.r || 60;
  ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p);
  switch (f.v) {
    case 'slash': case 'crescent': case 'xslash': case 'combo': case 'rend': case 'flurry': {
      const ang = f.ang ?? 0, arc = ((f.arc || 120) * Math.PI) / 360;
      ctx.lineCap = 'round';
      const lines = f.v === 'flurry' ? 5 : f.v === 'rend' ? 3 : f.v === 'xslash' ? 2 : 1;
      for (let i = 0; i < lines; i++) {
        ctx.strokeStyle = i % 2 ? c : g; ctx.lineWidth = f.v === 'crescent' ? 10 * (1 - p) + 2 : 6 * (1 - p) + 2;
        ctx.beginPath();
        if (f.v === 'rend') { const o = (i - 1) * 10; ctx.moveTo(x + Math.cos(ang) * 20 - Math.sin(ang) * o, y + Math.sin(ang) * 20 + Math.cos(ang) * o); ctx.lineTo(x + Math.cos(ang) * r - Math.sin(ang) * o, y + Math.sin(ang) * r + Math.cos(ang) * o); }
        else if (f.v === 'xslash' || f.v === 'flurry') { const off = (i - lines / 2) * 0.6 + Math.random() * 0.2; ctx.moveTo(x + Math.cos(ang + off) * r * 0.2, y + Math.sin(ang + off) * r * 0.2 - 10); ctx.lineTo(x + Math.cos(ang - off) * r, y + Math.sin(ang - off) * r - 10); }
        else ctx.arc(x, y - 6, r * (0.55 + p * 0.45), ang - arc, ang - arc + arc * 2 * Math.min(1, p * 3));
        ctx.stroke();
      }
      break;
    }
    case 'smash': case 'crack': case 'execute': {
      ctx.strokeStyle = f.v === 'execute' ? '#ff2a3a' : g; ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * (0.5 + p * 0.6), y + Math.sin(a) * r * 0.5 * (0.5 + p * 0.6)); ctx.stroke(); }
      ctx.fillStyle = 'rgba(160,140,110,0.5)'; ctx.beginPath(); ctx.ellipse(x, y, r * p, r * p * 0.45, 0, 0, TAU); ctx.fill();
      if (f.v === 'execute') { ctx.font = `bold ${24 + p * 12}px serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#ff2a3a'; ctx.fillText('☠', x, y - 30 - p * 20); }
      break;
    }
    case 'launch': case 'thrust': { ctx.fillStyle = g; ctx.fillRect(x - 4, y - 70 * p - 10, 8, 70 * p); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, r * 0.6, r * 0.25, 0, 0, TAU); ctx.stroke(); break; }
    case 'explosion': case 'bomb': case 'asura': {
      const gr = ctx.createRadialGradient(x, y - 10, 2, x, y - 10, r * (0.6 + p * 0.6)); gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, g); gr.addColorStop(0.7, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 10, r * (0.6 + p * 0.6), 0, TAU); ctx.fill();
      ctx.strokeStyle = g; ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.4, y - 10 + Math.sin(a) * r * 0.4); ctx.lineTo(x + Math.cos(a) * r * (0.7 + p), y - 10 + Math.sin(a) * r * (0.7 + p)); ctx.stroke(); }
      break;
    }
    case 'rings': case 'shout': { for (let i = 0; i < 3; i++) { const q = Math.min(1, p + i * 0.15); ctx.strokeStyle = i % 2 ? c : g; ctx.lineWidth = 4 * (1 - q) + 1; ctx.beginPath(); ctx.ellipse(x, y, r * q, r * q * 0.5, 0, 0, TAU); ctx.stroke(); } break; }
    case 'spikes': { const n = Math.max(3, Math.round(r / 12)); for (let i = 0; i < n; i++) { const a = (i / n) * TAU, d = r * 0.55 * ((i * 37) % 10) / 10; const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d * 0.5; const h = 34 * Math.sin(Math.min(1, p * 2) * Math.PI); ctx.fillStyle = i % 2 ? c : '#8a7a60'; ctx.beginPath(); ctx.moveTo(sx - 7, sy); ctx.lineTo(sx, sy - h); ctx.lineTo(sx + 7, sy); ctx.fill(); } break; }
    case 'pillar': { const h = 140 * Math.min(1, p * 2.5); const gr = ctx.createLinearGradient(x, y - h, x, y); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, g); gr.addColorStop(1, c); ctx.fillStyle = gr; ctx.fillRect(x - r * 0.5, y - h, r, h); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, r * 0.7, r * 0.3, 0, 0, TAU); ctx.fill(); break; }
    case 'meteor': { if (p < 0.35) { const q = p / 0.35; ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.arc(x + 120 * (1 - q), y - 260 * (1 - q), 14, 0, TAU); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 120 * (1 - q) + 10, y - 260 * (1 - q) - 20, 9, 0, TAU); ctx.fill(); } else { const q = (p - 0.35) / 0.65; ctx.globalAlpha = 1 - q; const gr = ctx.createRadialGradient(x, y, 2, x, y, r * (0.5 + q)); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, '#ffb040'); gr.addColorStop(1, 'rgba(255,60,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * (0.5 + q), 0, TAU); ctx.fill(); } break; }
    case 'frost': case 'blizzard': case 'stone': { for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, d = r * (0.3 + p * 0.6); const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d * 0.5; ctx.fillStyle = f.v === 'stone' ? '#9a9a9a' : i % 2 ? '#e8f8ff' : c; ctx.beginPath(); ctx.moveTo(sx, sy - 22); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx - 6, sy); ctx.fill(); } break; }
    case 'bolt': case 'storm': { ctx.strokeStyle = g; ctx.lineWidth = 3; bolt(ctx, x, y - 260, x, y, 30); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r * 0.35, 0, 0, TAU); ctx.fill(); break; }
    case 'vortex': case 'blackhole': { for (let i = 0; i < 4; i++) { ctx.strokeStyle = i % 2 ? c : g; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, r * (1 - p) * (1 - i * 0.2), r * (1 - p) * (1 - i * 0.2) * 0.5, p * 8 + i, 0, 4.5); ctx.stroke(); } break; }
    case 'heal': case 'holy': case 'cross': case 'sparkle': { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const sx = x + Math.cos(a) * r * 0.5, sy = y - p * 50 + Math.sin(a) * r * 0.2; ctx.fillStyle = f.heal ? '#7aff9a' : g; ctx.fillRect(sx - 1, sy - 5, 2, 10); ctx.fillRect(sx - 5, sy - 1, 10, 2); } ctx.strokeStyle = f.heal ? '#7aff9a' : g; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, r * p, r * p * 0.45, 0, 0, TAU); ctx.stroke(); break; }
    case 'dark': case 'shadowstep': { for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#2a1a3a' : c; ctx.globalAlpha = (1 - p) * 0.6; ctx.beginPath(); ctx.arc(x + Math.cos(i * 1.7) * r * 0.5 * p, y - 10 - p * 30 + Math.sin(i * 2.3) * 10, 12 + p * 14, 0, TAU); ctx.fill(); } break; }
    case 'runes': case 'clock': { ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y, r * 0.7, r * 0.32, 0, 0, TAU); ctx.stroke(); ctx.font = '12px serif'; ctx.fillStyle = c; ctx.textAlign = 'center'; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + p * 2; ctx.fillText(f.v === 'clock' ? '⌛' : 'ᚱᚨᛟᛉᚦᛒᛗᛞ'[i], x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.38 + 4); } break; }
    case 'wall': case 'breath': { for (let i = 0; i < 6; i++) { const sx = x + (Math.random() - 0.5) * r, sy = y + (Math.random() - 0.5) * r * 0.4; ctx.fillStyle = i % 2 ? g : c; ctx.beginPath(); ctx.moveTo(sx - 6, sy); ctx.quadraticCurveTo(sx, sy - 34, sx + 6, sy); ctx.fill(); } break; }
    case 'cloud': case 'swamp': { for (let i = 0; i < 6; i++) { ctx.fillStyle = f.v === 'swamp' ? '#5a4a2a' : c; ctx.globalAlpha = 0.5 * (1 - p); ctx.beginPath(); ctx.arc(x + Math.cos(i) * r * 0.5, y + Math.sin(i * 1.3) * r * 0.25, r * 0.4, 0, TAU); ctx.fill(); } break; }
    case 'vines': { ctx.strokeStyle = '#4a9a3a'; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 1) * r * 0.5, y + Math.sin(a + 1) * r * 0.25 - 20, x + Math.cos(a) * r * p, y + Math.sin(a) * r * 0.45 * p); ctx.stroke(); } break; }
    default: ctx.restore(); return false;
  }
  ctx.restore(); return true;
}

// lingering field overlay
export function drawField(ctx, f, x, y, t, c, g) {
  const r = f.r || 60;
  switch (f.v) {
    case 'storm': if (Math.random() < 0.15) { ctx.strokeStyle = g; ctx.lineWidth = 2; const sx = x + (Math.random() - 0.5) * r * 1.6, sy = y + (Math.random() - 0.5) * r * 0.7; bolt(ctx, sx, sy - 200, sx, sy, 20); ctx.stroke(); } return 'rgba(80,80,160,0.18)';
    case 'blizzard': case 'frost': for (let i = 0; i < 4; i++) { ctx.fillStyle = '#e8f8ff'; ctx.fillRect(x + (Math.random() - 0.5) * r * 1.8, y + (Math.random() - 0.5) * r * 0.8 - Math.random() * 40, 2, 4); } return 'rgba(160,220,255,0.2)';
    case 'vortex': case 'blackhole': ctx.strokeStyle = f.v === 'blackhole' ? '#9a5cff' : c; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y, r * (1 - i * 0.3), r * (1 - i * 0.3) * 0.45, 0, t * (3 + i) , t * (3 + i) + 4); ctx.stroke(); } if (f.v === 'blackhole') { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.25, r * 0.12, 0, 0, TAU); ctx.fill(); } return f.v === 'blackhole' ? 'rgba(40,0,60,0.35)' : null;
    case 'cross': return null;
    case 'swamp': return 'rgba(90,70,30,0.35)';
    case 'cloud': return 'rgba(120,200,90,0.22)';
    case 'clock': ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(t * 0.5) * r * 0.6, y + Math.sin(t * 0.5) * r * 0.27); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(t * 4) * r * 0.85, y + Math.sin(t * 4) * r * 0.38); ctx.stroke(); return 'rgba(200,180,255,0.18)';
    case 'wall': case 'pillar': case 'breath': for (let i = 0; i < 2; i++) { const sx = x + (Math.random() - 0.5) * r, sy = y + (Math.random() - 0.5) * r * 0.4; ctx.fillStyle = Math.random() < 0.5 ? g : c; ctx.beginPath(); ctx.moveTo(sx - 5, sy); ctx.quadraticCurveTo(sx, sy - 26 - Math.random() * 14, sx + 5, sy); ctx.fill(); } return null;
    case 'runes': case 'holy': case 'heal': ctx.strokeStyle = f.heal ? '#7aff9a' : g; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r * 0.36, t, 0, TAU); ctx.stroke(); return f.heal ? 'rgba(120,255,150,0.16)' : null;
    case 'spikes': ctx.fillStyle = '#9a9aa8'; for (let i = 0; i < 10; i++) { const a = i * 2.39, d = r * 0.8 * ((i * 7) % 10) / 10; const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d * 0.45; ctx.beginPath(); ctx.moveTo(sx - 3, sy); ctx.lineTo(sx, sy - 7); ctx.lineTo(sx + 3, sy); ctx.fill(); } return null;
    default: return undefined;
  }
}
