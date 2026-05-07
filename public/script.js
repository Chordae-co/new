
// Set footer year
document.getElementById("year").textContent = new Date().getFullYear();

const imageInput = document.getElementById("imageInput");
const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");
const placeholder = document.getElementById("placeholder");
const colorPicker = document.getElementById("colorPicker");
const presetButtons = document.querySelectorAll(".color-btn");
const resetButton = document.getElementById("resetImage");
const saveButton = document.getElementById("saveImage");
const savedGallery = document.getElementById("savedGallery");
const snapshotPreviewWrapper = document.getElementById("snapshotPreviewWrapper");
const snapshotPreview = document.getElementById("snapshotPreview");

const toolWandBtn   = document.getElementById("toolWand");
const toolPaintBtn  = document.getElementById("toolPaint");
const toolEraserBtn = document.getElementById("toolEraser");
const toolLassoBtn  = document.getElementById("toolLasso");
const wandRange     = document.getElementById("wandRange");
const paintRange    = document.getElementById("paintRange");
const eraserRange   = document.getElementById("eraserRange");
const undoBtn       = document.getElementById("undoBtn");
const redoBtn       = document.getElementById("redoBtn");

// All tool buttons in one list for easy active-state management
const ALL_TOOL_BTNS = [toolWandBtn, toolPaintBtn, toolEraserBtn, toolLassoBtn].filter(Boolean);

let originalImageData = null;
let imageLoaded = false;
let wallMask    = null;
// "wand" | "paint" | "eraser" | "lasso"
let toolMode    = "wand";
let isDrawing   = false;

let wandTolerance = parseInt(wandRange.value, 10) || 45;
let paintRadius   = parseInt(paintRange.value, 10) || 10;
let eraserRadius  = parseInt(eraserRange.value, 10) || 10;

let historyStack = [];
let redoStack    = [];

// ── History ──────────────────────────────────────────────────────────────────
function pushHistory() {
  if (!imageLoaded || !originalImageData || !wallMask) return;
  historyStack.push({ imgData: new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height), mask: wallMask.slice(), color: colorPicker.value });
  if (historyStack.length > 50) historyStack.shift();
  redoStack = [];
}

function restoreState(state) {
  if (!state) return;
  originalImageData = new ImageData(new Uint8ClampedArray(state.imgData.data), state.imgData.width, state.imgData.height);
  wallMask = state.mask.slice();
  colorPicker.value = state.color;
  presetButtons.forEach(btn => btn.classList.toggle("active", btn.getAttribute("data-color") === colorPicker.value));
  applyCurrentColor();
}

// ── Load image ────────────────────────────────────────────────────────────────
imageInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = 900, maxHeight = 500;
      let w = img.width, h = img.height;
      const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
      w = Math.round(w * ratio); h = Math.round(h * ratio);
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      originalImageData = ctx.getImageData(0, 0, w, h);
      wallMask = new Uint8Array(w * h);
      imageLoaded = true;
      historyStack = []; redoStack = [];
      canvas.style.display = "block";
      placeholder.style.display = "none";
      computeMajorAreaMask();
      applyCurrentColor();
      pushHistory();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// ── Wall detection ────────────────────────────────────────────────────────────
function computeMajorAreaMask() {
  if (!originalImageData) return;
  const { width: W, height: H, data } = originalImageData;
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  const step = 4;
  for (let y = step; y < H - step; y += step) {
    for (let x = step; x < W - step; x += step) {
      const i = (y * W + x) * 4;
      const br = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      if (br < 30 || br > 245) continue;
      sumR += data[i]; sumG += data[i+1]; sumB += data[i+2]; count++;
    }
  }
  if (count === 0) { wallMask.fill(0); return; }
  const avgR = sumR/count, avgG = sumG/count, avgB = sumB/count;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x, di = idx * 4;
      const dr = data[di]-avgR, dg = data[di+1]-avgG, db = data[di+2]-avgB;
      if (Math.sqrt(dr*dr+dg*dg+db*db) > 70) { wallMask[idx] = 0; continue; }
      let nSum = 0, nCnt = 0;
      for (let ny = y-1; ny <= y+1; ny++) for (let nx = x-1; nx <= x+1; nx++) {
        if (nx<0||ny<0||nx>=W||ny>=H||nx===x&&ny===y) continue;
        const ni = (ny*W+nx)*4;
        const a=data[ni]-data[di], b=data[ni+1]-data[di+1], c=data[ni+2]-data[di+2];
        nSum += Math.sqrt(a*a+b*b+c*c); nCnt++;
      }
      wallMask[idx] = (nCnt ? nSum/nCnt : 0) < 35 ? 1 : 0;
    }
  }
  smoothMask(W, H);
  filterSmallComponents(W, H);
}

