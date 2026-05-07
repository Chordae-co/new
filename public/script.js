
// Set footer year
document.getElementById("year").textContent = new Date().getFullYear();

const imageInput            = document.getElementById("imageInput");
const canvas                = document.getElementById("previewCanvas");
const ctx                   = canvas.getContext("2d");
const placeholder           = document.getElementById("placeholder");
const colorPicker           = document.getElementById("colorPicker");
const presetButtons         = document.querySelectorAll(".color-btn");
const resetButton           = document.getElementById("resetImage");
const saveButton            = document.getElementById("saveImage");
const savedGallery          = document.getElementById("savedGallery");
const snapshotPreviewWrapper= document.getElementById("snapshotPreviewWrapper");
const snapshotPreview       = document.getElementById("snapshotPreview");
const toolWandBtn           = document.getElementById("toolWand");
const toolPaintBtn          = document.getElementById("toolPaint");
const toolEraserBtn         = document.getElementById("toolEraser");
const toolLassoBtn          = document.getElementById("toolLasso");
const wandRange             = document.getElementById("wandRange");
const paintRange            = document.getElementById("paintRange");
const eraserRange           = document.getElementById("eraserRange");
const undoBtn               = document.getElementById("undoBtn");
const redoBtn               = document.getElementById("redoBtn");

const ALL_TOOL_BTNS = [toolWandBtn, toolPaintBtn, toolEraserBtn, toolLassoBtn].filter(Boolean);

// ── State ─────────────────────────────────────────────────────────────────────
let originalImageData = null;   // current working pixels (mutated by lasso erase)
let pristineImageData = null;   // never mutated — used only by Reset
let imageLoaded = false;
let wallMask    = null;
let toolMode    = "wand";
let isDrawing   = false;

let wandTolerance = parseInt(wandRange?.value, 10) || 45;
let paintRadius   = parseInt(paintRange?.value, 10) || 10;
let eraserRadius  = parseInt(eraserRange?.value, 10) || 10;

let historyStack = [];
let redoStack    = [];

// ── History ───────────────────────────────────────────────────────────────────
// Each snapshot stores the full pixel data + mask + color so undo/redo
// correctly reverses lasso-erase pixel changes too.
function cloneImgData(id) {
  return new ImageData(new Uint8ClampedArray(id.data), id.width, id.height);
}

function pushHistory() {
  if (!imageLoaded || !originalImageData || !wallMask) return;
  historyStack.push({
    imgData: cloneImgData(originalImageData),
    mask:    wallMask.slice(),
    color:   colorPicker.value,
  });
  if (historyStack.length > 50) historyStack.shift();
  redoStack = [];
}

function captureCurrentState() {
  return {
    imgData: cloneImgData(originalImageData),
    mask:    wallMask.slice(),
    color:   colorPicker.value,
  };
}

function restoreState(state) {
  if (!state) return;
  originalImageData = cloneImgData(state.imgData);
  wallMask          = state.mask.slice();
  colorPicker.value = state.color;
  presetButtons.forEach(btn =>
    btn.classList.toggle("active", btn.getAttribute("data-color") === colorPicker.value)
  );
  applyCurrentColor(); // redraws canvas from restored originalImageData
}

// ── Load image ────────────────────────────────────────────────────────────────
imageInput?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxW = 900, maxH = 500;
      let w = img.width, h = img.height;
      const ratio = Math.min(maxW / w, maxH / h, 1);
      w = Math.round(w * ratio); h = Math.round(h * ratio);
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      originalImageData = ctx.getImageData(0, 0, w, h);
      pristineImageData = cloneImgData(originalImageData); // pristine copy for Reset
      wallMask    = new Uint8Array(w * h);
      imageLoaded = true;
      historyStack = []; redoStack = [];
      canvas.style.display  = "block";
      placeholder.style.display = "none";
      // Don't auto-apply magic select on load — user triggers it manually
      ctx.putImageData(originalImageData, 0, 0);
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
  let sumR=0, sumG=0, sumB=0, count=0;
  const step = 4;
  for (let y=step; y<H-step; y+=step) for (let x=step; x<W-step; x+=step) {
    const i=(y*W+x)*4;
    const br=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
    if (br<30||br>245) continue;
    sumR+=data[i]; sumG+=data[i+1]; sumB+=data[i+2]; count++;
  }
  if (!count) { wallMask.fill(0); return; }
  const avgR=sumR/count, avgG=sumG/count, avgB=sumB/count;
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const idx=y*W+x, di=idx*4;
    const dr=data[di]-avgR, dg=data[di+1]-avgG, db=data[di+2]-avgB;
    if (Math.sqrt(dr*dr+dg*dg+db*db)>70) { wallMask[idx]=0; continue; }
    let nS=0, nC=0;
    for (let ny=y-1;ny<=y+1;ny++) for (let nx=x-1;nx<=x+1;nx++) {
      if (nx<0||ny<0||nx>=W||ny>=H||nx===x&&ny===y) continue;
      const ni=(ny*W+nx)*4;
      const a=data[ni]-data[di], b=data[ni+1]-data[di+1], c=data[ni+2]-data[di+2];
      nS+=Math.sqrt(a*a+b*b+c*c); nC++;
    }
    wallMask[idx]=(nC?nS/nC:0)<35?1:0;
  }
  smoothMask(W,H); filterSmallComponents(W,H);
}

