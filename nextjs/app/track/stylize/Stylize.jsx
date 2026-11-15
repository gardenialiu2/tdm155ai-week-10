"use client";

// Camera in, a different picture out: ASCII, watercolor, cross-stitch.
// The looks live in ./renderers.js. This file opens the camera, runs the draw loop, and sends pictures to the stage.

import { useCallback, useEffect, useRef, useState } from "react";
import { useCamera } from "../../../lib/cv/useCamera.js";
import { CameraBar, CueLog, Status, useCueLog } from "../../../lib/cv/ui.jsx";
import { fireCue } from "../../../lib/cv/stage.js";
import { detect, loadModel } from "../../../lib/cv/mediapipe.js";
import { makeSampler, renderAscii, renderPixel, renderStitch, renderWatercolor, PALETTES } from "./renderers.js";
import { applyBuildUp, applyFaceOnly, BACKGROUNDS } from "./effects.js";

const MODES = [
  { id: "ascii", label: "ASCII", key: "1" },
  { id: "watercolor", label: "Watercolor", key: "2" },
  { id: "stitch", label: "Cross-stitch", key: "3" },
  { id: "pixel", label: "Pixel art", key: "4" },
];
const BUILD_MS = 4000; // how long "Build up" takes
const OUT_WIDTH = 1280;

