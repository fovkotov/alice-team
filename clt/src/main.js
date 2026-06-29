import './style.css';

const canvas = document.querySelector('#orbs');
const ctx = canvas.getContext('2d');
const video = document.querySelector('#film');
const activeLabel = document.querySelector('#active');
const sound = document.querySelector('#sound');

const orbs = [];
const pointer = { x: -1000, y: -1000, inside: false };
let hovered = -1;
let dragging = -1;
let dragOffset = { x: 0, y: 0 };
let dragVel = { x: 0, y: 0 };
let lastDrag = { x: 0, y: 0, t: 0 };
let scrollEnergy = 0;
let lastScroll = scrollY;
let lastTime = performance.now();
let dpr = 1;

function resize() {
  dpr = Math.min(devicePixelRatio, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!orbs.length) seed();
  for (const o of orbs) {
    o.x = Math.max(o.r, Math.min(innerWidth - o.r, o.x));
    o.y = Math.max(o.r, Math.min(innerHeight - o.r, o.y));
  }
}

function seed() {
  const layout = [
    [.10,.24,42], [.26,.17,68], [.48,.26,50], [.69,.15,76], [.89,.29,48],
    [.17,.56,73], [.39,.50,43], [.57,.63,82], [.82,.55,62],
    [.10,.84,48], [.34,.82,67], [.80,.85,74]
  ];
  layout.forEach(([x,y,r], i) => orbs.push({
    x: x * innerWidth, y: y * innerHeight,
    vx: Math.cos(i * 2.13) * 7, vy: Math.sin(i * 1.71) * 7,
    r, baseR:r, shade: 235 - (i % 4) * 12, alpha: 1
  }));
}

function orbAt(x, y) {
  return orbs.findIndex(o => Math.hypot(x - o.x, y - o.y) <= o.r);
}

function clampOrb(o) {
  o.x = Math.max(o.r, Math.min(innerWidth - o.r, o.x));
  o.y = Math.max(o.r, Math.min(innerHeight - o.r, o.y));
}

function dragCollision(dragged, other) {
  const dx = other.x - dragged.x, dy = other.y - dragged.y;
  const min = dragged.r + other.r;
  const dist = Math.hypot(dx, dy);
  if (!dist || dist >= min) return;
  const nx = dx / dist, ny = dy / dist;
  const overlap = min - dist;
  other.x += nx * overlap;
  other.y += ny * overlap;
  other.vx += nx * overlap * 10;
  other.vy += ny * overlap * 10;
  clampOrb(other);
}

function applyScrollKick(amount) {
  if (!orbs.length || amount <= 0) return;
  const strength = Math.min(5, amount / 18);
  scrollEnergy = Math.min(80, scrollEnergy + strength * 7);
  const span = Math.max(innerWidth, innerHeight);
  for (const o of orbs) {
    const angle = Math.random() * Math.PI * 2;
    const kick = span * (.25 + strength * .45 + Math.min(scrollEnergy, 50) * .01);
    o.vx += Math.cos(angle) * kick;
    o.vy += Math.sin(angle) * kick;
  }
}

function physics(dt) {
  const energized = scrollEnergy > 6;
  const wallBounce = energized ? .68 + Math.min(scrollEnergy, 50) * .004 : .85;
  const bounce = energized ? .74 + Math.min(scrollEnergy, 50) * .004 : .82;
  const drag = Math.pow(.962, dt * 60);
  for (let i = 0; i < orbs.length; i++) {
    const o = orbs[i];
    if (i === dragging) continue;
    o.vx *= drag;
    o.vy *= drag;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) * wallBounce; }
    if (o.x > innerWidth-o.r) { o.x=innerWidth-o.r; o.vx=-Math.abs(o.vx) * wallBounce; }
    if (o.y < o.r) { o.y=o.r; o.vy=Math.abs(o.vy) * wallBounce; }
    if (o.y > innerHeight-o.r) { o.y=innerHeight-o.r; o.vy=-Math.abs(o.vy) * wallBounce; }
    if (!energized) {
      const mag = Math.hypot(o.vx,o.vy) || 1;
      const target = 7;
      o.vx += (o.vx / mag * target - o.vx) * .012;
      o.vy += (o.vy / mag * target - o.vy) * .012;
    }
  }
  for (let i=0;i<orbs.length;i++) for(let j=i+1;j<orbs.length;j++) {
    if (i === dragging) dragCollision(orbs[i], orbs[j]);
    else if (j === dragging) dragCollision(orbs[j], orbs[i]);
    else {
    const a=orbs[i], b=orbs[j], dx=b.x-a.x, dy=b.y-a.y;
    const dist=Math.hypot(dx,dy), min=a.r+b.r;
    if (dist && dist < min) {
      const nx=dx/dist, ny=dy/dist;
      const overlap=(min-dist)/2 * bounce;
      a.x-=nx*overlap; a.y-=ny*overlap; b.x+=nx*overlap; b.y+=ny*overlap;
      const p=2*(a.vx*nx+a.vy*ny-b.vx*nx-b.vy*ny)/2 * bounce;
      a.vx-=p*nx; a.vy-=p*ny; b.vx+=p*nx; b.vy+=p*ny;
    }
    }
  }
  scrollEnergy *= Math.pow(.965, dt*60);
}