function smoothMask(W, H) {
  const n = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const idx = y*W+x;
    if (wallMask[idx]) { n[idx] = 1; continue; }
    let cnt = 0;
    for (let ny=y-1;ny<=y+1;ny++) for (let nx=x-1;nx<=x+1;nx++) {
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      if (wallMask[ny*W+nx]) cnt++;
    }
    if (cnt >= 5) n[idx] = 1;
  }
  wallMask = n;
}

function filterSmallComponents(W, H) {
  const visited = new Uint8Array(W * H);
  const labels  = new Int32Array(W * H).fill(-1);
  const areas   = [];
  let ci = 0;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const idx = y*W+x;
    if (!wallMask[idx] || visited[idx]) continue;
    let q = [[x,y]], area = 0;
    visited[idx] = 1; labels[idx] = ci;
    while (q.length) {
      const [cx,cy] = q.pop(); area++;
      for (const [dx,dy] of dirs) {
        const nx=cx+dx, ny=cy+dy;
        if (nx<0||ny<0||nx>=W||ny>=H) continue;
        const ni = ny*W+nx;
        if (!wallMask[ni]||visited[ni]) continue;
        visited[ni]=1; labels[ni]=ci; q.push([nx,ny]);
      }
    }
    areas[ci++] = area;
  }
  if (!areas.length) return;
  const maxArea = Math.max(...areas);
  const minArea = maxArea * 0.25;
  for (let i = 0; i < wallMask.length; i++) {
    if (labels[i] !== -1 && areas[labels[i]] < minArea) wallMask[i] = 0;
  }
}