export default function Stylize() {
  const camera = useCamera({ storageKey: "cv-camera-stylize" });
  const canvasRef = useRef(null);
  const [mode, setMode] = useState("ascii");
  const [mirror, setMirror] = useState(true);
  const [color, setColor] = useState(true);
  const [asciiCols, setAsciiCols] = useState(110);
  const [stitchCols, setStitchCols] = useState(80);
  const [wet, setWet] = useState(2);
  const [pixelCols, setPixelCols] = useState(96);
  const [palette, setPalette] = useState("gameboy");
  const [dither, setDither] = useState(true);
  const [faceOnly, setFaceOnly] = useState(false);
  const [faceNote, setFaceNote] = useState("");
  const [live, setLive] = useState(false);
  const [log, addLog] = useCueLog();

  // The draw loop reads the latest settings from a ref, so changing a slider never restarts the camera.
  const settings = useRef({});
  settings.current = { mode, mirror, color, asciiCols, stitchCols, wet, pixelCols, palette, dither, faceOnly };

  // Build up: a start time while one is running. Face model: loaded the first time "Face only" is switched on.
  const build = useRef(null);
  const face = useRef({ model: null, landmarks: null });
  const startBuild = useCallback(() => { build.current = { start: performance.now() }; }, []);

  useEffect(() => {
    if (!faceOnly || face.current.model) return;
    setFaceNote("Loading the face model…");
    loadModel("face").then((model) => { face.current.model = model; setFaceNote(""); })
      .catch((error) => setFaceNote(`Couldn't load the face model: ${error.message}`));
  }, [faceOnly]);

  useEffect(() => {
    const sample = makeSampler();
    const state = {};
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const video = camera.videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
      const W = OUT_WIDTH, H = Math.round((OUT_WIDTH * video.videoHeight) / video.videoWidth);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const ctx = canvas.getContext("2d");
      const s = settings.current;
      if (s.mode === "ascii") renderAscii(ctx, W, H, sample, video, { cols: s.asciiCols, mirror: s.mirror, color: s.color });
      else if (s.mode === "watercolor") renderWatercolor(ctx, W, H, sample, video, { wet: s.wet, mirror: s.mirror }, state);
      else if (s.mode === "stitch") renderStitch(ctx, W, H, sample, video, { cols: s.stitchCols, mirror: s.mirror }, state);
      else renderPixel(ctx, W, H, sample, video, { cols: s.pixelCols, mirror: s.mirror, palette: s.palette, dither: s.dither });

      const bg = BACKGROUNDS[s.mode];
      if (s.faceOnly && face.current.model) {
        try { face.current.landmarks = detect("face", face.current.model, video).faceLandmarks?.[0] || null; } catch { face.current.landmarks = null; }
        applyFaceOnly(ctx, W, H, face.current.landmarks, s.mirror, bg);
        const found = !!face.current.landmarks;
        if (found !== face.current.found) { face.current.found = found; setFaceNote(found ? "" : "No face found."); }
      }
      if (build.current) {
        const progress = (performance.now() - build.current.start) / BUILD_MS;
        if (progress >= 1) build.current = null; else applyBuildUp(ctx, W, H, progress, bg, s.mode === "watercolor");
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [camera.videoRef]);

  // Keys 1, 2, 3 switch the look.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.matches?.("input, select, textarea") || event.metaKey || event.ctrlKey) return;
      const found = MODES.find((m) => m.key === event.key);
      if (found) setMode(found.id);
      else if (event.key === "b" || event.key === "B") startBuild();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startBuild]);

  // To the stage: the picture as an image cue. Same id each time, so the stage swaps the picture in place.
  const sendToStage = useCallback((why, fade = 0.3) => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width) return;
    const label = MODES.find((m) => m.id === settings.current.mode)?.label || "Picture";
    const cue = { id: "stylize", label, kind: "image", src: canvas.toDataURL("image/jpeg", 0.85), options: { fit: "contain", fadeIn: fade } };
    fireCue(cue);
    addLog({ ...cue, src: undefined }, why);
  }, [addLog]);

  // "Live to stage": about two pictures a second. The first one fades in; the rest swap straight in.
  useEffect(() => {
    if (!live) return undefined;
    // Every 150 ms: about 7 pictures a second while building up (so you see it grow), 2 a second otherwise.
    let first = true, n = 0;
    const timer = setInterval(() => {
      n += 1;
      if (!build.current && n % 3) return;
      sendToStage("live", first ? 0.3 : 0); first = false;
    }, 150);
    return () => clearInterval(timer);
  }, [live, sendToStage]);

  const savePng = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${mode}-${Date.now()}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });
  };

  return (
    <div className="sty-layout">
      <CameraBar camera={camera} mirror={mirror} setMirror={setMirror}>
        <div className="sty-modes" role="group" aria-label="Look">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={m.id === mode ? "is-on" : ""} aria-pressed={m.id === mode} onClick={() => setMode(m.id)}>
              {m.label} <kbd>{m.key}</kbd>
            </button>
          ))}
        </div>
      </CameraBar>

      <div className="sty-stage">
        <canvas ref={canvasRef} className="sty-canvas" width={OUT_WIDTH} height={720} aria-label={`Your camera as ${mode}`} />
        <video ref={camera.attach} className="sty-pip" autoPlay muted playsInline />
      </div>

      <div className="sty-controls">
        {mode === "ascii" && (
          <>
            <label>Characters across <input type="range" min="40" max="220" value={asciiCols} onChange={(e) => setAsciiCols(+e.target.value)} /> <span>{asciiCols}</span></label>
            <label className="cv-check"><input type="checkbox" checked={color} onChange={(e) => setColor(e.target.checked)} /> Color</label>
          </>
        )}
        {mode === "watercolor" && (
          <label>Wetness <input type="range" min="1" max="8" step="0.5" value={wet} onChange={(e) => setWet(+e.target.value)} /> <span>{wet}</span></label>
        )}
        {mode === "stitch" && (
          <label>Stitches across <input type="range" min="30" max="140" value={stitchCols} onChange={(e) => setStitchCols(+e.target.value)} /> <span>{stitchCols}</span></label>
        )}
        {mode === "pixel" && (
          <>
            <label>Pixels across <input type="range" min="32" max="200" value={pixelCols} onChange={(e) => setPixelCols(+e.target.value)} /> <span>{pixelCols}</span></label>
            <label>Palette <select value={palette} onChange={(e) => setPalette(e.target.value)}>
              {Object.entries(PALETTES).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
            </select></label>
            <label className="cv-check"><input type="checkbox" checked={dither} onChange={(e) => setDither(e.target.checked)} /> Dither</label>
          </>
        )}
        <label className="cv-check"><input type="checkbox" checked={faceOnly} onChange={(e) => setFaceOnly(e.target.checked)} /> Face only</label>
        <button type="button" onClick={startBuild}>Build up <kbd>B</kbd></button>
        <span className="cv-spacer" />
        <button type="button" onClick={() => sendToStage("button")}>Send picture to stage</button>
        <label className="cv-check"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Live to stage</label>
        <button type="button" className="cv-quiet" onClick={savePng}>Save PNG</button>
      </div>

      <Status items={[camera.status, camera.size && { tone: "muted", text: `Camera ${camera.size}` }, faceNote && { tone: "muted", text: faceNote }]} />
      <CueLog log={log} />
    </div>
  );
}