function smoothMask(W,H) {
  const n=new Uint8Array(W*H);
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
    const idx=y*W+x;
    if (wallMask[idx]) { n[idx]=1; continue; }
    let cnt=0;
    for (let ny=y-1;ny<=y+1;ny++) for (let nx=x-1;nx<=x+1;nx++) {
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      if (wallMask[ny*W+nx]) cnt++;
    }
    if (cnt>=5) n[idx]=1;
  }
  wallMask=n;
}

function filterSmallComponents(W,H) {
  const visited=new Uint8Array(W*H), labels=new Int32Array(W*H).fill(-1), areas=[];
  let ci=0;
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
    const idx=y*W+x;
    if (!wallMask[idx]||visited[idx]) continue;
    let q=[[x,y]], area=0; visited[idx]=1; labels[idx]=ci;
    while (q.length) {
      const [cx,cy]=q.pop(); area++;
      for (const [dx,dy] of dirs) {
        const nx=cx+dx, ny=cy+dy;
        if (nx<0||ny<0||nx>=W||ny>=H) continue;
        const ni=ny*W+nx;
        if (!wallMask[ni]||visited[ni]) continue;
        visited[ni]=1; labels[ni]=ci; q.push([nx,ny]);
      }
    }
    areas[ci++]=area;
  }
  if (!areas.length) return;
  const maxArea=Math.max(...areas), minArea=maxArea*0.25;
  for (let i=0;i<wallMask.length;i++)
    if (labels[i]!==-1&&areas[labels[i]]<minArea) wallMask[i]=0;
}

// ── Tint ──────────────────────────────────────────────────────────────────────
function applyCurrentColor() {
  if (!imageLoaded||!originalImageData) return;
  const {r:tr,g:tg,b:tb}=hexToRgb(colorPicker.value||"#ffffff");
  const {width:W,height:H,data:src}=originalImageData;
  const out=ctx.createImageData(originalImageData), d=out.data;
  for (let i=0;i<W*H;i++) {
    const di=i*4;
    if (wallMask&&wallMask[i]) {
      const br=(0.299*src[di]+0.587*src[di+1]+0.114*src[di+2])/255;
      d[di]=Math.min(255,tr*br); d[di+1]=Math.min(255,tg*br); d[di+2]=Math.min(255,tb*br); d[di+3]=src[di+3];
    } else {
      d[di]=src[di]; d[di+1]=src[di+1]; d[di+2]=src[di+2]; d[di+3]=src[di+3];
    }
  }
  ctx.putImageData(out,0,0);
}

// ── Coord helper ──────────────────────────────────────────────────────────────
function getCanvasCoords(e) {
  const rect=canvas.getBoundingClientRect();
  const cx=e.touches?e.touches[0].clientX:e.clientX;
  const cy=e.touches?e.touches[0].clientY:e.clientY;
  return {
    x: Math.floor(((cx-rect.left)/rect.width)*canvas.width),
    y: Math.floor(((cy-rect.top)/rect.height)*canvas.height),
  };
}

// ── Wand ──────────────────────────────────────────────────────────────────────
function addRegionAt(sx,sy) {
  const {width:W,height:H,data}=originalImageData;
  const si=(sy*W+sx)*4;
  const [bR,bG,bB]=[data[si],data[si+1],data[si+2]];
  const visited=new Uint8Array(W*H), stack=[[sx,sy]];
  visited[sy*W+sx]=1;
  while (stack.length) {
    const [x,y]=stack.pop(); wallMask[y*W+x]=1;
    for (const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      const ni=ny*W+nx; if (visited[ni]) continue;
      const di=ni*4, dr=data[di]-bR, dg=data[di+1]-bG, db=data[di+2]-bB;
      if (Math.sqrt(dr*dr+dg*dg+db*db)<wandTolerance) { visited[ni]=1; stack.push([nx,ny]); }
    }
  }
}

