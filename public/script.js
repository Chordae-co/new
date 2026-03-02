
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

const toolWandBtn = document.getElementById("toolWand");
const toolPaintBtn = document.getElementById("toolPaint");
const toolEraserBtn = document.getElementById("toolEraser");
const wandRange = document.getElementById("wandRange");
const paintRange = document.getElementById("paintRange");
const eraserRange = document.getElementById("eraserRange");

const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

let originalImageData = null;
let imageLoaded = false;
let wallMask = null; // 1 = wall/major area
let toolMode = "wand"; // "wand" | "paint" | "eraser"
let isDrawing = false;

let wandTolerance = parseInt(wandRange.value, 10) || 45;
let paintRadius = parseInt(paintRange.value, 10) || 10;
let eraserRadius = parseInt(eraserRange.value, 10) || 10;

// Undo/redo stacks
let historyStack = [];
let redoStack = [];

// ---- History helpers ----
function pushHistory() {
  if (!imageLoaded || !originalImageData || !wallMask) return;
  const snapshot = {
    mask: wallMask.slice(),
    color: colorPicker.value
  };
  historyStack.push(snapshot);
  if (historyStack.length > 50) {
    historyStack.shift();
  }
  redoStack = [];
}

function restoreState(state) {
  if (!state) return;
  wallMask = state.mask.slice();
  colorPicker.value = state.color;
  // restore preset active state if any
  presetButtons.forEach((btn) => {
    const c = btn.getAttribute("data-color");
    btn.classList.toggle("active", colorToHex(c) === colorPicker.value);
  });
  applyCurrentColor();
}

// ---- Load image ----
imageInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = 900;
      const maxHeight = 500;
      let width = img.width;
      let height = img.height;
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      originalImageData = ctx.getImageData(0, 0, width, height);
      wallMask = new Uint8Array(width * height);
      imageLoaded = true;
      historyStack = [];
      redoStack = [];

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

// ---- Object / wall detection: average color + smoothness + component filtering ----
function computeMajorAreaMask() {
  if (!originalImageData) return;
  const width = originalImageData.width;
  const height = originalImageData.height;
  const data = originalImageData.data;

  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  const step = 4;

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      if (brightness < 30 || brightness > 245) continue; // skip extremes
      sumR += r;
      sumG += g;
      sumB += b;
      count++;
    }
  }

  if (count === 0) {
    wallMask.fill(0);
    return;
  }

  const avgR = sumR / count;
  const avgG = sumG / count;
  const avgB = sumB / count;

  const threshold = 70;        // color distance from major tone
  const varianceLimit = 35;    // local smoothness: lower = fewer objects/edges

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idxPix = y * width + x;
      const di = idxPix * 4;
      const r = data[di];
      const g = data[di + 1];
      const b = data[di + 2];

      const dr = r - avgR;
      const dg = g - avgG;
      const db = b - avgB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      if (dist > threshold) {
        wallMask[idxPix] = 0;
        continue;
      }

      // Local variance: compare to neighbors; high variance => likely object/edge, not flat wall
      let neighborCount = 0;
      let neighborDistSum = 0;
      for (let ny = y - 1; ny <= y + 1; ny++) {
        for (let nx = x - 1; nx <= x + 1; nx++) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (nx === x && ny === y) continue;
          const ni = (ny * width + nx) * 4;
          const nr = data[ni];
          const ng = data[ni + 1];
          const nb = data[ni + 2];
          const drr = nr - r;
          const dgg = ng - g;
          const dbb = nb - b;
          const nd = Math.sqrt(drr * drr + dgg * dgg + dbb * dbb);
          neighborDistSum += nd;
          neighborCount++;
        }
      }
      const neighborAvgDist = neighborCount ? neighborDistSum / neighborCount : 0;

      wallMask[idxPix] = neighborAvgDist < varianceLimit ? 1 : 0;
    }
  }

  smoothMask(width, height);
  filterSmallComponents(width, height);
}

// Morphological smoothing using neighbor voting
function smoothMask(width, height) {
  const newMask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (wallMask[idx]) {
        newMask[idx] = 1;
        continue;
      }
      let neighborCount = 0;
      for (let ny = y - 1; ny <= y + 1; ny++) {
        for (let nx = x - 1; nx <= x + 1; nx++) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (wallMask[ny * width + nx]) neighborCount++;
        }
      }
      if (neighborCount >= 5) newMask[idx] = 1;
    }
  }
  wallMask = newMask;
}

