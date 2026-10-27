// ════════════════════════════════════════════════════════
//  DATA
// ════════════════════════════════════════════════════════
const UPPERCASE  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LOWERCASE  = 'abcdefghijklmnopqrstuvwxyz'.split('');
const VIETNAMESE = ['a','ă','â','e','ê','i','o','ô','ơ','u','ư','y','b','c','d','đ','g','h','k','l','m','n','p','q','r','s','t','v','x'];
const NUMBERS    = ['0','1','2','3','4','5','6','7','8','9'];
const MATH = [
  '1+1=?','1+2=?','2+1=?','1+3=?','2+2=?','3+1=?','1+4=?','2+3=?','3+2=?','4+1=?',
  '1+5=?','2+4=?','3+3=?','4+2=?','5+1=?','1+6=?','2+5=?','3+4=?','2+6=?','3+5=?',
  '4+4=?','2+7=?','3+6=?','4+5=?','3-1=?','4-1=?','5-2=?','6-2=?','7-3=?','8-4=?',
  '9-4=?','8-3=?','7-2=?','9-3=?','8-2=?','9-2=?',
];
const MODULES = {
  letters: { items:[...UPPERCASE,...LOWERCASE,...VIETNAMESE], color:'#007AFF', nextCls:'btn-next-blue'   },
  numbers: { items:NUMBERS, color:'#FF9500', nextCls:'btn-next-orange' },
  math:    { items:MATH,    color:'#AF52DE', nextCls:'btn-next-purple' },
};

const PALETTE = [
  '#FF3B30','#FF9500','#FFCC00','#34C759',
  '#00C7BE','#007AFF','#5856D6','#FF2D55',
  '#A2845E','#8E8E93','#1c1c1e','#FFFFFF',
];

const DOT_SHAPES = [
  { name:'Tam giác ▲', closed:true,
    dots:[[.5,.15],[.82,.78],[.18,.78]] },
  { name:'Hình vuông ⬜', closed:true,
    dots:[[.2,.2],[.8,.2],[.8,.78],[.2,.78]] },
  { name:'Ngôi nhà 🏠', closed:true,
    dots:[[.5,.12],[.85,.44],[.75,.44],[.75,.82],[.25,.82],[.25,.44],[.15,.44]] },
  { name:'Ngôi sao ⭐', closed:true,
    dots:[[.5,.1],[.62,.4],[.9,.4],[.68,.6],[.78,.88],[.5,.7],[.22,.88],[.32,.6],[.1,.4],[.38,.4]] },
  { name:'Trái tim ❤️', closed:true,
    dots:[[.5,.74],[.15,.42],[.28,.2],[.5,.36],[.72,.2],[.85,.42]] },
];

// ════════════════════════════════════════════════════════
//  SCREEN ROUTING
// ════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function goHome() {
  if (chTimerInterval) { clearInterval(chTimerInterval); chTimerInterval = null; }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  showScreen('home');
}

// ════════════════════════════════════════════════════════
//  SHARED CANVAS UTILS
// ════════════════════════════════════════════════════════
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

function drawGrid(ctx, w, h) {
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,122,255,.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 40) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
  for (let y = 0; y <= h; y += 40) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
  ctx.stroke();
}

// Palm rejection: last touch wins
function makeTouchHandlers(canvas, onDown, onMove, onUp) {
  let activeId = null;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[e.changedTouches.length - 1];
    activeId = t.identifier;
    const r = canvas.getBoundingClientRect();
    onDown(t.clientX - r.left, t.clientY - r.top);
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== activeId) continue;
      const r = canvas.getBoundingClientRect();
      onMove(t.clientX - r.left, t.clientY - r.top);
      break;
    }
  }, { passive: false });
  const end = e => { for (const t of e.changedTouches) { if (t.identifier === activeId) { activeId = null; onUp(); break; } } };
  canvas.addEventListener('touchend',    end);
  canvas.addEventListener('touchcancel', end);
}

// Clone canvas to reset event listeners
function freshCanvas(id) {
  const old = document.getElementById(id);
  const neo = old.cloneNode(false);
  old.parentElement.replaceChild(neo, old);
  return neo;
}

// ════════════════════════════════════════════════════════
//  TTS & AUDIO
// ════════════════════════════════════════════════════════
let ttsEnabled = true;
let traceMode  = false;

function speak(text) {
  if (!ttsEnabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = /^[a-zA-Z]$/.test(text) ? 'en-US' : 'vi-VN';
  u.rate = 0.8;
  window.speechSynthesis.speak(u);
}

function spokenText(module, item) {
  if (module === 'math') {
    return item.replace('=?','').replace(/\+/g,' cộng ').replace(/-/g,' trừ ');
  }
  return item;
}

function playDing() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.frequency.value = 880; osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6);
    osc.start(); osc.stop(ac.currentTime + 0.6);
  } catch(e) {}
}

function toggleTTS() {
  ttsEnabled = !ttsEnabled;
  const btn = document.getElementById('tts-btn');
  btn.textContent = ttsEnabled ? '🔊' : '🔇';
  btn.classList.toggle('muted', !ttsEnabled);
}

function toggleTrace() {
  traceMode = !traceMode;
  document.getElementById('trace-btn').classList.toggle('on-trace', traceMode);
  clearPractice();
}

