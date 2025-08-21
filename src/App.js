import React, { useEffect, useMemo, useRef, useState } from "react";

// Single-file prototype
// - Upload a photo
// - Repeat the image (3–6 times) growing left or right
// - Overlap (negative gap) or spaced (positive gap)
// - Choose newsroom background color
// - Choose canvas size preset
// - Anchor position for the stack + per-step scale and vertical offset
// - Download PNG

const PALETTE = [
  { name: "News Green", value: "#6BFF7A" },
  { name: "Lavender", value: "#C9B8FF" },
  { name: "Fuchsia", value: "#FF27B1" },
  { name: "Olive", value: "#6A5B17" },
  { name: "Black", value: "#000000" },
  { name: "White", value: "#FFFFFF" },
];

const SIZES = [
  { label: "1200 × 675 (16:9)", w: 1200, h: 675 },
  { label: "1920 × 1080 (HD)", w: 1920, h: 1080 },
  { label: "1200 × 1200 (Square)", w: 1200, h: 1200 },
  { label: "1600 × 900 (16:9)", w: 1600, h: 900 },
];

const ANCHORS = [
  { label: "Top Left", key: "tl" },
  { label: "Top Right", key: "tr" },
  { label: "Bottom Left", key: "bl" },
  { label: "Bottom Right", key: "br" },
  { label: "Center", key: "c" },
];