function draw() {
  ctx.clearRect(0,0,innerWidth,innerHeight);
  orbs.forEach((o,i) => {
    const hidden = hovered >= 0 && hovered !== i;
    o.alpha += ((hidden ? 0 : 1) - o.alpha) * .28;
    ctx.globalAlpha = o.alpha;
    ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2);
    if (i === hovered) ctx.fillStyle='#050505';
    else {
      const g=ctx.createRadialGradient(o.x-o.r*.32,o.y-o.r*.38,o.r*.08,o.x,o.y,o.r);
      g.addColorStop(0,'#fff'); g.addColorStop(.58,`rgb(${o.shade},${o.shade},${o.shade})`); g.addColorStop(1,'#a7a7a7');
      ctx.fillStyle=g;
    }
    ctx.fill();
  });
  ctx.globalAlpha=1;
}

function frame(now) {
  const dt=Math.min((now-lastTime)/1000,.025); lastTime=now;
  physics(dt);
  updateHover();
  draw(); requestAnimationFrame(frame);
}

function updateHover() {
  const next = dragging >= 0 ? dragging : (pointer.inside ? orbAt(pointer.x, pointer.y) : -1);
  if(next===hovered) return;
  hovered=next; activeLabel.textContent=hovered<0?'00':String(hovered+1).padStart(2,'0');
  document.body.classList.toggle('revealed',hovered>=0);
  canvas.style.cursor=dragging>=0?'grabbing':hovered>=0?'grab':'crosshair';
  if(hovered>=0) video.play().catch(()=>{}); else { video.pause(); video.currentTime=0; }
}

function onPointerMove(e) {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.inside = true;
  if (dragging >= 0) {
    const o = orbs[dragging];
    const now = performance.now();
    const dt = Math.max(1, now - lastDrag.t) / 1000;
    dragVel.x = (e.clientX - lastDrag.x) / dt;
    dragVel.y = (e.clientY - lastDrag.y) / dt;
    lastDrag = { x: e.clientX, y: e.clientY, t: now };
    o.x = e.clientX - dragOffset.x;
    o.y = e.clientY - dragOffset.y;
    clampOrb(o);
    for (let j = 0; j < orbs.length; j++) {
      if (j !== dragging) dragCollision(o, orbs[j]);
    }
    updateHover();
    return;
  }
  updateHover();
}

function endDrag(e) {
  if (dragging < 0) return;
  orbs[dragging].vx = dragVel.x * .82;
  orbs[dragging].vy = dragVel.y * .82;
  dragging = -1;
  if (e?.pointerId != null) canvas.releasePointerCapture(e.pointerId);
  updateHover();
}

canvas.addEventListener('pointerdown', e => {
  const i = orbAt(e.clientX, e.clientY);
  if (i < 0) return;
  dragging = i;
  const o = orbs[i];
  dragOffset.x = e.clientX - o.x;
  dragOffset.y = e.clientY - o.y;
  dragVel.x = 0;
  dragVel.y = 0;
  lastDrag = { x: e.clientX, y: e.clientY, t: performance.now() };
  o.vx = 0;
  o.vy = 0;
  canvas.setPointerCapture(e.pointerId);
  updateHover();
  e.preventDefault();
});

canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
addEventListener('pointerleave', () => { pointer.inside = dragging >= 0; if (dragging < 0) updateHover(); });
addEventListener('scroll',()=>{const delta=Math.abs(scrollY-lastScroll);lastScroll=scrollY;applyScrollKick(delta)},{passive:true});
addEventListener('wheel',e=>{applyScrollKick(Math.abs(e.deltaY))},{passive:true});
addEventListener('resize',resize);
sound.addEventListener('click',()=>{video.muted=!video.muted;sound.textContent=video.muted?'SOUND OFF':'SOUND ON'});
resize(); requestAnimationFrame(frame);