// ── Paint/Eraser brush ────────────────────────────────────────────────────────
function paintAt(cx,cy,val) {
  const {width:W,height:H}=originalImageData;
  const r=val===1?paintRadius:eraserRadius;
  for (let y=cy-r;y<=cy+r;y++) for (let x=cx-r;x<=cx+r;x++) {
    if (x<0||y<0||x>=W||y>=H) continue;
    if ((x-cx)**2+(y-cy)**2<=r*r) wallMask[y*W+x]=val;
  }
}

// ── Lasso ─────────────────────────────────────────────────────────────────────
let lassoDrawing=false, lassoPoints=[], lassoAnimId=null;

function drawLassoOverlay() {
  applyCurrentColor();
  if (lassoPoints.length<2) return;
  ctx.save();
  // Use canvas 2D path fill to rasterize — handles self-intersections and
  // overlaps correctly with the nonzero winding rule (no holes punched).
  ctx.beginPath();
  ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
  for (let i=1;i<lassoPoints.length;i++) ctx.lineTo(lassoPoints[i].x,lassoPoints[i].y);
  ctx.closePath();
  ctx.fillStyle="rgba(255,60,60,0.18)";
  ctx.fill("nonzero");
  ctx.strokeStyle="#ff3333";
  ctx.lineWidth=Math.max(1.5,canvas.width/600);
  ctx.setLineDash([7,5]);
  ctx.lineDashOffset=-(Date.now()/30)%12;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function startLassoAnim() {
  cancelAnimationFrame(lassoAnimId);
  (function tick(){ drawLassoOverlay(); lassoAnimId=requestAnimationFrame(tick); })();
}
function stopLassoAnim() { cancelAnimationFrame(lassoAnimId); lassoAnimId=null; }

// Build the fill mask by rasterizing the lasso path using an offscreen canvas.
// This is the key fix: the browser's canvas fill handles self-intersections,
// overlapping loops, and complex paths correctly — no point-in-polygon math needed.
function rasterizeLassoMask(poly, W, H) {
  const offscreen = document.createElement("canvas");
  offscreen.width=W; offscreen.height=H;
  const oc=offscreen.getContext("2d");
  oc.fillStyle="#ffffff";
  oc.beginPath();
  oc.moveTo(poly[0].x,poly[0].y);
  for (let i=1;i<poly.length;i++) oc.lineTo(poly[i].x,poly[i].y);
  oc.closePath();
  oc.fill("nonzero"); // overlapping regions merge, no holes
  const px=oc.getImageData(0,0,W,H).data;
  const mask=new Uint8Array(W*H);
  for (let i=0;i<W*H;i++) if (px[i*4+3]>128) mask[i]=1;
  return mask;
}

function applyLassoErase(poly) {
  if (!originalImageData) return;
  const W=originalImageData.width, H=originalImageData.height;
  const needsFill=rasterizeLassoMask(poly,W,H);

  // Bounding box of filled pixels for efficiency
  let minX=W,maxX=0,minY=H,maxY=0;
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
    if (!needsFill[y*W+x]) continue;
    if (x<minX) minX=x; if (x>maxX) maxX=x;
    if (y<minY) minY=y; if (y>maxY) maxY=y;
  }
  if (minX>maxX||minY>maxY) return; // nothing to fill

  // Working float buffer seeded from current pixels
  const src=originalImageData.data;
  const working=new Float32Array(W*H*3);
  for (let i=0;i<W*H;i++) {
    working[i*3]=src[i*4]; working[i*3+1]=src[i*4+1]; working[i*3+2]=src[i*4+2];
  }

  // Onion-layer inpainting — propagate from the known border pixels inward.
  // Keep the search radius SMALL (4px) so we copy texture from immediately
  // adjacent pixels rather than averaging over a wide area. This produces
  // a sharp, texture-preserving fill instead of a blurry smear.
  const remaining=needsFill.slice();
  let totalLeft=0;
  for (let i=0;i<remaining.length;i++) if (remaining[i]) totalLeft++;

  const maxPasses=Math.ceil(Math.max(maxX-minX,maxY-minY)/2)+10;
  const SEARCH_R=4; // small radius = sharp, texture-faithful fill

  for (let pass=0;pass<maxPasses&&totalLeft>0;pass++) {
    const filled=[];

    for (let y=minY;y<=maxY;y++) for (let x=minX;x<=maxX;x++) {
      const idx=y*W+x;
      if (!remaining[idx]) continue;
      // Only fill pixels that touch a known pixel (4-connected border)
      let hasBorder=false;
      for (const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
        if (nx>=0&&ny>=0&&nx<W&&ny<H&&!remaining[ny*W+nx]) { hasBorder=true; break; }
      }
      if (!hasBorder) continue;

      // Sample only from immediately neighbouring known pixels with distance weighting
      let rS=0,gS=0,bS=0,wS=0;
      for (let dy=-SEARCH_R;dy<=SEARCH_R;dy++) for (let dx=-SEARCH_R;dx<=SEARCH_R;dx++) {
        if (dx*dx+dy*dy>SEARCH_R*SEARCH_R) continue;
        const nx=x+dx,ny=y+dy;
        if (nx<0||ny<0||nx>=W||ny>=H) continue;
        const ni=ny*W+nx;
        if (remaining[ni]) continue; // not yet filled
        const w=1/(Math.sqrt(dx*dx+dy*dy)+0.5); // strong distance falloff
        rS+=working[ni*3]*w; gS+=working[ni*3+1]*w; bS+=working[ni*3+2]*w; wS+=w;
      }
      if (!wS) continue;
      working[idx*3]=rS/wS; working[idx*3+1]=gS/wS; working[idx*3+2]=bS/wS;
      filled.push(idx);
    }
    for (const idx of filled) { remaining[idx]=0; totalLeft--; }
    if (!filled.length) break;
  }

  // No blur pass — keep the fill sharp and texture-faithful.
  // Only a 1px hard-edge blend at the very boundary to avoid a visible seam.
  const FEATHER=1;
  const out=new Uint8ClampedArray(src);
  for (let y=minY;y<=maxY;y++) for (let x=minX;x<=maxX;x++) {
    const idx=y*W+x;
    if (!needsFill[idx]) continue;
    // Check if this pixel is exactly on the 1px border
    let onEdge=false;
    for (const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
      if (nx>=0&&ny>=0&&nx<W&&ny<H&&!needsFill[ny*W+nx]) { onEdge=true; break; }
    }
    const di=idx*4;
    if (onEdge) {
      // 50/50 blend only at the immediate 1px border to soften the seam
      out[di]  =Math.round((working[idx*3]  +src[di]  )/2);
      out[di+1]=Math.round((working[idx*3+1]+src[di+1])/2);
      out[di+2]=Math.round((working[idx*3+2]+src[di+2])/2);
    } else {
      out[di]  =Math.round(working[idx*3]);
      out[di+1]=Math.round(working[idx*3+1]);
      out[di+2]=Math.round(working[idx*3+2]);
    }
    out[di+3]=255;
  }

  // Commit — originalImageData is updated so undo/redo can restore it
  originalImageData=new ImageData(out,W,H);
  for (let i=0;i<needsFill.length;i++) if (needsFill[i]) wallMask[i]=0;
  applyCurrentColor();
}