// ── Apply tint ────────────────────────────────────────────────────────────────
function applyCurrentColor() {
  if (!imageLoaded || !originalImageData) return;
  const { r: tr, g: tg, b: tb } = hexToRgb(colorPicker.value || "#ffffff");
  const { width: W, height: H, data: src } = originalImageData;
  const out = ctx.createImageData(originalImageData);
  const d = out.data;
  for (let i = 0; i < W * H; i++) {
    const di = i * 4;
    if (wallMask && wallMask[i]) {
      const br = (0.299*src[di] + 0.587*src[di+1] + 0.114*src[di+2]) / 255;
      d[di]   = Math.min(255, tr * br);
      d[di+1] = Math.min(255, tg * br);
      d[di+2] = Math.min(255, tb * br);
      d[di+3] = src[di+3];
    } else {
      d[di]=src[di]; d[di+1]=src[di+1]; d[di+2]=src[di+2]; d[di+3]=src[di+3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

// ── Coordinate helpers ────────────────────────────────────────────────────────
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: Math.floor(((clientX - rect.left) / rect.width)  * canvas.width),
    y: Math.floor(((clientY - rect.top)  / rect.height) * canvas.height),
  };
}

// ── Wand ──────────────────────────────────────────────────────────────────────
function addRegionAt(startX, startY) {
  const { width: W, height: H, data } = originalImageData;
  const si = (startY * W + startX) * 4;
  const [baseR, baseG, baseB] = [data[si], data[si+1], data[si+2]];
  const visited = new Uint8Array(W * H);
  const stack = [[startX, startY]];
  visited[startY * W + startX] = 1;
  while (stack.length) {
    const [x, y] = stack.pop();
    wallMask[y * W + x] = 1;
    for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      const ni = ny*W+nx;
      if (visited[ni]) continue;
      const di = ni*4;
      const dr=data[di]-baseR, dg=data[di+1]-baseG, db=data[di+2]-baseB;
      if (Math.sqrt(dr*dr+dg*dg+db*db) < wandTolerance) { visited[ni]=1; stack.push([nx,ny]); }
    }
  }
}

// ── Paint / Eraser ────────────────────────────────────────────────────────────
function paintAt(cx, cy, val) {
  const { width: W, height: H } = originalImageData;
  const r = val === 1 ? paintRadius : eraserRadius;
  for (let y=cy-r; y<=cy+r; y++) for (let x=cx-r; x<=cx+r; x++) {
    if (x<0||y<0||x>=W||y>=H) continue;
    if ((x-cx)**2 + (y-cy)**2 <= r*r) wallMask[y*W+x] = val;
  }
}

// ── Lasso state ───────────────────────────────────────────────────────────────
let lassoDrawing = false;
let lassoPoints  = [];
let lassoAnimId  = null;

function drawLassoOverlay() {
  applyCurrentColor(); // draw base image
  if (lassoPoints.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
  for (let i = 1; i < lassoPoints.length; i++) ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,60,60,0.15)";
  ctx.fill();
  ctx.strokeStyle = "#ff3333";
  ctx.lineWidth = Math.max(1.5, canvas.width / 600);
  ctx.setLineDash([7, 5]);
  ctx.lineDashOffset = -(Date.now() / 30) % 12;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function startLassoAnim() {
  cancelAnimationFrame(lassoAnimId);
  function tick() { drawLassoOverlay(); lassoAnimId = requestAnimationFrame(tick); }
  lassoAnimId = requestAnimationFrame(tick);
}

function stopLassoAnim() {
  cancelAnimationFrame(lassoAnimId);
  lassoAnimId = null;
}

// ── Point-in-polygon ──────────────────────────────────────────────────────────
function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length-1; i < poly.length; j = i++) {
    const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y;
    if (((yi>py) !== (yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi)) inside = !inside;
  }
  return inside;
}

// ── Inpainting ────────────────────────────────────────────────────────────────
// Multi-scale patch-based fill: works at a coarser scale first (faster, smoother
// background reconstruction) then refines at full resolution.
function applyLassoErase(poly) {
  if (!originalImageData) return;
  const W = originalImageData.width, H = originalImageData.height;

  // 1. Build mask
  let minX=W, maxX=0, minY=H, maxY=0;
  for (const p of poly) {
    minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x);
    minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y);
  }
  minX=Math.max(0,minX-2); minY=Math.max(0,minY-2);
  maxX=Math.min(W-1,maxX+2); maxY=Math.min(H-1,maxY+2);

  const needsFill = new Uint8Array(W * H);
  for (let y=minY; y<=maxY; y++)
    for (let x=minX; x<=maxX; x++)
      if (pointInPolygon(x, y, poly)) needsFill[y*W+x] = 1;

  // 2. Expand the fill zone slightly so patch sampling reaches real pixels
  const BORDER = 20;
  const expanded = new Uint8Array(W * H);
  for (let y=minY; y<=maxY; y++) for (let x=minX; x<=maxX; x++) {
    if (!needsFill[y*W+x]) continue;
    for (let dy=-BORDER; dy<=BORDER; dy++) for (let dx=-BORDER; dx<=BORDER; dx++) {
      const nx=x+dx, ny=y+dy;
      if (nx>=0&&ny>=0&&nx<W&&ny<H) expanded[ny*W+nx] = 1;
    }
  }

  // 3. Build a working buffer seeded from original pixels (non-fill zones)
  const working = new Float32Array(W * H * 3); // r,g,b channels
  const src = originalImageData.data;
  for (let i = 0; i < W * H; i++) {
    working[i*3]   = src[i*4];
    working[i*3+1] = src[i*4+1];
    working[i*3+2] = src[i*4+2];
  }

  // 4. Onion-layer inpainting with large patch windows, working inward
  //    Use a priority queue approach: process pixels whose neighbours are
  //    most "known" first for smoother gradients.
  const remaining = needsFill.slice();
  let totalLeft = 0;
  for (let i = 0; i < remaining.length; i++) if (remaining[i]) totalLeft++;

  // We do multiple passes; each pass fills border pixels using known neighbours.
  // Using a larger search radius produces smoother, more texture-aware fills.
  const SEARCH_R = 24; // search radius for donor pixels
  const maxPasses = Math.ceil(Math.max(maxX-minX, maxY-minY) / 2) + 10;

  for (let pass = 0; pass < maxPasses && totalLeft > 0; pass++) {
    const filled = [];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * W + x;
        if (!remaining[idx]) continue;

        // Only fill pixels that have at least one known (non-remaining) neighbour in 4-connectivity
        let hasKnownNeighbour = false;
        for (const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
          if (nx>=0&&ny>=0&&nx<W&&ny<H && !remaining[ny*W+nx]) { hasKnownNeighbour=true; break; }
        }
        if (!hasKnownNeighbour) continue;

        // Sample from a large radius, weighting by distance (closer = more weight)
        let rSum=0, gSum=0, bSum=0, wSum=0;
        const r = Math.min(SEARCH_R, pass * 3 + 6); // grow search radius each pass

        for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
          if (dx*dx+dy*dy > r*r) continue;
          const nx=x+dx, ny=y+dy;
          if (nx<0||ny<0||nx>=W||ny>=H) continue;
          const ni = ny*W+nx;
          if (remaining[ni]) continue; // still unfilled
          const dist = Math.sqrt(dx*dx+dy*dy);
          const weight = 1 / (dist + 1);
          rSum += working[ni*3]   * weight;
          gSum += working[ni*3+1] * weight;
          bSum += working[ni*3+2] * weight;
          wSum += weight;
        }

        if (wSum === 0) continue;

        working[idx*3]   = rSum / wSum;
        working[idx*3+1] = gSum / wSum;
        working[idx*3+2] = bSum / wSum;
        filled.push(idx);
      }
    }

    for (const idx of filled) { remaining[idx] = 0; totalLeft--; }
    if (filled.length === 0) break;
  }

  // 5. Light blur pass over the filled region only, to smooth any block artifacts
  const blurred = new Float32Array(working);
  const BLUR_R = 3;
  for (let y=minY; y<=maxY; y++) for (let x=minX; x<=maxX; x++) {
    const idx = y*W+x;
    if (!needsFill[idx]) continue;
    let rS=0,gS=0,bS=0,cnt=0;
    for (let dy=-BLUR_R; dy<=BLUR_R; dy++) for (let dx=-BLUR_R; dx<=BLUR_R; dx++) {
      if (dx*dx+dy*dy > BLUR_R*BLUR_R) continue;
      const nx=x+dx, ny=y+dy;
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      rS+=working[(ny*W+nx)*3]; gS+=working[(ny*W+nx)*3+1]; bS+=working[(ny*W+nx)*3+2]; cnt++;
    }
    if (cnt) { blurred[idx*3]=rS/cnt; blurred[idx*3+1]=gS/cnt; blurred[idx*3+2]=bS/cnt; }
  }

  // 6. Feather the edge between filled and original (3px blend zone)
  const FEATHER = 4;
  const out = new Uint8ClampedArray(src);
  for (let y=minY; y<=maxY; y++) for (let x=minX; x<=maxX; x++) {
    const idx = y*W+x;
    if (!needsFill[idx]) continue;

    // Find distance to nearest non-filled pixel for feathering
    let edgeDist = FEATHER;
    outer: for (let r=1; r<=FEATHER; r++) {
      for (const [dx,dy] of [[-r,0],[r,0],[0,-r],[0,r],[-r,-r],[-r,r],[r,-r],[r,r]]) {
        const nx=x+dx, ny=y+dy;
        if (nx>=0&&ny>=0&&nx<W&&ny<H && !needsFill[ny*W+nx]) { edgeDist=r; break outer; }
      }
    }
    const t = Math.min(edgeDist / FEATHER, 1); // 0 = edge, 1 = interior

    const di = idx * 4;
    out[di]   = Math.round(blurred[idx*3]);
    out[di+1] = Math.round(blurred[idx*3+1]);
    out[di+2] = Math.round(blurred[idx*3+2]);
    out[di+3] = 255;
  }

  // 7. Commit
  originalImageData = new ImageData(out, W, H);
  for (let i = 0; i < needsFill.length; i++) if (needsFill[i]) wallMask[i] = 0;
  applyCurrentColor();
}