// Second layer: remove small isolated regions (likely objects) and keep big wall blobs
function filterSmallComponents(width, height) {
  const visited = new Uint8Array(width * height);
  const labels = new Int32Array(width * height);
  labels.fill(-1);
  const areas = [];
  let compIndex = 0;

  const neighbors = [
    [1, 0], [-1, 0], [0, 1], [0, -1]
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!wallMask[idx] || visited[idx]) continue;

      let queue = [[x, y]];
      visited[idx] = 1;
      labels[idx] = compIndex;
      let area = 0;

      while (queue.length > 0) {
        const [cx, cy] = queue.pop();
        const cidx = cy * width + cx;
        area++;

        for (const [dx, dy] of neighbors) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nidx = ny * width + nx;
          if (!wallMask[nidx] || visited[nidx]) continue;
          visited[nidx] = 1;
          labels[nidx] = compIndex;
          queue.push([nx, ny]);
        }
      }

      areas[compIndex] = area;
      compIndex++;
    }
  }

  if (areas.length === 0) return;

  let maxArea = 0;
  for (let i = 0; i < areas.length; i++) {
    if (areas[i] > maxArea) maxArea = areas[i];
  }

  const minArea = maxArea * 0.25; // keep only regions that are at least 25% of largest blob

  for (let i = 0; i < wallMask.length; i++) {
    const label = labels[i];
    if (label === -1) continue;
    if (areas[label] < minArea) {
      wallMask[i] = 0;
    }
  }
}

// ---- Apply tint using mask (wall only) ----
function applyCurrentColor() {
  if (!imageLoaded || !originalImageData) return;

  const hex = colorPicker.value || "#ffffff";
  const { r: tr, g: tg, b: tb } = hexToRgb(hex);

  const width = originalImageData.width;
  const height = originalImageData.height;

  const origData = originalImageData.data;
  const out = ctx.createImageData(originalImageData);
  const outData = out.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idxPix = y * width + x;
      const di = idxPix * 4;

      const r = origData[di];
      const g = origData[di + 1];
      const b = origData[di + 2];
      const a = origData[di + 3];

      if (wallMask && wallMask[idxPix]) {
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        outData[di]     = Math.min(255, tr * brightness);
        outData[di + 1] = Math.min(255, tg * brightness);
        outData[di + 2] = Math.min(255, tb * brightness);
        outData[di + 3] = a;
      } else {
        outData[di]     = r;
        outData[di + 1] = g;
        outData[di + 2] = b;
        outData[di + 3] = a;
      }
    }
  }

  ctx.putImageData(out, 0, 0);
}

// ---- Tools: Magic select, Paint brush, Eraser ----
function getCanvasCoords(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
  return { x, y };
}

// Magic select: always adds a region to the wall, never erases
canvas.addEventListener("click", (event) => {
  if (!imageLoaded || !wallMask || !originalImageData) return;
  if (toolMode !== "wand") return;

  pushHistory();
  const { x, y } = getCanvasCoords(event);
  addRegionAt(x, y);
  applyCurrentColor();
});

function addRegionAt(startX, startY) {
  const width = originalImageData.width;
  const height = originalImageData.height;
  const data = originalImageData.data;

  const startIdx = (startY * width + startX) * 4;
  const baseR = data[startIdx];
  const baseG = data[startIdx + 1];
  const baseB = data[startIdx + 2];

  const tolerance = wandTolerance; // controlled by slider
  const visited = new Uint8Array(width * height);
  const stack = [[startX, startY]];
  visited[startY * width + startX] = 1;

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const idxPix = y * width + x;
    wallMask[idxPix] = 1; // always painting/add

    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIdxPix = ny * width + nx;
      if (visited[nIdxPix]) continue;

      const di = nIdxPix * 4;
      const r = data[di];
      const g = data[di + 1];
      const b = data[di + 2];
      const dr = r - baseR;
      const dg = g - baseG;
      const db = b - baseB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      if (dist < tolerance) {
        visited[nIdxPix] = 1;
        stack.push([nx, ny]);
      }
    }
  }
}

// Paint/Eraser: click & drag to modify mask in a brush radius
canvas.addEventListener("mousedown", (event) => {
  if (!imageLoaded || !wallMask || !originalImageData) return;
  if (toolMode !== "paint" && toolMode !== "eraser") return;

  isDrawing = true;
  pushHistory();
  const { x, y } = getCanvasCoords(event);

  if (toolMode === "paint") {
    paintAt(x, y);
  } else if (toolMode === "eraser") {
    eraseAt(x, y);
  }
  applyCurrentColor();
});