// ── Unified canvas events ─────────────────────────────────────────────────────
canvas.addEventListener("click", (e) => {
  if (!imageLoaded||toolMode!=="wand") return;
  pushHistory();
  const {x,y}=getCanvasCoords(e);
  addRegionAt(x,y); applyCurrentColor();
});

canvas.addEventListener("mousedown", (e) => {
  if (!imageLoaded||!wallMask||!originalImageData) return;
  if (toolMode==="paint"||toolMode==="eraser") {
    isDrawing=true; pushHistory();
    const {x,y}=getCanvasCoords(e);
    paintAt(x,y,toolMode==="paint"?1:0); applyCurrentColor();
  } else if (toolMode==="lasso") {
    e.preventDefault();
    lassoDrawing=true; lassoPoints=[getCanvasCoords(e)];
    startLassoAnim();
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!imageLoaded) return;
  if ((toolMode==="paint"||toolMode==="eraser")&&isDrawing) {
    const {x,y}=getCanvasCoords(e);
    paintAt(x,y,toolMode==="paint"?1:0); applyCurrentColor();
  } else if (toolMode==="lasso"&&lassoDrawing) {
    e.preventDefault(); lassoPoints.push(getCanvasCoords(e));
  }
});

window.addEventListener("mouseup", () => {
  if (isDrawing) { isDrawing=false; return; }
  if (lassoDrawing&&toolMode==="lasso") {
    lassoDrawing=false; stopLassoAnim();
    if (lassoPoints.length>=3) { pushHistory(); applyLassoErase(lassoPoints); }
    else applyCurrentColor();
    lassoPoints=[];
  }
});