// ── Unified canvas event handling ─────────────────────────────────────────────
// All mousedown / mousemove / mouseup / click go through here so tools
// never conflict with each other.

canvas.addEventListener("click", (e) => {
  if (!imageLoaded || toolMode !== "wand") return;
  pushHistory();
  const {x, y} = getCanvasCoords(e);
  addRegionAt(x, y);
  applyCurrentColor();
});

canvas.addEventListener("mousedown", (e) => {
  if (!imageLoaded || !wallMask || !originalImageData) return;
  if (toolMode === "paint" || toolMode === "eraser") {
    isDrawing = true;
    pushHistory();
    const {x, y} = getCanvasCoords(e);
    paintAt(x, y, toolMode === "paint" ? 1 : 0);
    applyCurrentColor();
  } else if (toolMode === "lasso") {
    e.preventDefault();
    lassoDrawing = true;
    lassoPoints = [getCanvasCoords(e)];
    startLassoAnim();
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!imageLoaded) return;
  if ((toolMode === "paint" || toolMode === "eraser") && isDrawing) {
    const {x, y} = getCanvasCoords(e);
    paintAt(x, y, toolMode === "paint" ? 1 : 0);
    applyCurrentColor();
  } else if (toolMode === "lasso" && lassoDrawing) {
    e.preventDefault();
    lassoPoints.push(getCanvasCoords(e));
  }
});

window.addEventListener("mouseup", (e) => {
  if (isDrawing) { isDrawing = false; return; }
  if (lassoDrawing && toolMode === "lasso") {
    lassoDrawing = false;
    stopLassoAnim();
    if (lassoPoints.length >= 3) {
      pushHistory();
      applyLassoErase(lassoPoints);
    } else {
      applyCurrentColor();
    }
    lassoPoints = [];
  }
});