canvas.addEventListener("mousemove", (event) => {
  if (!isDrawing) return;
  if (!imageLoaded || !wallMask || !originalImageData) return;
  if (toolMode !== "paint" && toolMode !== "eraser") return;

  const { x, y } = getCanvasCoords(event);
  if (toolMode === "paint") {
    paintAt(x, y);
  } else if (toolMode === "eraser") {
    eraseAt(x, y);
  }
  applyCurrentColor();
});

window.addEventListener("mouseup", () => {
  isDrawing = false;
});

function paintAt(cx, cy) {
  const width = originalImageData.width;
  const height = originalImageData.height;
  const r = paintRadius;

  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const idxPix = y * width + x;
      wallMask[idxPix] = 1;
    }
  }
}

function eraseAt(cx, cy) {
  const width = originalImageData.width;
  const height = originalImageData.height;
  const r = eraserRadius;

  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const idxPix = y * width + x;
      wallMask[idxPix] = 0;
    }
  }
}

// Tool mode buttons
toolWandBtn.addEventListener("click", () => {
  toolMode = "wand";
  toolWandBtn.classList.add("active");
  toolPaintBtn.classList.remove("active");
  toolEraserBtn.classList.remove("active");
});

toolPaintBtn.addEventListener("click", () => {
  toolMode = "paint";
  toolPaintBtn.classList.add("active");
  toolWandBtn.classList.remove("active");
  toolEraserBtn.classList.remove("active");
});

toolEraserBtn.addEventListener("click", () => {
  toolMode = "eraser";
  toolEraserBtn.classList.add("active");
  toolWandBtn.classList.remove("active");
  toolPaintBtn.classList.remove("active");
});

// Sliders
wandRange.addEventListener("input", () => {
  wandTolerance = parseInt(wandRange.value, 10) || 45;
});

paintRange.addEventListener("input", () => {
  paintRadius = parseInt(paintRange.value, 10) || 10;
});

eraserRange.addEventListener("input", () => {
  eraserRadius = parseInt(eraserRange.value, 10) || 10;
});

// ---- Undo/Redo ----
undoBtn.addEventListener("click", () => {
  if (!imageLoaded) return;
  if (historyStack.length === 0) return;
  const currentState = {
    mask: wallMask.slice(),
    color: colorPicker.value
  };
  const prevState = historyStack.pop();
  redoStack.push(currentState);
  restoreState(prevState);
});

redoBtn.addEventListener("click", () => {
  if (!imageLoaded) return;
  if (redoStack.length === 0) return;
  const currentState = {
    mask: wallMask.slice(),
    color: colorPicker.value
  };
  const nextState = redoStack.pop();
  historyStack.push(currentState);
  restoreState(nextState);
});

// ---- Reset to original photo (no tint, fresh mask) ----
resetButton.addEventListener("click", () => {
  if (!imageLoaded || !originalImageData) return;
  ctx.putImageData(originalImageData, 0, 0);
  if (wallMask) wallMask.fill(0);
  computeMajorAreaMask(); // rebuild from original
  presetButtons.forEach((b) => b.classList.remove("active"));
  historyStack = [];
  redoStack = [];
  pushHistory();
});

// ---- Save current canvas as snapshot thumbnail (inline preview) ----
saveButton.addEventListener("click", () => {
  if (!imageLoaded) return;
  const dataUrl = canvas.toDataURL("image/png");
  const img = document.createElement("img");
  img.src = dataUrl;
  img.className = "saved-thumb";

  img.addEventListener("click", () => {
    snapshotPreview.src = dataUrl;
    snapshotPreviewWrapper.style.display = "block";
  });

  const placeholderEl = savedGallery.querySelector(".gallery-placeholder");
  if (placeholderEl) placeholderEl.remove();

  savedGallery.appendChild(img);
});

// ---- Color picker and presets ----
colorPicker.addEventListener("change", () => {
  pushHistory();
  applyCurrentColor();
});

colorPicker.addEventListener("input", () => {
  applyCurrentColor();
});

presetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    pushHistory();
    const color = btn.getAttribute("data-color");
    colorPicker.value = colorToHex(color);
    presetButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    applyCurrentColor();
  });
});

// ---- Helpers ----
function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  const num = parseInt(h, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function colorToHex(color) {
  return color.startsWith("#") ? color : color;
}
