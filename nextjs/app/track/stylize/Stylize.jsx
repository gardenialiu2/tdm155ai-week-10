"use client";

// Camera in, a different picture out: ASCII, watercolor, cross-stitch.
// The looks live in ./renderers.js. This file opens the camera, runs the draw loop, and sends pictures to the stage.

import { useCallback, useEffect, useRef, useState } from "react";
import { useCamera } from "../../../lib/cv/useCamera.js";
import { CameraBar, CueLog, Status, useCueLog } from "../../../lib/cv/ui.jsx";
import { fireCue } from "../../../lib/cv/stage.js";
import { makeSampler, renderAscii, renderStitch, renderWatercolor } from "./renderers.js";

const MODES = [
  { id: "ascii", label: "ASCII", key: "1" },
  { id: "watercolor", label: "Watercolor", key: "2" },
  { id: "stitch", label: "Cross-stitch", key: "3" },
];
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
  const [live, setLive] = useState(false);
  const [log, addLog] = useCueLog();

  // The draw loop reads the latest settings from a ref, so changing a slider never restarts the camera.
  const settings = useRef({});
  settings.current = { mode, mirror, color, asciiCols, stitchCols, wet };

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
      else renderStitch(ctx, W, H, sample, video, { cols: s.stitchCols, mirror: s.mirror }, state);
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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    let first = true;
    const timer = setInterval(() => { sendToStage("live", first ? 0.3 : 0); first = false; }, 500);
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
        <span className="cv-spacer" />
        <button type="button" onClick={() => sendToStage("button")}>Send picture to stage</button>
        <label className="cv-check"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Live to stage</label>
        <button type="button" className="cv-quiet" onClick={savePng}>Save PNG</button>
      </div>

      <Status items={[camera.status, camera.size && { tone: "muted", text: `Camera ${camera.size}` }]} />
      <CueLog log={log} />
    </div>
  );
}
