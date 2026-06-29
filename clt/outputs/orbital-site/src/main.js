import './style.css';

const canvas = document.querySelector('#orbs');
const ctx = canvas.getContext('2d');
const video = document.querySelector('#film');
const activeLabel = document.querySelector('#active');
const sound = document.querySelector('#sound');

const orbs = [];
const pointer = { x: -1000, y: -1000, inside: false };
let hovered = -1;
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

function physics(dt) {
  const speed = 1 + scrollEnergy * .065;
  for (const o of orbs) {
    o.x += o.vx * dt * speed;
    o.y += o.vy * dt * speed;
    if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx); }
    if (o.x > innerWidth-o.r) { o.x=innerWidth-o.r; o.vx=-Math.abs(o.vx); }
    if (o.y < o.r) { o.y=o.r; o.vy=Math.abs(o.vy); }
    if (o.y > innerHeight-o.r) { o.y=innerHeight-o.r; o.vy=-Math.abs(o.vy); }
    const mag = Math.hypot(o.vx,o.vy) || 1;
    const target = 7 + Math.min(scrollEnergy, 36) * .45;
    o.vx += (o.vx / mag * target - o.vx) * .012;
    o.vy += (o.vy / mag * target - o.vy) * .012;
  }
  for (let i=0;i<orbs.length;i++) for(let j=i+1;j<orbs.length;j++) {
    const a=orbs[i], b=orbs[j], dx=b.x-a.x, dy=b.y-a.y;
    const dist=Math.hypot(dx,dy), min=a.r+b.r;
    if (dist && dist < min) {
      const nx=dx/dist, ny=dy/dist, overlap=(min-dist)/2;
      a.x-=nx*overlap; a.y-=ny*overlap; b.x+=nx*overlap; b.y+=ny*overlap;
      const p=2*(a.vx*nx+a.vy*ny-b.vx*nx-b.vy*ny)/2;
      a.vx-=p*nx; a.vy-=p*ny; b.vx+=p*nx; b.vy+=p*ny;
    }
  }
  scrollEnergy *= Math.pow(.945, dt*60);
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
  if (hovered < 0) physics(dt);
  updateHover();
  draw(); requestAnimationFrame(frame);
}

function updateHover() {
  const next = pointer.inside ? orbs.findIndex(o=>Math.hypot(pointer.x-o.x,pointer.y-o.y)<=o.r) : -1;
  if(next===hovered) return;
  hovered=next; activeLabel.textContent=hovered<0?'00':String(hovered+1).padStart(2,'0');
  document.body.classList.toggle('revealed',hovered>=0);
  canvas.style.cursor=hovered>=0?'none':'crosshair';
  if(hovered>=0) video.play().catch(()=>{}); else { video.pause(); video.currentTime=0; }
}

addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.inside=true;updateHover()});
addEventListener('pointerleave',()=>{pointer.inside=false;updateHover()});
addEventListener('scroll',()=>{const delta=Math.abs(scrollY-lastScroll);lastScroll=scrollY;scrollEnergy=Math.min(45,scrollEnergy+delta*.12)} ,{passive:true});
addEventListener('wheel',e=>{scrollEnergy=Math.min(45,scrollEnergy+Math.abs(e.deltaY)*.028)},{passive:true});
addEventListener('resize',resize);
sound.addEventListener('click',()=>{video.muted=!video.muted;sound.textContent=video.muted?'SOUND OFF':'SOUND ON'});
resize(); requestAnimationFrame(frame);
