// Two effects that go on top of any look: show only your face, and build the picture up piece by piece.
// Both run after a look has been drawn, on the same canvas.

// What shows through where nothing is drawn: the "paper" of each look.
export const BACKGROUNDS = { ascii: "#0a0a0b", watercolor: "#fbf8f1", stitch: "#f2ecdd", pixel: "#0a0a0b" };

// MediaPipe's face outline: landmark numbers that go around the edge of the face.
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

let maskCanvas = null;

// Keep only the face. `landmarks` is one face's points (0–1 across the unmirrored video), or null for "no face".
export function applyFaceOnly(ctx, W, H, landmarks, mirror, bg) {
  if (!maskCanvas) maskCanvas = document.createElement("canvas");
  if (maskCanvas.width !== W || maskCanvas.height !== H) { maskCanvas.width = W; maskCanvas.height = H; }
  const m = maskCanvas.getContext("2d");
  m.clearRect(0, 0, W, H);
  if (landmarks) {
    const pts = FACE_OVAL.map((i) => [(mirror ? 1 - landmarks[i].x : landmarks[i].x) * W, landmarks[i].y * H]);
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    m.filter = `blur(${Math.round(W / 160)}px)`; // a soft edge, not a cut-out
    m.fillStyle = "#000";
    m.beginPath();
    pts.forEach(([x, y], k) => { const px = cx + (x - cx) * 1.06, py = cy + (y - cy) * 1.06; if (k) m.lineTo(px, py); else m.moveTo(px, py); });
    m.closePath();
    m.fill();
    m.filter = "none";
  }
  ctx.globalCompositeOperation = "destination-in"; // keep the picture only where the mask is
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = "destination-over"; // and put the paper behind it
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
}

// Build up: cover the picture with paper, then uncover it block by block as `progress` goes 0 → 1.
// A block's turn comes from a fixed random order (stitches and pixels pop in anywhere); for watercolor the
// order starts at the middle and spreads out, like a wash.
const BLOCK = 20;
let order = null;
export function applyBuildUp(ctx, W, H, progress, bg, fromCenter) {
  const cols = Math.ceil(W / BLOCK), rows = Math.ceil(H / BLOCK);
  if (!order || order.cols !== cols || order.rows !== rows || order.fromCenter !== fromCenter) {
    const keys = Array.from({ length: cols * rows }, (_, i) => {
      const x = (i % cols) / cols - 0.5, y = Math.floor(i / cols) / rows - 0.5;
      return fromCenter ? Math.hypot(x, y) * 1.2 + Math.random() * 0.45 : Math.random();
    });
    const ranked = keys.map((k, i) => [k, i]).sort((a, b) => a[0] - b[0]);
    const rank = new Float32Array(cols * rows);
    ranked.forEach(([, i], r) => { rank[i] = r / (cols * rows); });
    order = { cols, rows, fromCenter, rank };
  }
  ctx.fillStyle = bg;
  for (let i = 0; i < cols * rows; i++) {
    if (order.rank[i] >= progress) ctx.fillRect((i % cols) * BLOCK, Math.floor(i / cols) * BLOCK, BLOCK, BLOCK);
  }
}
