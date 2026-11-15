// Three ways to turn a camera frame into a picture: ASCII, watercolor, cross-stitch.
// Each renderer gets a 2D canvas context, the output size, a `sample` function (a video frame shrunk to w×h pixels),
// and its options. Nothing here touches the stage or React, so each look is easy to read and change on its own.

// ---------- shared ----------

// Returns sample(video, w, h, mirror, filter): the current video frame drawn small into a hidden canvas, as ImageData.
export function makeSampler() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return function sample(video, w, h, mirror = false, filter = "none") {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.save();
    ctx.filter = filter;
    if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    return ctx.getImageData(0, 0, w, h);
  };
}

const clamp = (v, lo = 0, hi = 255) => (v < lo ? lo : v > hi ? hi : v);

// ---------- 1. ASCII ----------

// Dark to bright. Change this string to change the "ink": try " ░▒▓█" or " .oO@".
export const ASCII_RAMP = " .:-=+*#%@";

export function renderAscii(ctx, W, H, sample, video, { cols, mirror, color }) {
  const cellW = W / cols;
  const rows = Math.max(1, Math.floor(H / (cellW * 2))); // characters are about twice as tall as wide
  const cellH = H / rows;
  const { data } = sample(video, cols, rows, mirror);

  ctx.fillStyle = "#0a0a0b";
  ctx.fillRect(0, 0, W, H);
  ctx.font = `${(cellH * 0.95).toFixed(1)}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const level = Math.pow(clamp(lum * 1.12, 0, 1), 0.85);
      const ch = ASCII_RAMP[Math.min(ASCII_RAMP.length - 1, Math.floor(level * ASCII_RAMP.length))];
      if (ch === " ") continue;
      ctx.fillStyle = color
        ? `rgb(${clamp(r * 1.25) | 0},${clamp(g * 1.25) | 0},${clamp(b * 1.25) | 0})`
        : `rgb(${clamp(150 + level * 105) | 0},${clamp(160 + level * 95) | 0},${clamp(150 + level * 90) | 0})`;
      ctx.fillText(ch, x * cellW + cellW / 2, y * cellH + cellH / 2);
    }
  }
}

// ---------- 2. Watercolor ----------

const WC_WIDTH = 320; // the painting is worked out this small, then stretched, so the edges come out soft

function valueNoise(w, h, gx, gy) {
  const grid = Array.from({ length: (gx + 1) * (gy + 1) }, () => Math.random());
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = (y / h) * gy, y0 = Math.floor(fy), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * gx, x0 = Math.floor(fx), tx = fx - x0;
      const a = grid[y0 * (gx + 1) + x0], b = grid[y0 * (gx + 1) + x0 + 1];
      const c = grid[(y0 + 1) * (gx + 1) + x0], d = grid[(y0 + 1) * (gx + 1) + x0 + 1];
      out[y * w + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  return out;
}

function buildWatercolor(W, H) {
  const ww = WC_WIDTH, hh = Math.round((WC_WIDTH * H) / W);
  const work = document.createElement("canvas");
  work.width = ww; work.height = hh;

  // Paper: warm white with fine grain.
  const paper = document.createElement("canvas");
  paper.width = W; paper.height = H;
  const pctx = paper.getContext("2d");
  const tile = document.createElement("canvas");
  tile.width = tile.height = 256;
  const tctx = tile.getContext("2d");
  const grain = tctx.createImageData(256, 256);
  for (let i = 0; i < grain.data.length; i += 4) {
    const v = 236 + Math.random() * 19;
    grain.data[i] = v; grain.data[i + 1] = v - 2; grain.data[i + 2] = v - 7; grain.data[i + 3] = 255;
  }
  tctx.putImageData(grain, 0, 0);
  pctx.fillStyle = pctx.createPattern(tile, "repeat");
  pctx.fillRect(0, 0, W, H);

  return { W, H, ww, hh, work, paper, blotch: valueNoise(ww, hh, 9, 6) };
}

export function renderWatercolor(ctx, W, H, sample, video, { wet, mirror }, state) {
  if (!state.wc || state.wc.W !== W || state.wc.H !== H) state.wc = buildWatercolor(W, H);
  const { ww, hh, work, paper, blotch } = state.wc;
  const { data } = sample(video, ww, hh, mirror, `blur(${wet}px) saturate(1.35)`);

  const lum = new Float32Array(ww * hh);
  for (let p = 0; p < ww * hh; p++) lum[p] = 0.299 * data[p * 4] + 0.587 * data[p * 4 + 1] + 0.114 * data[p * 4 + 2];

  const wctx = work.getContext("2d");
  const out = wctx.createImageData(ww, hh);
  const levels = 6; // the wash steps: fewer = flatter, more = smoother
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < ww; x++) {
      const p = y * ww + x, i = p * 4;
      // Edges: where the brightness changes fast, pigment pools and the line goes darker.
      const gx = lum[y * ww + Math.min(ww - 1, x + 1)] - lum[y * ww + Math.max(0, x - 1)];
      const gy = lum[Math.min(hh - 1, y + 1) * ww + x] - lum[Math.max(0, y - 1) * ww + x];
      const edge = Math.min(1, Math.hypot(gx, gy) / 22);
      const blot = 0.9 + blotch[p] * 0.16; // low, uneven patches of heavier and lighter wash
      for (let c = 0; c < 3; c++) {
        let v = data[i + c];
        const q = (Math.round((v / 255) * levels) / levels) * 255;
        v = v * 0.35 + q * 0.65;          // flat-ish washes with soft steps between them
        v = 255 - (255 - v) * 0.82;       // water lightens everything toward the paper
        v = v * blot;
        v = v * (1 - edge * 0.4);       // pooled pigment at the edges
        out.data[i + c] = clamp(v);
      }
      out.data[i + 3] = 255;
    }
  }
  wctx.putImageData(out, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(paper, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(work, 0, 0, W, H);
  ctx.globalAlpha = 0.22; // a second, slightly off-register layer, like a wash that bled
  ctx.drawImage(work, 4, 3, W, H);
  ctx.globalAlpha = 1;
  ctx.drawImage(paper, 0, 0); // paper grain over the paint
  ctx.globalCompositeOperation = "source-over";

  // Unpainted paper at the edges.
  const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.62);
  vignette.addColorStop(0, "rgba(251,248,241,0)");
  vignette.addColorStop(1, "rgba(251,248,241,0.95)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

// ---------- 3. Cross-stitch ----------

// The thread box. Add a color here and it appears in the stitching. The first one is the bare cloth (nothing stitched).
export const THREADS = [
  [242, 236, 221], // cloth
  [250, 250, 247], [20, 20, 22], [90, 90, 95], [150, 150, 155], [205, 205, 205],
  [190, 30, 45], [232, 98, 110], [247, 170, 180], [214, 60, 135],
  [255, 140, 40], [250, 200, 60], [252, 230, 140],
  [120, 170, 70], [40, 120, 70], [170, 205, 150],
  [30, 70, 150], [60, 130, 210], [140, 195, 235], [40, 160, 170],
  [110, 70, 160], [185, 155, 215],
  [110, 70, 45], [170, 120, 80], [225, 180, 140], [200, 140, 105], [140, 90, 65],
];

function threadDistance(r, g, b, t) {
  const dr = r - t[0], dg = g - t[1], db = b - t[2];
  const rm = (r + t[0]) / 2; // "redmean": a cheap distance that follows how eyes see color
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

export function renderStitch(ctx, W, H, sample, video, { cols, mirror }, state) {
  const cell = W / cols;
  const rows = Math.max(1, Math.floor(H / cell));
  const cellH = H / rows;
  const { data } = sample(video, cols, rows, mirror);

  const n = cols * rows;
  if (!state.stitch || state.stitch.cols !== cols || state.stitch.rows !== rows) {
    state.stitch = { cols, rows, rgb: new Float32Array(n * 3), pick: new Int16Array(n).fill(-1), dist: new Float32Array(n) };
    for (let p = 0; p < n; p++) for (let c = 0; c < 3; c++) state.stitch.rgb[p * 3 + c] = data[p * 4 + c];
  }
  const { rgb, pick, dist } = state.stitch;

  // The cloth, with its little holes.
  ctx.fillStyle = "rgb(242,236,221)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(60,45,20,0.16)";
  const hole = Math.max(1, cell * 0.07);
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) ctx.fillRect(x * cell - hole, y * cellH - hole, hole * 2, hole * 2);

  ctx.lineCap = "round";
  const pad = Math.min(cell, cellH) * 0.14;
  const thread = Math.min(cell, cellH) * 0.3;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const p = y * cols + x;
      for (let c = 0; c < 3; c++) rgb[p * 3 + c] += (data[p * 4 + c] - rgb[p * 3 + c]) * 0.35; // smooth out camera flicker
      const r = rgb[p * 3], g = rgb[p * 3 + 1], b = rgb[p * 3 + 2];

      let best = 0, bestD = Infinity;
      for (let t = 0; t < THREADS.length; t++) {
        const d = threadDistance(r, g, b, THREADS[t]);
        if (d < bestD) { bestD = d; best = t; }
      }
      // Hold on to the old thread unless the new one is clearly better, so stitches don't shimmer.
      if (pick[p] >= 0 && pick[p] !== best && bestD > dist[p] * 0.7) { best = pick[p]; bestD = threadDistance(r, g, b, THREADS[best]); }
      pick[p] = best; dist[p] = bestD;
      if (best === 0) continue; // cloth color: leave it unstitched

      const [tr, tg, tb] = THREADS[best];
      const x0 = x * cell + pad, x1 = (x + 1) * cell - pad, y0 = y * cellH + pad, y1 = (y + 1) * cellH - pad;
      ctx.lineWidth = thread;
      ctx.strokeStyle = `rgb(${tr * 0.78 | 0},${tg * 0.78 | 0},${tb * 0.78 | 0})`; // the stitch underneath, in shadow
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = `rgb(${tr},${tg},${tb})`; // the stitch on top
      ctx.beginPath(); ctx.moveTo(x1, y0); ctx.lineTo(x0, y1); ctx.stroke();
      ctx.lineWidth = thread * 0.3;
      ctx.strokeStyle = "rgba(255,255,255,0.28)"; // a little sheen along the thread
      ctx.beginPath(); ctx.moveTo(x1 - thread * 0.1, y0 + thread * 0.1); ctx.lineTo(x0 + thread * 0.1, y1 - thread * 0.1); ctx.stroke();
    }
  }
}
