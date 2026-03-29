/**
 * Renders a 9:16 share card (1080×1920) for Instagram stories.
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   displayName: string,
 *   initials: string,
 *   workoutTitle: string,
 *   workoutKind: string,
 *   durationLabel: string,
 *   displayVolume: number,
 *   volumeUnitLabel: string,
 *   setCount: number,
 *   prLines: string[],
 *   topExercises: { name: string, volume: number }[],
 * }} opts
 */
export function drawWorkoutShareCard(canvas, opts) {
  const W = 1080;
  const H = 1920;
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0b0e14');
  g.addColorStop(0.45, '#121826');
  g.addColorStop(1, '#0c1220');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const accent = ctx.createLinearGradient(0, 280, W, 320);
  accent.addColorStop(0, 'rgba(37,99,235,0)');
  accent.addColorStop(0.5, 'rgba(59,130,246,0.35)');
  accent.addColorStop(1, 'rgba(37,99,235,0)');
  ctx.fillStyle = accent;
  ctx.fillRect(64, 300, W - 128, 3);

  ctx.fillStyle = 'rgba(148,163,184,0.12)';
  ctx.beginPath();
  ctx.arc(W - 120, 200, 180, 0, Math.PI * 2);
  ctx.fill();

  const font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  function drawInitialsAvatar() {
    const cx = 120;
    const cy = 200;
    const grd = ctx.createLinearGradient(cx - 48, cy - 48, cx + 48, cy + 48);
    grd.addColorStop(0, '#3b82f6');
    grd.addColorStop(1, '#6366f1');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 44px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((opts.initials || '?').slice(0, 2).toUpperCase(), cx, cy + 2);
  }
  drawInitialsAvatar();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 28px ${font}`;
  ctx.fillText((opts.displayName || 'Athlete').trim() || 'Athlete', 200, 168);

  ctx.fillStyle = '#f1f5f9';
  ctx.font = `700 52px ${font}`;
  const title = (opts.workoutTitle || 'Workout').trim().slice(0, 42);
  wrapText(ctx, title, 64, 320, W - 128, 58, `700 52px ${font}`);

  ctx.fillStyle = '#64748b';
  ctx.font = `600 30px ${font}`;
  ctx.fillText(opts.workoutKind || 'Workout', 64, 420);

  ctx.fillStyle = '#38bdf8';
  ctx.font = `500 26px ${font}`;
  ctx.fillText(opts.durationLabel || '—', 64, 472);

  const statY = 560;
  const boxW = (W - 64 * 3) / 2;
  drawStatBox(ctx, font, 64, statY, boxW, 200, 'Total volume', `${(opts.displayVolume ?? 0).toLocaleString()} ${opts.volumeUnitLabel || ''}`);
  drawStatBox(ctx, font, 64 + boxW + 64, statY, boxW, 200, 'Working sets', String(opts.setCount ?? 0));

  let y = statY + 240;
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `600 32px ${font}`;
  ctx.fillText('Highlights', 64, y);
  y += 52;

  const prs = opts.prLines || [];
  if (prs.length) {
    ctx.font = `28px ${font}`;
    for (const line of prs.slice(0, 4)) {
      ctx.fillStyle = '#fcd34d';
      wrapText(ctx, line, 64, y, W - 128, 36, `28px ${font}`);
      y += 40;
    }
    y += 16;
  } else {
    ctx.fillStyle = '#64748b';
    ctx.font = `26px ${font}`;
    ctx.fillText('Keep stacking sessions — PRs will show up here.', 64, y);
    y += 48;
  }

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `600 32px ${font}`;
  ctx.fillText('Top exercises', 64, y);
  y += 52;

  ctx.font = `26px ${font}`;
  const tops = opts.topExercises || [];
  if (!tops.length) {
    ctx.fillStyle = '#64748b';
    ctx.fillText('—', 64, y);
  } else {
    for (const row of tops.slice(0, 5)) {
      ctx.fillStyle = '#e2e8f0';
      const name = (row.name || '').slice(0, 36);
      ctx.fillText(name, 64, y);
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText(row.volume.toLocaleString(), W - 64, y);
      ctx.textAlign = 'left';
      y += 40;
    }
  }

  ctx.fillStyle = 'rgba(100,116,139,0.5)';
  ctx.font = `24px ${font}`;
  ctx.textAlign = 'center';
  ctx.fillText('IronLog', W / 2, H - 80);
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, font) {
  ctx.font = font;
  const words = text.split(/\s+/);
  let line = '';
  let yy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = words[i];
      yy += lineHeight;
      if (yy > y + lineHeight * 3) break;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawStatBox(ctx, font, x, y, w, h, label, value) {
  ctx.strokeStyle = 'rgba(51,65,85,0.9)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 16);
  ctx.stroke();
  const inner = ctx.createLinearGradient(x, y, x + w, y + h);
  inner.addColorStop(0, 'rgba(30,41,59,0.5)');
  inner.addColorStop(1, 'rgba(15,23,42,0.35)');
  ctx.fillStyle = inner;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();

  ctx.fillStyle = '#64748b';
  ctx.font = `22px ${font}`;
  ctx.textBaseline = 'top';
  ctx.fillText(label.toUpperCase(), x + 24, y + 24);

  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 40px ${font}`;
  ctx.fillText(value, x + 24, y + 72);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