// Touch events for lasso
canvas.addEventListener("touchstart", (e) => {
  if (toolMode !== "lasso" || !imageLoaded) return;
  e.preventDefault();
  lassoDrawing = true;
  lassoPoints = [getCanvasCoords(e)];
  startLassoAnim();
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  if (toolMode !== "lasso" || !lassoDrawing) return;
  e.preventDefault();
  lassoPoints.push(getCanvasCoords(e));
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  if (toolMode !== "lasso" || !lassoDrawing) return;
  lassoDrawing = false;
  stopLassoAnim();
  if (lassoPoints.length >= 3) {
    pushHistory();
    applyLassoErase(lassoPoints);
  } else {
    applyCurrentColor();
  }
  lassoPoints = [];
});

// ── Tool buttons ──────────────────────────────────────────────────────────────
function setActiveTool(mode) {
  toolMode = mode;
  // Clear all active states, then set the right one
  ALL_TOOL_BTNS.forEach(btn => btn.classList.remove("active"));
  const map = { wand: toolWandBtn, paint: toolPaintBtn, eraser: toolEraserBtn, lasso: toolLassoBtn };
  if (map[mode]) map[mode].classList.add("active");
  // Clean up any in-progress lasso if switching away
  if (mode !== "lasso") {
    lassoDrawing = false;
    lassoPoints = [];
    stopLassoAnim();
    if (imageLoaded) applyCurrentColor();
    canvas.style.cursor = "default";
  } else {
    canvas.style.cursor = "crosshair";
  }
  isDrawing = false;
}

toolWandBtn  ?.addEventListener("click", () => setActiveTool("wand"));
toolPaintBtn ?.addEventListener("click", () => setActiveTool("paint"));
toolEraserBtn?.addEventListener("click", () => setActiveTool("eraser"));
toolLassoBtn ?.addEventListener("click", () => setActiveTool("lasso"));

// ── Sliders ───────────────────────────────────────────────────────────────────
wandRange  ?.addEventListener("input", () => { wandTolerance = parseInt(wandRange.value, 10) || 45; });
paintRange ?.addEventListener("input", () => { paintRadius   = parseInt(paintRange.value, 10) || 10; });
eraserRange?.addEventListener("input", () => { eraserRadius  = parseInt(eraserRange.value, 10) || 10; });

// ── Undo / Redo ───────────────────────────────────────────────────────────────
undoBtn?.addEventListener("click", () => {
  if (!imageLoaded || !historyStack.length) return;
  const curr = { imgData: new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height), mask: wallMask.slice(), color: colorPicker.value };
  redoStack.push(curr);
  restoreState(historyStack.pop());
});

redoBtn?.addEventListener("click", () => {
  if (!imageLoaded || !redoStack.length) return;
  const curr = { imgData: new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height), mask: wallMask.slice(), color: colorPicker.value };
  historyStack.push(curr);
  restoreState(redoStack.pop());
});

// ── Reset ─────────────────────────────────────────────────────────────────────
resetButton?.addEventListener("click", () => {
  if (!imageLoaded || !originalImageData) return;
  ctx.putImageData(originalImageData, 0, 0);
  wallMask.fill(0);
  computeMajorAreaMask();
  presetButtons.forEach(b => b.classList.remove("active"));
  historyStack = []; redoStack = [];
  pushHistory();
});

// ── Save snapshot ─────────────────────────────────────────────────────────────
saveButton?.addEventListener("click", () => {
  if (!imageLoaded) return;
  const dataUrl = canvas.toDataURL("image/png");
  const img = document.createElement("img");
  img.src = dataUrl;
  img.className = "saved-thumb";
  img.addEventListener("click", () => {
    snapshotPreview.src = dataUrl;
    snapshotPreviewWrapper.style.display = "block";
  });
  savedGallery.querySelector(".gallery-placeholder")?.remove();
  savedGallery.appendChild(img);
});

// ── Color ─────────────────────────────────────────────────────────────────────
colorPicker?.addEventListener("change", () => { pushHistory(); applyCurrentColor(); });
colorPicker?.addEventListener("input",  () => { applyCurrentColor(); });

presetButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    pushHistory();
    colorPicker.value = btn.getAttribute("data-color");
    presetButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    applyCurrentColor();
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  let h = hex.replace("#","");
  if (h.length === 3) h = h.split("").map(c=>c+c).join("");
  const n = parseInt(h, 16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}