export default function App() {
  const canvasRef = useRef(null);
  const [bg, setBg] = useState(PALETTE[0].value);
  const [size, setSize] = useState(SIZES[0]);
  const [direction, setDirection] = useState("right"); // left | right
  const [repeats, setRepeats] = useState(3);
  const [gapPct, setGapPct] = useState(-18); // negative = overlap
  const [stepScale, setStepScale] = useState(90); // percent scale for each subsequent image
  const [yOffsetPct, setYOffsetPct] = useState(0); // vertical shift per step as % of image height
  const [anchor, setAnchor] = useState("br");
  const [padding, setPadding] = useState(24); // px from edges for anchored placement
  const [baseScalePct, setBaseScalePct] = useState(70); // base size relative to canvas shortest side
  const [imgURL, setImgURL] = useState(null);
  const [imgObj, setImgObj] = useState(null);
  const [dpiScale, setDpiScale] = useState(1);

  // Handle device pixel ratio for crisp exports
  useEffect(() => {
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    setDpiScale(ratio);
  }, []);

  // Load image from file input
  const onFile = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgURL((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    const img = new Image();
    img.onload = () => setImgObj(img);
    // Add an error handler for robustness
    img.onerror = () => {
      console.error("Failed to load image. Is it a valid image file?");
      setImgObj(null);
      setImgURL(null);
    };
    // The crossOrigin attribute is not needed for local files and can prevent them from loading.
    // img.crossOrigin = "anonymous";
    img.src = url;
  };

  // Draw routine
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const { w, h } = size;

    // Set backing store with dpiScale for sharpness. The actual pixel dimensions.
    canvas.width = w * dpiScale;
    canvas.height = h * dpiScale;
    
    // By removing the inline style properties for width and height,
    // we allow the CSS classes on the canvas element to control the display size, making it responsive.
    // The browser will use the canvas's width and height attributes to maintain the aspect ratio.

    ctx.setTransform(dpiScale, 0, 0, dpiScale, 0, 0);

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (!imgObj) return;

    // Compute base image size
    const shortest = Math.min(w, h);
    const baseTarget = (baseScalePct / 100) * shortest; // size along the image's shortest side

    const imgRatio = imgObj.width / imgObj.height;
    let drawW, drawH;
    if (imgRatio >= 1) {
      // landscape: set height to baseTarget
      drawH = baseTarget;
      drawW = baseTarget * imgRatio;
    } else {
      // portrait: set width to baseTarget
      drawW = baseTarget;
      drawH = baseTarget / imgRatio;
    }

    // Starting position based on anchor
    let startX = padding;
    let startY = padding;
    if (anchor.includes("r")) startX = w - padding - drawW;
    if (anchor.includes("b")) startY = h - padding - drawH;
    if (anchor === "c") {
      startX = (w - drawW) / 2;
      startY = (h - drawH) / 2;
    }

    // Direction multiplier and per-step offsets
    const dir = direction === "right" ? 1 : -1;
    const gapPx = (gapPct / 100) * drawW; // horizontal move per layer
    const yStepPx = (yOffsetPct / 100) * drawH; // vertical move per layer
    const scaleStep = stepScale / 100; // e.g., 0.9

    // Draw from back to front so foremost layer is the last (largest by default)
    const layers = Math.max(1, Math.min(6, repeats));

    for (let i = layers - 1; i >= 0; i--) {
      const s = Math.pow(scaleStep, i);
      const wI = drawW * s;
      const hI = drawH * s;

      // Anchor pivot: we want the stack to appear to step from the anchor corner.
      // We'll align each layer's reference corner at the same anchor point, then offset per gaps.
      let x = startX + dir * gapPx * i;
      let y = startY + yStepPx * i;

      // Adjust so scaling shrinks/expands from the anchor corner instead of center
      if (anchor === "tr") {
        x += drawW - wI;
      } else if (anchor === "bl") {
        y += drawH - hI;
      } else if (anchor === "br") {
        x += drawW - wI;
        y += drawH - hI;
      } else if (anchor === "c") {
        x += (drawW - wI) / 2;
        y += (drawH - hI) / 2;
      }

      ctx.drawImage(imgObj, x, y, wI, hI);
    }
  };

  // Redraw when dependencies change
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bg, size, direction, repeats, gapPct, stepScale, yOffsetPct, anchor, padding, baseScalePct, imgObj, dpiScale]);

  const handleDownload = (type = "image/png") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL(type, 0.95);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsroom-stylized${type === "image/jpeg" ? ".jpg" : ".png"}`;
    a.click();
  };

  const sizeOptions = useMemo(() => SIZES, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Newsroom Photo Stylizer</h1>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded-xl bg-neutral-900 text-white hover:opacity-90 transition-opacity"
              onClick={() => handleDownload("image/png")}
            >
              Download PNG
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-neutral-100 border border-neutral-300 hover:bg-neutral-200 transition-colors"
              onClick={() => handleDownload("image/jpeg")}
            >
              Download JPG
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Controls */}
        <section className="lg:col-span-4">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Upload Photo</label>
              <div
                className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer hover:bg-neutral-50 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) onFile(f);
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
              _id="uploader"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <label htmlFor="uploader" className="inline-block px-3 py-2 rounded-xl bg-neutral-900 text-white cursor-pointer hover:opacity-90 transition-opacity">Choose Image</label>
                {imgURL ? (
                  <p className="mt-2 text-xs text-neutral-600 truncate">Loaded: {imgURL.slice(0, 40)}...</p>
                ) : (
                  <p className="mt-2 text-xs text-neutral-600">Drop a file here or click to choose</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Canvas Size</label>
                <select
                  className="w-full rounded-xl border border-neutral-300 p-2 bg-white"
                  value={size.label}
                  onChange={(e) => {
                    const next = sizeOptions.find((s) => s.label === e.target.value);
                    if (next) setSize(next);
                  }}
                >
                  {sizeOptions.map((s) => (
                    <option key={s.label} value={s.label}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Background</label>
                <div className="flex gap-2 flex-wrap">
                  {PALETTE.map((c) => (
                    <button
                      key={c.value}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${bg === c.value ? "ring-2 ring-offset-2 ring-neutral-900 border-white" : "border-neutral-300 hover:border-neutral-500"}`}
                      style={{ background: c.value }}
                      onClick={() => setBg(c.value)}
                      aria-label={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Direction</label>
                <select
                  className="w-full rounded-xl border border-neutral-300 p-2 bg-white"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                >
                  <option value="right">Grow Right →</option>
                  <option value="left">Grow Left ←</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Anchor</label>
                <select
                  className="w-full rounded-xl border border-neutral-300 p-2 bg-white"
                  value={anchor}
                  onChange={(e) => setAnchor(e.target.value)}
                >
                  {ANCHORS.map((a) => (
                    <option key={a.key} value={a.key}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Repeats: {repeats}</label>
                <input type="range" min={1} max={6} value={repeats} onChange={(e) => setRepeats(parseInt(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium">Padding: {padding}px</label>
                <input type="range" min={0} max={200} value={padding} onChange={(e) => setPadding(parseInt(e.target.value))} className="w-full" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Base Image Size: {baseScalePct}% of shortest side</label>
              <input type="range" min={20} max={120} value={baseScalePct} onChange={(e) => setBaseScalePct(parseInt(e.target.value))} className="w-full" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium">Gap per Step: {gapPct}% width</label>
                <input type="range" min={-60} max={60} value={gapPct} onChange={(e) => setGapPct(parseInt(e.target.value))} className="w-full" />
                <p className="text-xs text-neutral-500">Negative overlaps</p>
              </div>
              <div>
                <label className="block text-sm font-medium">Scale Step: {stepScale}%</label>
                <input type="range" min={60} max={110} value={stepScale} onChange={(e) => setStepScale(parseInt(e.target.value))} className="w-full" />
                <p className="text-xs text-neutral-500">Each layer relative to previous</p>
              </div>
              <div>
                <label className="block text-sm font-medium">Y Offset: {yOffsetPct}% height</label>
                <input type="range" min={-60} max={60} value={yOffsetPct} onChange={(e) => setYOffsetPct(parseInt(e.target.value))} className="w-full" />
              </div>
            </div>

            <div className="text-xs text-neutral-500 pt-2 border-t border-neutral-200 mt-4">
              Tips: try <span className="font-medium">Grow Right</span>, <span className="font-medium">Anchor: Bottom Right</span>, Gap -18%, Scale Step 90%, Y Offset 0% for the overlapping look in your comps.
            </div>
          </div>
        </section>

        {/* Canvas Preview */}
        <section className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm sticky top-20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-neutral-600">Preview</h2>
              <span className="text-xs text-neutral-500">{size.w}×{size.h}px • DPR {dpiScale.toFixed(2)}</span>
            </div>
            {/* MODIFIED: Removed overflow-auto so the container itself doesn't scroll */}
            <div className="w-full rounded-xl bg-neutral-100 p-3 flex items-center justify-center">
              {/* MODIFIED: Added max-w-full and h-auto to make the canvas scale down to fit its container */}
              <canvas ref={canvasRef} className="block rounded-md shadow-inner bg-white max-w-full h-auto"/>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