canvas.addEventListener("touchstart", (e) => {
  if (toolMode!=="lasso"||!imageLoaded) return;
  e.preventDefault(); lassoDrawing=true; lassoPoints=[getCanvasCoords(e)]; startLassoAnim();
}, {passive:false});

canvas.addEventListener("touchmove", (e) => {
  if (toolMode!=="lasso"||!lassoDrawing) return;
  e.preventDefault(); lassoPoints.push(getCanvasCoords(e));
}, {passive:false});

canvas.addEventListener("touchend", (e) => {
  if (toolMode!=="lasso"||!lassoDrawing) return;
  lassoDrawing=false; stopLassoAnim();
  if (lassoPoints.length>=3) { pushHistory(); applyLassoErase(lassoPoints); }
  else applyCurrentColor();
  lassoPoints=[];
});

// ── Tool switching ────────────────────────────────────────────────────────────
function setActiveTool(mode) {
  toolMode=mode;
  ALL_TOOL_BTNS.forEach(b=>b.classList.remove("active"));
  ({wand:toolWandBtn,paint:toolPaintBtn,eraser:toolEraserBtn,lasso:toolLassoBtn}[mode])?.classList.add("active");
  if (mode!=="lasso") {
    lassoDrawing=false; lassoPoints=[]; stopLassoAnim();
    if (imageLoaded) applyCurrentColor();
    canvas.style.cursor="default";
  } else {
    canvas.style.cursor="crosshair";
  }
  isDrawing=false;
}

toolWandBtn  ?.addEventListener("click", ()=>setActiveTool("wand"));
toolPaintBtn ?.addEventListener("click", ()=>setActiveTool("paint"));
toolEraserBtn?.addEventListener("click", ()=>setActiveTool("eraser"));
toolLassoBtn ?.addEventListener("click", ()=>setActiveTool("lasso"));

// ── Sliders ───────────────────────────────────────────────────────────────────
wandRange  ?.addEventListener("input", ()=>{ wandTolerance=parseInt(wandRange.value,10)||45; });
paintRange ?.addEventListener("input", ()=>{ paintRadius  =parseInt(paintRange.value,10)||10; });
eraserRange?.addEventListener("input", ()=>{ eraserRadius =parseInt(eraserRange.value,10)||10; });

// ── Undo / Redo ───────────────────────────────────────────────────────────────
undoBtn?.addEventListener("click", () => {
  if (!imageLoaded||!historyStack.length) return;
  redoStack.push(captureCurrentState());
  restoreState(historyStack.pop());
});

redoBtn?.addEventListener("click", () => {
  if (!imageLoaded||!redoStack.length) return;
  historyStack.push(captureCurrentState());
  restoreState(redoStack.pop());
});

// ── Reset ─────────────────────────────────────────────────────────────────────
// Uses pristineImageData (never mutated) so Reset always goes back to
// the original uploaded photo even after lasso erases.
resetButton?.addEventListener("click", () => {
  if (!imageLoaded||!pristineImageData) return;
  originalImageData=cloneImgData(pristineImageData);
  wallMask=new Uint8Array(originalImageData.width*originalImageData.height);
  // Don't auto-apply magic select — restore raw image with blank mask
  ctx.putImageData(originalImageData, 0, 0);
  presetButtons.forEach(b=>b.classList.remove("active"));
  historyStack=[]; redoStack=[];
  pushHistory();
});

// ── Save snapshot ─────────────────────────────────────────────────────────────
saveButton?.addEventListener("click", () => {
  if (!imageLoaded) return;
  const url=canvas.toDataURL("image/png");
  const img=document.createElement("img");
  img.src=url; img.className="saved-thumb";
  img.addEventListener("click", ()=>{ snapshotPreview.src=url; snapshotPreviewWrapper.style.display="block"; });
  savedGallery.querySelector(".gallery-placeholder")?.remove();
  savedGallery.appendChild(img);
});

// ── Color ─────────────────────────────────────────────────────────────────────
colorPicker?.addEventListener("change", ()=>{ pushHistory(); applyCurrentColor(); });
colorPicker?.addEventListener("input",  ()=>{ applyCurrentColor(); });

presetButtons.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    pushHistory();
    colorPicker.value=btn.getAttribute("data-color");
    presetButtons.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    applyCurrentColor();
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  let h=hex.replace("#","");
  if (h.length===3) h=h.split("").map(c=>c+c).join("");
  const n=parseInt(h,16);
  return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
}