function drawTraceGhost(ctx, w, h) {
  if (!traceMode || !currentModule) return;
  const mod  = MODULES[currentModule];
  const item = mod.items[currentIndex];
  const isMath = currentModule === 'math';
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = mod.color;
  const fs = isMath ? h * 0.22 : h * 0.52;
  ctx.font = `bold ${fs}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isMath ? item.replace(/=/g,' = ') : item, w / 2, h / 2);
  ctx.restore();
}

// ════════════════════════════════════════════════════════
//  PROGRESS TRACKING (localStorage)
// ════════════════════════════════════════════════════════
function trackCompletion(module, count) {
  const n = count !== undefined ? count : 1;
  if (n <= 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const data  = JSON.parse(localStorage.getItem('beprogress') || '{}');
  if (!data[today]) data[today] = {};
  data[today][module] = (data[today][module] || 0) + n;
  localStorage.setItem('beprogress', JSON.stringify(data));
}

// ════════════════════════════════════════════════════════
//  PRACTICE MODULE
// ════════════════════════════════════════════════════════
let currentModule = null, currentIndex = 0;
let practiceCtx   = null;
let practicePrevX = 0, practicePrevY = 0;

function startModule(name) {
  currentModule = name;
  currentIndex  = 0;
  showScreen('practice');
  // Show check button only for numbers module
  const checkBtn = document.getElementById('btn-check');
  checkBtn.style.display = name === 'numbers' ? '' : 'none';
  hideCheckResult();
  requestAnimationFrame(() => {
    const canvas = document.getElementById('practice-canvas');
    practiceCtx = setupCanvas(canvas);
    drawGrid(practiceCtx, canvas.clientWidth, canvas.clientHeight);
    drawTraceGhost(practiceCtx, canvas.clientWidth, canvas.clientHeight);
    updatePractice();
    makeTouchHandlers(canvas,
      (x, y) => { practicePrevX=x; practicePrevY=y; practiceCtx.beginPath(); practiceCtx.arc(x,y,1.5,0,Math.PI*2); practiceCtx.fillStyle='#1c1c1e'; practiceCtx.fill(); },
      (x, y) => { practiceCtx.beginPath(); practiceCtx.moveTo(practicePrevX,practicePrevY); practiceCtx.lineTo(x,y); practiceCtx.strokeStyle='#1c1c1e'; practiceCtx.lineWidth=3; practiceCtx.lineCap='round'; practiceCtx.lineJoin='round'; practiceCtx.stroke(); practicePrevX=x; practicePrevY=y; },
      () => {}
    );
  });
  if (name === 'numbers') initDigitRecognizer();
}

function clearPractice() {
  const c = document.getElementById('practice-canvas');
  if (!practiceCtx) return;
  drawGrid(practiceCtx, c.clientWidth, c.clientHeight);
  drawTraceGhost(practiceCtx, c.clientWidth, c.clientHeight);
  hideCheckResult();
}

function navigate(dir) {
  const items = MODULES[currentModule].items;
  const next  = currentIndex + dir;
  if (next < 0 || next >= items.length) return;
  if (dir === 1) {
    trackCompletion(currentModule);
    showPraise(() => { currentIndex = next; updatePractice(); clearPractice(); });
  } else {
    currentIndex = next; updatePractice(); clearPractice();
  }
}

function updatePractice() {
  const mod  = MODULES[currentModule];
  const item = mod.items[currentIndex];
  const isMath = currentModule === 'math';
  const charEl = document.getElementById('sample-char');
  charEl.textContent = item.replace(/=/g,' = ');
  charEl.style.color = mod.color;
  charEl.className   = isMath ? 'sample-math' : 'sample-char';
  document.getElementById('math-hint').style.display = isMath ? 'block' : 'none';
  document.getElementById('progress-label').textContent =
    (isMath ? 'Bài ' : '') + (currentIndex+1) + ' / ' + mod.items.length;
  document.getElementById('btn-prev').disabled = currentIndex === 0;
  const nextBtn = document.getElementById('btn-next');
  nextBtn.disabled = currentIndex === mod.items.length - 1;
  nextBtn.className = 'nav-btn ' + mod.nextCls;
  speak(spokenText(currentModule, item));
}

// ════════════════════════════════════════════════════════
//  FREE DRAW MODULE
// ════════════════════════════════════════════════════════
let fdCtx = null, fdColor = PALETTE[5], fdSize = 3, fdEraser = false;
let fdPrevX = 0, fdPrevY = 0;

function initFreeDraw() {
  const canvas = document.getElementById('freedraw-canvas');
  requestAnimationFrame(() => {
    fdCtx = setupCanvas(canvas);
    fdCtx.fillStyle = 'white';
    fdCtx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    makeTouchHandlers(canvas,
      (x, y) => { fdPrevX=x; fdPrevY=y; fdDot(x,y); },
      (x, y) => { fdLine(fdPrevX,fdPrevY,x,y); fdPrevX=x; fdPrevY=y; },
      () => {}
    );
  });
  buildPalette('fd-palette', c => { fdColor=c; fdEraser=false; document.getElementById('fd-era').classList.remove('selected'); });
  selectPaletteColor('fd-palette', fdColor);
}

function fdDot(x, y) {
  fdCtx.beginPath();
  fdCtx.arc(x, y, fdEraser ? 20 : fdSize*0.6, 0, Math.PI*2);
  fdCtx.fillStyle = fdEraser ? 'white' : fdColor;
  fdCtx.fill();
}
function fdLine(x1, y1, x2, y2) {
  fdCtx.beginPath();
  fdCtx.moveTo(x1,y1); fdCtx.lineTo(x2,y2);
  fdCtx.strokeStyle = fdEraser ? 'white' : fdColor;
  fdCtx.lineWidth   = fdEraser ? 40 : fdSize;
  fdCtx.lineCap = 'round'; fdCtx.lineJoin = 'round';
  fdCtx.stroke();
}
function setFDBrush(size, btnId) {
  fdSize = size; fdEraser = false;
  document.querySelectorAll('#freedraw .tool-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById(btnId).classList.add('selected');
}
function setFDEraser() {
  fdEraser = true;
  document.querySelectorAll('#freedraw .tool-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('fd-era').classList.add('selected');
}
function clearFD() {
  const c = document.getElementById('freedraw-canvas');
  fdCtx.fillStyle = 'white';
  fdCtx.fillRect(0, 0, c.clientWidth, c.clientHeight);
}
function saveCurrentFreeDraw() {
  saveDrawing(document.getElementById('freedraw-canvas'), 'Vẽ tự do');
}

// ════════════════════════════════════════════════════════
//  COLORING MODULE
// ════════════════════════════════════════════════════════
const SHAPES = [
  { name:'☀️ Mặt trời', draw: drawSun       },
  { name:'⭐ Ngôi sao',  draw: drawStar      },
  { name:'🏠 Ngôi nhà',  draw: drawHouse     },
  { name:'🌸 Bông hoa',  draw: drawFlower    },
  { name:'❤️ Trái tim',  draw: drawHeart     },
  { name:'🐟 Con cá',    draw: drawFish      },
  { name:'🦋 Con bướm',  draw: drawButterfly },
  { name:'🍎 Quả táo',   draw: drawApple     },
];

let colCtx = null, colIndex = 0, colColor = PALETTE[0], colMode = 'fill';
let colPrevX = 0, colPrevY = 0;

function initColoring() {
  const canvas = document.getElementById('coloring-canvas');
  requestAnimationFrame(() => {
    colCtx = setupCanvas(canvas);
    redrawShape();
    makeTouchHandlers(canvas,
      (x, y) => {
        if (colMode === 'fill') {
          floodFill(colCtx, Math.round(x), Math.round(y), colColor, canvas.clientWidth, canvas.clientHeight);
        } else {
          colPrevX=x; colPrevY=y;
          colCtx.beginPath(); colCtx.arc(x,y,1.5,0,Math.PI*2);
          colCtx.fillStyle=colColor; colCtx.fill();
        }
      },
      (x, y) => {
        if (colMode === 'pen') {
          colCtx.beginPath(); colCtx.moveTo(colPrevX,colPrevY); colCtx.lineTo(x,y);
          colCtx.strokeStyle=colColor; colCtx.lineWidth=4;
          colCtx.lineCap='round'; colCtx.lineJoin='round'; colCtx.stroke();
          colPrevX=x; colPrevY=y;
        }
      },
      () => {}
    );
  });
  buildPalette('col-palette', c => { colColor=c; });
  selectPaletteColor('col-palette', colColor);
}

function changeShape(dir) {
  colIndex = Math.max(0, Math.min(SHAPES.length-1, colIndex+dir));
  redrawShape();
}
function redrawShape() {
  const c = document.getElementById('coloring-canvas');
  if (!colCtx) return;
  colCtx.fillStyle = 'white';
  colCtx.fillRect(0, 0, c.clientWidth, c.clientHeight);
  SHAPES[colIndex].draw(colCtx, c.clientWidth, c.clientHeight);
  document.getElementById('col-shape-name').textContent = SHAPES[colIndex].name;
  document.getElementById('col-prev').disabled = colIndex === 0;
  document.getElementById('col-next').disabled = colIndex === SHAPES.length-1;
}
function setColMode(mode) {
  colMode = mode;
  document.getElementById('col-fill').classList.toggle('selected', mode==='fill');
  document.getElementById('col-pen').classList.toggle('selected',  mode==='pen');
}
function saveCurrentColoring() {
  saveDrawing(document.getElementById('coloring-canvas'), SHAPES[colIndex].name);
}

// ── Flood fill (BFS) ────────────────────────────────────
function floodFill(ctx, sx, sy, hexColor, w, h) {
  const dpr = window.devicePixelRatio || 1;
  const imageData = ctx.getImageData(0, 0, w*dpr, h*dpr);
  const data = imageData.data;
  const pw = Math.round(w*dpr), ph = Math.round(h*dpr);
  const px = Math.round(sx*dpr), py = Math.round(sy*dpr);
  if (px<0||px>=pw||py<0||py>=ph) return;
  const si = (py*pw+px)*4;
  const [fr,fg,fb] = hexToRgb(hexColor);
  const tr=data[si], tg=data[si+1], tb=data[si+2];
  if (tr===fr&&tg===fg&&tb===fb) return;
  if (isDark(tr,tg,tb)) return;
  const tol = 40;
  function match(i) {
    return !isDark(data[i],data[i+1],data[i+2]) &&
      Math.abs(data[i]-tr)<=tol && Math.abs(data[i+1]-tg)<=tol && Math.abs(data[i+2]-tb)<=tol;
  }
  function isDark(r,g,b) { return r<80&&g<80&&b<80; }
  const stack=[py*pw+px], seen=new Uint8Array(pw*ph);
  while (stack.length) {
    const pos=stack.pop();
    if (seen[pos]) continue;
    seen[pos]=1;
    const i=pos*4;
    if (!match(i)) continue;
    data[i]=fr; data[i+1]=fg; data[i+2]=fb; data[i+3]=255;
    const x=pos%pw, y=Math.floor(pos/pw);
    if (x>0) stack.push(pos-1);
    if (x<pw-1) stack.push(pos+1);
    if (y>0) stack.push(pos-pw);
    if (y<ph-1) stack.push(pos+pw);
  }
  ctx.putImageData(imageData,0,0);
}

// ── Shape drawing functions ─────────────────────────────
function drawSun(ctx, w, h) {
  const cx=w/2, cy=h*.44, r=Math.min(w,h)*.22;
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=6;
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2-Math.PI/2;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*r*1.25,cy+Math.sin(a)*r*1.25);
    ctx.lineTo(cx+Math.cos(a)*r*1.7, cy+Math.sin(a)*r*1.7);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.fillStyle='white'; ctx.fill();
  ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=5; ctx.stroke();
  [-.3,.3].forEach(dx=>{
    ctx.beginPath(); ctx.arc(cx+dx*r,cy-r*.2,r*.09,0,Math.PI*2);
    ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=4; ctx.stroke();
  });
  ctx.beginPath(); ctx.arc(cx,cy+r*.1,r*.3,.1*Math.PI,.9*Math.PI);
  ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=4; ctx.stroke();
}

function drawStar(ctx, w, h) {
  const cx=w/2,cy=h*.45,r=Math.min(w,h)*.3,ri=r*.4;
  ctx.beginPath();
  for(let i=0;i<10;i++){
    const a=(i/10)*Math.PI*2-Math.PI/2, rr=i%2===0?r:ri;
    i===0?ctx.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr):ctx.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);
  }
  ctx.closePath(); ctx.fillStyle='white'; ctx.fill();
  ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=5; ctx.stroke();
}

function drawHouse(ctx, w, h) {
  const cx=w/2,bw=w*.55,bh=h*.32,by=h*.55,bx=cx-bw/2;
  ctx.lineJoin='round'; ctx.lineCap='round';
  ctx.beginPath(); ctx.rect(bx,by,bw,bh);
  ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=5; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx-w*.05,by); ctx.lineTo(cx,by-h*.22); ctx.lineTo(bx+bw+w*.05,by);
  ctx.closePath(); ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=5; ctx.stroke();
  const dw=bw*.25,dh=bh*.5,dx=cx-dw/2,dy=by+bh-dh;
  ctx.beginPath(); ctx.rect(dx,dy,dw,dh);
  ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=4; ctx.stroke();
  const ww=bw*.18,wy=by+bh*.18;
  [[bx+bw*.1],[bx+bw*.72]].forEach(([wx])=>{
    ctx.beginPath(); ctx.rect(wx,wy,ww,ww);
    ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=4; ctx.stroke();
  });
}

function drawFlower(ctx, w, h) {
  const cx=w/2,cy=h*.44,pr=Math.min(w,h)*.16,cr=Math.min(w,h)*.1;
  ctx.lineCap='round';
  for(let i=0;i<6;i++){
    const a=(i/6)*Math.PI*2,px=cx+Math.cos(a)*pr*1.1,py=cy+Math.sin(a)*pr*1.1;
    ctx.beginPath(); ctx.ellipse(px,py,pr*.7,pr*.45,a,0,Math.PI*2);
    ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=4; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2);
  ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy+cr+2);
  ctx.bezierCurveTo(cx+w*.06,cy+h*.15,cx-w*.04,cy+h*.22,cx,cy+h*.38);
  ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=5; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx+w*.1,cy+h*.27,w*.08,h*.04,-Math.PI/4,0,Math.PI*2);
  ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=4; ctx.stroke();
}

function drawHeart(ctx, w, h) {
  const cx=w/2,cy=h*.44,s=Math.min(w,h)*.35;
  ctx.beginPath();
  ctx.moveTo(cx,cy+s*.3);
  ctx.bezierCurveTo(cx-s*.05,cy+s*.1,cx-s*.55,cy-s*.2,cx-s*.5,cy-s*.4);
  ctx.bezierCurveTo(cx-s*.45,cy-s*.65,cx-s*.15,cy-s*.7,cx,cy-s*.45);
  ctx.bezierCurveTo(cx+s*.15,cy-s*.7,cx+s*.45,cy-s*.65,cx+s*.5,cy-s*.4);
  ctx.bezierCurveTo(cx+s*.55,cy-s*.2,cx+s*.05,cy+s*.1,cx,cy+s*.3);
  ctx.closePath(); ctx.fillStyle='white'; ctx.fill();
  ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=5; ctx.stroke();
}

function drawFish(ctx, w, h) {
  const cx=w*.48,cy=h*.44,rx=w*.28,ry=h*.16;
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
  ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=5; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx+rx*.85,cy); ctx.lineTo(cx+rx*1.5,cy-ry*1.1); ctx.lineTo(cx+rx*1.5,cy+ry*1.1);
  ctx.closePath(); ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=5; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx-rx*.45,cy-ry*.2,ry*.18,0,Math.PI*2);
  ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=4; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy-ry);
  ctx.bezierCurveTo(cx-rx*.1,cy-ry*1.7,cx+rx*.3,cy-ry*1.7,cx+rx*.3,cy-ry);
  ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=4; ctx.stroke();
}

function drawButterfly(ctx, w, h) {
  const cx=w/2,cy=h*.44,wr=Math.min(w,h)*.28;
  ctx.lineCap='round'; ctx.lineJoin='round';
  [[-.55,-.55],[.55,-.55]].forEach(([dx,dy])=>{
    ctx.beginPath();
    ctx.ellipse(cx+dx*wr,cy+dy*wr*.6,wr*.65,wr*.5,dx<0?-.4:.4,0,Math.PI*2);
    ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=5; ctx.stroke();
  });
  [[-.4,.4],[.4,.4]].forEach(([dx,dy])=>{
    ctx.beginPath();
    ctx.ellipse(cx+dx*wr,cy+dy*wr*.5,wr*.45,wr*.35,dx<0?-.2:.2,0,Math.PI*2);
    ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=4; ctx.stroke();
  });
  ctx.beginPath(); ctx.ellipse(cx,cy,wr*.08,wr*.55,0,0,Math.PI*2);
  ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=4; ctx.stroke();
  [-.06,.06].forEach(dx=>{
    ctx.beginPath();
    ctx.moveTo(cx+dx*wr,cy-wr*.5);
    ctx.bezierCurveTo(cx+(dx-.2)*wr,cy-wr*.9,cx+(dx-.25)*wr,cy-wr*1.1,cx+(dx-.2)*wr,cy-wr*1.2);
    ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=3; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx+(dx-.2)*wr,cy-wr*1.22,wr*.04,0,Math.PI*2);
    ctx.fillStyle='#1c1c1e'; ctx.fill();
  });
}

function drawApple(ctx, w, h) {
  const cx=w/2,cy=h*.47,r=Math.min(w,h)*.28;
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(cx,cy-r*.15);
  ctx.bezierCurveTo(cx-r*.05,cy-r*.4,cx-r*.95,cy-r*.55,cx-r*.9,cy-r*.1);
  ctx.bezierCurveTo(cx-r*.9,cy+r*.5,cx-r*.45,cy+r*.85,cx,cy+r*.88);
  ctx.bezierCurveTo(cx+r*.45,cy+r*.85,cx+r*.9,cy+r*.5,cx+r*.9,cy-r*.1);
  ctx.bezierCurveTo(cx+r*.95,cy-r*.55,cx+r*.05,cy-r*.4,cx,cy-r*.15);
  ctx.closePath(); ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=5; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx,cy-r*.75);
  ctx.bezierCurveTo(cx+r*.05,cy-r*1.05,cx+r*.2,cy-r*1.1,cx+r*.18,cy-r*1.2);
  ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=4; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx+r*.2,cy-r*1.0,r*.2,r*.1,-Math.PI/5,0,Math.PI*2);
  ctx.fillStyle='white'; ctx.fill(); ctx.strokeStyle='#1c1c1e'; ctx.lineWidth=4; ctx.stroke();
}

// ════════════════════════════════════════════════════════
//  CHALLENGE MODULE
// ════════════════════════════════════════════════════════
let chMod = 'letters', chTime = 90;
let chScore = 0, chTimerInterval = null;
let chCtx = null, chPrevX = 0, chPrevY = 0;
let chItems = [], chIdx = 0;

function setupChallenge() {
  if (chTimerInterval) { clearInterval(chTimerInterval); chTimerInterval = null; }
  ['ch-setup','ch-game','ch-result'].forEach((id,i) => {
    const el = document.getElementById(id);
    el.classList.toggle('active', i === 0);
  });
}

function chSelectMod(mod) {
  chMod = mod;
  ['letters','numbers','math'].forEach(m =>
    document.getElementById('ch-mod-'+m).classList.toggle('selected', m === mod)
  );
}

function chSelectTime(t) {
  chTime = t;
  [60,90,120].forEach(s =>
    document.getElementById('ch-t-'+s).classList.toggle('selected', s === t)
  );
}

function startChallenge() {
  const items = [...MODULES[chMod].items];
  for (let i = items.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [items[i],items[j]] = [items[j],items[i]];
  }
  chItems = items; chIdx = 0; chScore = 0;

  ['ch-setup','ch-game','ch-result'].forEach((id,i) => {
    document.getElementById(id).classList.toggle('active', i === 1);
  });

  const canvas = freshCanvas('ch-canvas');
  requestAnimationFrame(() => {
    chCtx = setupCanvas(canvas);
    drawGrid(chCtx, canvas.clientWidth, canvas.clientHeight);
    makeTouchHandlers(canvas,
      (x,y)=>{ chPrevX=x; chPrevY=y; chCtx.beginPath(); chCtx.arc(x,y,1.5,0,Math.PI*2); chCtx.fillStyle='#1c1c1e'; chCtx.fill(); },
      (x,y)=>{ chCtx.beginPath(); chCtx.moveTo(chPrevX,chPrevY); chCtx.lineTo(x,y); chCtx.strokeStyle='#1c1c1e'; chCtx.lineWidth=3; chCtx.lineCap='round'; chCtx.lineJoin='round'; chCtx.stroke(); chPrevX=x; chPrevY=y; },
      ()=>{}
    );
    updateChDisplay();
  });

  let timeLeft = chTime;
  const timerEl = document.getElementById('ch-timer');
  timerEl.textContent = timeLeft;
  timerEl.classList.remove('urgent');
  document.getElementById('ch-score').textContent = '0 ✓';

  chTimerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 10) timerEl.classList.add('urgent');
    if (timeLeft <= 0) { clearInterval(chTimerInterval); chTimerInterval = null; endChallenge(); }
  }, 1000);
}

function updateChDisplay() {
  if (chIdx >= chItems.length) chIdx = 0;
  const item = chItems[chIdx];
  const isMath = chMod === 'math';
  const el = document.getElementById('ch-char');
  el.textContent = isMath ? item.replace(/=/g,' = ') : item;
  el.style.color = MODULES[chMod].color;
  el.className = isMath ? 'sample-math' : 'sample-char';
  el.style.fontSize = isMath ? '70px' : '100px';
  speak(spokenText(chMod, item));
}

function chClear() {
  if (!chCtx) return;
  const c = document.getElementById('ch-canvas');
  drawGrid(chCtx, c.clientWidth, c.clientHeight);
}

function chNext() {
  chScore++;
  document.getElementById('ch-score').textContent = chScore + ' ✓';
  chIdx = (chIdx+1) % chItems.length;
  chClear();
  updateChDisplay();
  playDing();
}

function endChallenge() {
  ['ch-setup','ch-game','ch-result'].forEach((id,i) => {
    document.getElementById(id).classList.toggle('active', i === 2);
  });

  const key = 'behigh_'+chMod+'_'+chTime;
  const prev = parseInt(localStorage.getItem(key) || '0');
  const isNewBest = chScore > 0 && chScore > prev;
  if (chScore > 0) localStorage.setItem(key, Math.max(prev, chScore));

  const bestSoFar = Math.max(prev, chScore);
  document.getElementById('ch-res-emoji').textContent =
    chScore === 0 ? '💪' : isNewBest ? '🏆' : '🎉';
  document.getElementById('ch-final-score').textContent =
    `Bé làm được ${chScore} câu!`;
  document.getElementById('ch-best-score').textContent =
    isNewBest ? `🏆 Kỷ lục mới! (${chScore} câu)` : `Kỷ lục: ${bestSoFar} câu`;

  trackCompletion('challenge', chScore);
  if (chScore > 0) playDing();
}

// ════════════════════════════════════════════════════════
//  DOT GAME MODULE
// ════════════════════════════════════════════════════════
let dotCtx = null, dotShapeIdx = 0, dotCurrentDot = 0;

function initDotGame() {
  const shape = DOT_SHAPES[dotShapeIdx];
  document.getElementById('dot-title').textContent = 'Nối chấm – ' + shape.name;
  document.getElementById('dot-progress').textContent = (dotShapeIdx+1) + ' / ' + DOT_SHAPES.length;
  document.getElementById('dot-prev-btn').disabled = dotShapeIdx === 0;
  document.getElementById('dot-next-btn').disabled = dotShapeIdx === DOT_SHAPES.length-1;

  dotCurrentDot = 0;
  const canvas = freshCanvas('dot-canvas');

  requestAnimationFrame(() => {
    dotCtx = setupCanvas(canvas);
    drawGrid(dotCtx, canvas.clientWidth, canvas.clientHeight);
    drawAllDots();
    makeTouchHandlers(canvas,
      (x,y) => dotTap(x,y),
      ()=>{}, ()=>{}
    );
  });
}

function drawAllDots() {
  const shape = DOT_SHAPES[dotShapeIdx];
  shape.dots.forEach((_, idx) => {
    const state = idx < dotCurrentDot ? 'done' : idx === dotCurrentDot ? 'next' : 'todo';
    drawDotAt(idx, state);
  });
}

function drawDotAt(idx, state) {
  const canvas = document.getElementById('dot-canvas');
  const shape  = DOT_SHAPES[dotShapeIdx];
  const [nx,ny] = shape.dots[idx];
  const x = nx * canvas.clientWidth;
  const y = ny * canvas.clientHeight;
  const r = 22;

  dotCtx.beginPath(); dotCtx.arc(x, y, r, 0, Math.PI*2);
  dotCtx.fillStyle = state==='done' ? '#34C759' : state==='next' ? '#FF9500' : 'white';
  dotCtx.fill();
  dotCtx.strokeStyle = state==='done' ? '#34C759' : state==='next' ? '#FF9500' : '#1c1c1e';
  dotCtx.lineWidth = 3; dotCtx.stroke();

  dotCtx.fillStyle = state==='done' ? 'white' : state==='next' ? 'white' : '#1c1c1e';
  dotCtx.font = 'bold 17px -apple-system, sans-serif';
  dotCtx.textAlign = 'center'; dotCtx.textBaseline = 'middle';
  dotCtx.fillText(state==='done' ? '✓' : String(idx+1), x, y);
}

function dotTap(x, y) {
  const canvas = document.getElementById('dot-canvas');
  const shape  = DOT_SHAPES[dotShapeIdx];
  if (dotCurrentDot >= shape.dots.length) return;

  const [nx,ny] = shape.dots[dotCurrentDot];
  const tx = nx * canvas.clientWidth;
  const ty = ny * canvas.clientHeight;
  if (Math.hypot(x-tx, y-ty) > 55) return;

  // Draw line from previous dot
  if (dotCurrentDot > 0) {
    const [px,py] = shape.dots[dotCurrentDot-1];
    dotCtx.beginPath();
    dotCtx.moveTo(px*canvas.clientWidth, py*canvas.clientHeight);
    dotCtx.lineTo(tx, ty);
    dotCtx.strokeStyle = '#007AFF'; dotCtx.lineWidth = 5; dotCtx.lineCap = 'round';
    dotCtx.stroke();
  }

  drawDotAt(dotCurrentDot, 'done');
  dotCurrentDot++;

  if (dotCurrentDot < shape.dots.length) {
    drawDotAt(dotCurrentDot, 'next');
  } else {
    // Close shape
    if (shape.closed && shape.dots.length > 2) {
      const [lx,ly] = shape.dots[shape.dots.length-1];
      const [fx,fy] = shape.dots[0];
      dotCtx.beginPath();
      dotCtx.moveTo(lx*canvas.clientWidth, ly*canvas.clientHeight);
      dotCtx.lineTo(fx*canvas.clientWidth, fy*canvas.clientHeight);
      dotCtx.strokeStyle = '#007AFF'; dotCtx.lineWidth = 5; dotCtx.lineCap = 'round';
      dotCtx.stroke();
    }
    trackCompletion('dotgame');
    playDing();
    showPraise(()=>{});
  }
}

function dotNavigate(dir) {
  dotShapeIdx = Math.max(0, Math.min(DOT_SHAPES.length-1, dotShapeIdx+dir));
  initDotGame();
}

// ════════════════════════════════════════════════════════
//  GALLERY
// ════════════════════════════════════════════════════════
function saveDrawing(canvas, label) {
  try {
    const gallery = JSON.parse(localStorage.getItem('begallery') || '[]');
    gallery.unshift({
      id: Date.now(),
      dataURL: canvas.toDataURL('image/jpeg', 0.6),
      date: new Date().toLocaleDateString('vi-VN'),
      label,
    });
    if (gallery.length > 20) gallery.pop();
    localStorage.setItem('begallery', JSON.stringify(gallery));
    showToast('Đã lưu tranh! 💾');
  } catch(e) {
    showToast('Lưu thất bại (bộ nhớ đầy)');
  }
}

function renderGallery() {
  const gallery = JSON.parse(localStorage.getItem('begallery') || '[]');
  const grid  = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');
  const scroll = document.getElementById('gallery-scroll');
  grid.innerHTML = '';
  if (gallery.length === 0) {
    scroll.style.display = 'none';
    empty.style.display  = 'flex';
    return;
  }
  scroll.style.display = 'block';
  empty.style.display  = 'none';
  gallery.forEach(item => {
    const el = document.createElement('div');
    el.className = 'gallery-item';
    // Use innerHTML safely — dataURL is from our own canvas, label sanitized below
    const safeLabel = item.label.replace(/</g,'&lt;');
    el.innerHTML = `
      <img class="gallery-thumb" src="${item.dataURL}">
      <div class="gallery-meta"><strong>${safeLabel}</strong>${item.date}</div>
      <button class="gallery-del" onclick="deleteGallery(${item.id})">✕</button>
    `;
    grid.appendChild(el);
  });
}

function deleteGallery(id) {
  let g = JSON.parse(localStorage.getItem('begallery') || '[]');
  g = g.filter(x => x.id !== id);
  localStorage.setItem('begallery', JSON.stringify(g));
  renderGallery();
}

function clearGallery() {
  if (!confirm('Xóa tất cả tranh?')) return;
  localStorage.removeItem('begallery');
  renderGallery();
}

// ════════════════════════════════════════════════════════
//  PROGRESS BOARD
// ════════════════════════════════════════════════════════
const DAY_NAMES = ['CN','T2','T3','T4','T5','T6','T7'];

function computeStreak() {
  const data = JSON.parse(localStorage.getItem('beprogress') || '{}');
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const total = Object.values(data[key]||{}).reduce((a,b)=>a+b, 0);
    if (total > 0) streak++; else break;
  }
  return streak;
}

function renderProgress() {
  const data    = JSON.parse(localStorage.getItem('beprogress') || '{}');
  const streak  = computeStreak();
  const today   = new Date();
  const todayKey = today.toISOString().slice(0,10);
  const td       = data[todayKey] || {};
  const todayTotal = Object.values(td).reduce((a,b)=>a+b,0);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const total = Object.values(data[key]||{}).reduce((a,b)=>a+b,0);
    let ico = '⬜';
    if (total >= 10) ico = '🌟';
    else if (total >= 5) ico = '⭐';
    else if (total > 0) ico = '✅';
    days.push({ d, key, total, ico, isToday: i===0 });
  }

  document.getElementById('progress-body').innerHTML = `
    <div class="prog-streak">
      <div class="streak-fire">${streak>0?'🔥':'💤'}</div>
      <div class="streak-num">${streak}</div>
      <div class="streak-lbl">ngày liên tiếp${streak>0?' 🔥':''}</div>
    </div>
    <div class="week-grid">
      ${days.map(({d,ico,isToday})=>`
        <div class="day-cell${isToday?' today':''}">
          <div class="day-nm">${DAY_NAMES[d.getDay()]}</div>
          <div class="day-dt">${d.getDate()}/${d.getMonth()+1}</div>
          <div class="day-ico">${ico}</div>
        </div>
      `).join('')}
    </div>
    <div class="prog-today">
      <div class="prog-today-title">📅 Hôm nay · ${todayTotal} hoạt động</div>
      ${[
        ['🔤 Chữ cái', td.letters||0],
        ['🔢 Số',       td.numbers||0],
        ['➕ Toán',     td.math||0],
        ['🏆 Thử thách',td.challenge||0],
        ['🔵 Nối chấm', td.dotgame||0],
      ].map(([lbl,val])=>`
        <div class="prog-stat">
          <div class="prog-stat-lbl">${lbl}</div>
          <div class="prog-stat-val">${val}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ════════════════════════════════════════════════════════
//  PALETTE BUILDER
// ════════════════════════════════════════════════════════
function buildPalette(containerId, onSelect) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  PALETTE.forEach(color => {
    const sw = document.createElement('button');
    sw.className = 'color-swatch';
    sw.style.background = color;
    if (color === '#FFFFFF') sw.style.border = '3px solid #ccc';
    sw.dataset.color = color;
    sw.addEventListener('click', () => { onSelect(color); selectPaletteColor(containerId, color); });
    el.appendChild(sw);
  });
}

function selectPaletteColor(containerId, color) {
  document.querySelectorAll('#'+containerId+' .color-swatch').forEach(sw =>
    sw.classList.toggle('selected', sw.dataset.color === color)
  );
}

// ════════════════════════════════════════════════════════
//  PRAISE & TOAST
// ════════════════════════════════════════════════════════
function showPraise(cb) {
  const el = document.getElementById('praise');
  el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); if (cb) cb(); }, 1400);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity = '0'; }, 2200);
}

// ════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════
function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

// ════════════════════════════════════════════════════════
//  NOTEBOOK (VỞ Ô LY)
// ════════════════════════════════════════════════════════
const NB_CELL   = 28;   // 28 CSS px ≈ 7mm — standard "vở 7 ly" for young learners
const NB_MARGIN = NB_CELL * 4; // red margin ~4 squares from left

let nbCtx = null, nbGridCtx = null;
let nbColor = '#1a56db', nbEraser = false;
let nbPrevX = 0, nbPrevY = 0;

function initNotebook() {
  // Clone both canvases to reset event listeners on re-entry
  const gridCanvas = freshCanvas('nb-grid-canvas');
  const drawCanvas = freshCanvas('nb-canvas');

  requestAnimationFrame(() => {
    nbGridCtx = setupCanvas(gridCanvas);
    nbCtx     = setupCanvas(drawCanvas);

    drawNotebookGrid(nbGridCtx, gridCanvas.clientWidth, gridCanvas.clientHeight);
    // Drawing layer starts fully transparent
    nbCtx.clearRect(0, 0, drawCanvas.clientWidth, drawCanvas.clientHeight);

    makeTouchHandlers(drawCanvas,
      (x, y) => { nbPrevX=x; nbPrevY=y; nbDot(x, y); },
      (x, y) => { nbLine(nbPrevX, nbPrevY, x, y); nbPrevX=x; nbPrevY=y; },
      () => {}
    );
  });
}

function drawNotebookGrid(ctx, w, h) {
  // Slightly warm white — like real ô ly paper
  ctx.fillStyle = '#f9fbff';
  ctx.fillRect(0, 0, w, h);

  // Fine grid lines (soft blue)
  ctx.strokeStyle = 'rgba(90,140,225,0.45)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = 0; x <= w; x += NB_CELL) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y <= h; y += NB_CELL) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();

  // Red margin line (kẻ đỏ)
  ctx.strokeStyle = 'rgba(210,45,45,0.62)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(NB_MARGIN, 0);
  ctx.lineTo(NB_MARGIN, h);
  ctx.stroke();
}

function nbDot(x, y) {
  if (nbEraser) return; // dot not needed for eraser
  nbCtx.beginPath();
  nbCtx.arc(x, y, 1, 0, Math.PI*2);
  nbCtx.fillStyle = nbColor;
  nbCtx.fill();
}

function nbLine(x1, y1, x2, y2) {
  if (nbEraser) {
    nbCtx.save();
    nbCtx.globalCompositeOperation = 'destination-out';
    nbCtx.beginPath();
    nbCtx.moveTo(x1, y1); nbCtx.lineTo(x2, y2);
    nbCtx.strokeStyle = 'rgba(0,0,0,1)';
    nbCtx.lineWidth = 26; nbCtx.lineCap = 'round';
    nbCtx.stroke();
    nbCtx.restore();
  } else {
    nbCtx.beginPath();
    nbCtx.moveTo(x1, y1); nbCtx.lineTo(x2, y2);
    nbCtx.strokeStyle = nbColor;
    nbCtx.lineWidth = 2; nbCtx.lineCap = 'round'; nbCtx.lineJoin = 'round';
    nbCtx.stroke();
  }
}

function setNBColor(btn) {
  nbColor = btn.dataset.c;
  nbEraser = false;
  document.querySelectorAll('.nb-color').forEach(b => b.classList.toggle('selected', b === btn));
  document.getElementById('nb-era').classList.remove('erase-on');
}

function toggleNBEraser() {
  nbEraser = !nbEraser;
  document.getElementById('nb-era').classList.toggle('erase-on', nbEraser);
  if (nbEraser) {
    document.querySelectorAll('.nb-color').forEach(b => b.classList.remove('selected'));
  } else {
    // Restore selected color indicator
    document.querySelectorAll('.nb-color').forEach(b => {
      b.classList.toggle('selected', b.dataset.c === nbColor);
    });
  }
}

function clearNotebook() {
  if (!nbCtx) return;
  const c = document.getElementById('nb-canvas');
  nbCtx.clearRect(0, 0, c.clientWidth, c.clientHeight);
}

function saveCurrentNotebook() {
  const gc = document.getElementById('nb-grid-canvas');
  const dc = document.getElementById('nb-canvas');
  const comp = document.createElement('canvas');
  comp.width  = dc.width;
  comp.height = dc.height;
  const ctx = comp.getContext('2d');
  ctx.drawImage(gc, 0, 0);
  ctx.drawImage(dc, 0, 0);
  saveDrawing(comp, 'Vở ô ly');
}

// ════════════════════════════════════════════════════════
//  DIGIT RECOGNITION (TF.js)
// ════════════════════════════════════════════════════════
let digitModel    = null;   // tf.LayersModel
let digitReady    = false;
let digitLoading  = false;

function hideCheckResult() {
  const el = document.getElementById('check-result');
  if (el) { el.classList.remove('show'); el.innerHTML = ''; }
}

function showCheckBadge(correct, predictedDigit, expectedDigit) {
  const el = document.getElementById('check-result');
  if (!el) return;
  if (correct) {
    el.innerHTML = `<div class="check-badge correct">✅ Đúng rồi!<span class="badge-sub">Bạn vẽ số ${expectedDigit} đẹp lắm!</span></div>`;
  } else {
    el.innerHTML = `<div class="check-badge wrong">❌ Thử lại!<span class="badge-sub">Hình như là số ${predictedDigit}?</span></div>`;
  }
  el.classList.add('show');
  // Auto-hide after 3s
  setTimeout(() => el.classList.remove('show'), 3000);
}

// Lazy-load TF.js from CDN then train/load model
function initDigitRecognizer() {
  if (digitReady || digitLoading) return;
  digitLoading = true;
  if (window.tf) { _buildOrLoadModel(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js';
  s.onload  = () => _buildOrLoadModel();
  s.onerror = () => { digitLoading = false; };
  document.head.appendChild(s);
}

async function _buildOrLoadModel() {
  try {
    // Try to load from IndexedDB first
    digitModel = await tf.loadLayersModel('indexeddb://digit-model');
    digitReady = true; digitLoading = false;
    return;
  } catch (_) { /* not cached yet */ }
  // Build and train a small CNN on synthetic digit data
  digitModel = _buildCNN();
  const { xs, ys } = _generateSyntheticData(600); // 60 samples per digit
  await digitModel.fit(xs, ys, {
    epochs: 12, batchSize: 64, shuffle: true,
    callbacks: { onEpochEnd: () => {} }
  });
  xs.dispose(); ys.dispose();
  // Save to IndexedDB for next time
  try { await digitModel.save('indexeddb://digit-model'); } catch(_) {}
  digitReady = true; digitLoading = false;
}

function _buildCNN() {
  const model = tf.sequential();
  model.add(tf.layers.conv2d({ inputShape:[28,28,1], filters:16, kernelSize:3, activation:'relu', padding:'same' }));
  model.add(tf.layers.maxPooling2d({ poolSize:2 }));
  model.add(tf.layers.conv2d({ filters:32, kernelSize:3, activation:'relu', padding:'same' }));
  model.add(tf.layers.maxPooling2d({ poolSize:2 }));
  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({ units:64, activation:'relu' }));
  model.add(tf.layers.dropout({ rate:0.3 }));
  model.add(tf.layers.dense({ units:10, activation:'softmax' }));
  model.compile({ optimizer:'adam', loss:'categoricalCrossentropy', metrics:['accuracy'] });
  return model;
}

// Generate synthetic training images by rendering digits on an offscreen canvas
function _generateSyntheticData(totalSamples) {
  const samplesPerDigit = Math.floor(totalSamples / 10);
  const offscreen = document.createElement('canvas');
  offscreen.width = offscreen.height = 28;
  const ctx = offscreen.getContext('2d');
  const allImages = [];
  const allLabels = [];
  const fonts = [
    'bold 20px Arial', 'bold 20px Verdana', 'bold 22px "Courier New"',
    'bold 18px Georgia', 'bold 21px Impact', 'bold 19px Tahoma',
  ];
  for (let d = 0; d < 10; d++) {
    for (let i = 0; i < samplesPerDigit; i++) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 28, 28);
      ctx.fillStyle = 'black';
      const font = fonts[i % fonts.length];
      ctx.font = font;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // Add small random offsets & slight rotation for augmentation
      const ox = (Math.random() - 0.5) * 4;
      const oy = (Math.random() - 0.5) * 4;
      const angle = (Math.random() - 0.5) * 0.3;
      ctx.save();
      ctx.translate(14 + ox, 14 + oy);
      ctx.rotate(angle);
      ctx.fillText(String(d), 0, 0);
      ctx.restore();
      const imgData = ctx.getImageData(0, 0, 28, 28).data;
      // Convert RGBA → grayscale normalized [0,1], invert so digit=1 background=0
      const gray = new Float32Array(28 * 28);
      for (let p = 0; p < 28 * 28; p++) {
        gray[p] = 1 - imgData[p * 4] / 255; // red channel (grayscale)
      }
      allImages.push(gray);
      allLabels.push(d);
    }
  }
  const xs = tf.tensor4d(
    allImages.reduce((a, b) => { a.push(...b); return a; }, []),
    [allImages.length, 28, 28, 1]
  );
  const ys = tf.oneHot(tf.tensor1d(allLabels, 'int32'), 10).toFloat();
  return { xs, ys };
}

// Preprocess practice canvas: find ink bounding box → crop → resize to 28×28 → tensor
function _canvasToTensor(canvas) {
  // Use physical pixel dimensions for getImageData
  const pw = canvas.width, ph = canvas.height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, pw, ph);
  const data = imgData.data;

  // Find bounding box of dark (ink) pixels in physical pixel space
  let minX=pw, maxX=0, minY=ph, maxY=0;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = (y * pw + x) * 4;
      const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
      if (brightness < 180) { // dark pixel = ink (grid lines ~229, safe threshold)
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return null; // blank canvas

  // Padding in physical pixels
  const pad = Math.max((maxX - minX) * 0.15, (maxY - minY) * 0.15, 6);
  minX = Math.max(0, Math.floor(minX - pad));
  maxX = Math.min(pw, Math.ceil(maxX + pad));
  minY = Math.max(0, Math.floor(minY - pad));
  maxY = Math.min(ph, Math.ceil(maxY + pad));

  const cropW = maxX - minX, cropH = maxY - minY;

  // Render crop into 28×28 offscreen canvas using physical pixel coordinates
  const off = document.createElement('canvas');
  off.width = off.height = 28;
  const oc = off.getContext('2d');
  oc.fillStyle = 'white'; oc.fillRect(0, 0, 28, 28);
  const scale = Math.min(22 / cropW, 22 / cropH);
  const drawW = cropW * scale, drawH = cropH * scale;
  const drawX = (28 - drawW) / 2, drawY = (28 - drawH) / 2;
  // drawImage with explicit source rect reads physical pixels from source canvas
  oc.drawImage(canvas, minX, minY, cropW, cropH, drawX, drawY, drawW, drawH);

  const oData = oc.getImageData(0, 0, 28, 28).data;
  const gray = new Float32Array(28 * 28);
  for (let p = 0; p < 28 * 28; p++) {
    gray[p] = 1 - oData[p * 4] / 255;
  }
  // Return tensor — caller is responsible for dispose
  return tf.tensor4d(Array.from(gray), [1, 28, 28, 1]);
}

async function checkNumberAnswer() {
  if (!digitReady) {
    const el = document.getElementById('check-result');
    el.innerHTML = '<div class="check-badge loading">⏳ Đang tải...<span class="badge-sub">Vui lòng đợi xíu!</span></div>';
    el.classList.add('show');
    // Wait for model to be ready (max 15s)
    let waited = 0;
    while (!digitReady && waited < 150) { await new Promise(r=>setTimeout(r,100)); waited++; }
    if (!digitReady) { el.innerHTML = '<div class="check-badge wrong">😢 Chưa tải được mô hình</div>'; return; }
    el.classList.remove('show'); el.innerHTML = '';
  }

  const canvas = document.getElementById('practice-canvas');
  const expected = parseInt(MODULES.numbers.items[currentIndex]);
  const tensor = _canvasToTensor(canvas);
  if (!tensor) {
    showCheckBadge(false, '?', expected);
    return;
  }
  const preds = digitModel.predict(tensor);
  const argT = preds.argMax(1);
  const predDigit = (await argT.data())[0];
  argT.dispose(); preds.dispose(); tensor.dispose();

  const correct = predDigit === expected;
  showCheckBadge(correct, predDigit, expected);
  if (correct) playDing();
}

window.addEventListener('resize', () => {
  const active = document.querySelector('.screen.active');
  if (!active) return;
  if (active.id === 'practice' && practiceCtx) startModule(currentModule);
  if (active.id === 'freedraw'  && fdCtx)       initFreeDraw();
  if (active.id === 'coloring'  && colCtx)      initColoring();
  if (active.id === 'notebook'  && nbCtx)       initNotebook();
});
