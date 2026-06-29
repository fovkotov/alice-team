const canvas = document.querySelector('#storm');
const stage = document.querySelector('.stage');
const media = [
  document.querySelector('#hover-video'),
  document.querySelector('#hover-image-1'),
  document.querySelector('#hover-image-2')
];
const video = media[0];
const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });

if (!gl) throw new Error('WebGL is required for Cherry Storm');

const MAX = 22;
const vertexSource = `
attribute vec2 p;
void main(){ gl_Position = vec4(p, 0., 1.); }
`;
const fragmentSource = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform int count;
uniform int hovered;
uniform vec3 balls[${MAX}];

void main() {
  vec2 uv = gl_FragCoord.xy;
  vec3 color = vec3(0.0);
  float alpha = hovered >= 0 ? 0.0 : 1.0;

  for (int i=0; i<${MAX}; i++) {
    if (i >= count) break;
    vec2 q = uv - balls[i].xy;
    float d = length(q) - balls[i].z;
    float fill = 1. - smoothstep(-1.5, 1.5, d);
    if (hovered < 0) {
      color = mix(color, vec3(1.), fill);
      alpha = max(alpha, fill);
    }
    if (hovered == i) {
      alpha = max(alpha, fill);
      color = mix(color, vec3(0.), fill);
    }
  }
  gl_FragColor = vec4(color, alpha);
}
`;

function shader(type, source) {
  const value = gl.createShader(type);
  gl.shaderSource(value, source);
  gl.compileShader(value);
  if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value));
  return value;
}

const program = gl.createProgram();
gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
gl.linkProgram(program);
gl.useProgram(program);

const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
const p = gl.getAttribLocation(program, 'p');
gl.enableVertexAttribArray(p);
gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);

const uResolution = gl.getUniformLocation(program, 'resolution');
const uTime = gl.getUniformLocation(program, 'time');
const uCount = gl.getUniformLocation(program, 'count');
const uHovered = gl.getUniformLocation(program, 'hovered');
const uBalls = gl.getUniformLocation(program, 'balls');

let width = 0;
let height = 0;
let dpr = 1;
let hovered = -1;
let lastY = window.scrollY;
let scrollBoost = 0;
let pointer = { x: -9999, y: -9999 };
let balls = [];

function randomBall(i, total) {
  const small = Math.min(width, height);
  const r = Math.max(28, Math.min(44, small * .047));
  const angle = i / total * Math.PI * 2 + Math.random()*.4;
  const ring = small * (.18 + Math.random()*.28);
  return {
    x: width*.5 + Math.cos(angle)*ring,
    y: height*.52 + Math.sin(angle)*ring,
    r,
    vx: (Math.random()-.5)*12,
    vy: (Math.random()-.5)*12,
    mediaIndex: Math.floor(Math.random()*media.length)
  };
}

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  width = innerWidth;
  height = innerHeight;
  canvas.width = Math.round(width*dpr);
  canvas.height = Math.round(height*dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
  const desired = width < 700 ? 12 : 18;
  if (!balls.length) balls = Array.from({length: desired}, (_, i) => randomBall(i, desired));
  balls.forEach(b => {
    b.x = Math.min(width-b.r, Math.max(b.r, b.x));
    b.y = Math.min(height-b.r, Math.max(b.r, b.y));
  });
}

function collision(a, b) {
  const dx = b.x-a.x, dy = b.y-a.y;
  const min = a.r+b.r+2;
  const dist2 = dx*dx+dy*dy;
  if (dist2 <= 0 || dist2 >= min*min) return;
  const dist = Math.sqrt(dist2), nx = dx/dist, ny = dy/dist;
  const overlap = (min-dist)*(.65 + scrollBoost*.55);
  a.x -= nx*overlap; a.y -= ny*overlap;
  b.x += nx*overlap; b.y += ny*overlap;
  const rel = (b.vx-a.vx)*nx + (b.vy-a.vy)*ny;
  if (rel < 0) {
    const bounce = .72 + scrollBoost * .12;
    const impulse = -rel * bounce;
    a.vx -= impulse*nx; a.vy -= impulse*ny;
    b.vx += impulse*nx; b.vy += impulse*ny;
  }
}

function applyScrollKick(amount) {
  if (!balls.length || amount <= 0) return;
  const strength = Math.min(5, amount / 18);
  scrollBoost = Math.min(1, scrollBoost + strength * .65);
  const span = Math.max(width, height);
  for (const b of balls) {
    const angle = Math.random() * Math.PI * 2;
    const kick = span * (.55 + strength * .95 + scrollBoost * .75);
    b.vx += Math.cos(angle) * kick;
    b.vy += Math.sin(angle) * kick;
  }
}

function update(dt) {
  scrollBoost *= Math.pow(.58, dt);
  const wallBounce = .62 + scrollBoost * .14;
  const drag = Math.pow(.965, dt * 60);
  stage.dataset.speed = scrollBoost.toFixed(2);
  for (const b of balls) {
    b.vx *= drag;
    b.vy *= drag;
    if (scrollBoost < .08) {
      const speed = Math.hypot(b.vx,b.vy) || 1;
      const desired = Math.max(7, 8*(.7+b.r/Math.min(width,height)*4));
      const adjust = Math.pow(desired/speed, Math.min(1, dt*14));
      b.vx *= adjust; b.vy *= adjust;
    }
    b.x += b.vx*dt; b.y += b.vy*dt;
    if (b.x < b.r) { b.x=b.r; b.vx=Math.abs(b.vx)*wallBounce; }
    if (b.x > width-b.r) { b.x=width-b.r; b.vx=-Math.abs(b.vx)*wallBounce; }
    if (b.y < b.r) { b.y=b.r; b.vy=Math.abs(b.vy)*wallBounce; }
    if (b.y > height-b.r) { b.y=height-b.r; b.vy=-Math.abs(b.vy)*wallBounce; }
  }
  for (let i=0;i<balls.length;i++) for(let j=i+1;j<balls.length;j++) collision(balls[i],balls[j]);
}

function hitTest() {
  const previousHover = hovered;
  hovered = balls.findIndex(b => Math.hypot(pointer.x-b.x, pointer.y-b.y) < b.r);
  stage.classList.toggle('is-hovering', hovered >= 0);
  const activeIndex = hovered >= 0 ? balls[hovered].mediaIndex : -1;
  stage.classList.toggle('has-media', activeIndex >= 0);
  media.forEach((item, index) => item.classList.toggle('is-active', index === activeIndex));
  if (activeIndex === 0) video.play().catch(()=>{});
  else if (!video.paused || previousHover !== hovered) video.pause();
}

let previous = performance.now();
function frame(now) {
  const dt = Math.min((now-previous)/1000, .033);
  previous = now;
  update(dt);
  hitTest();
  const packed = new Float32Array(MAX*3);
  balls.forEach((b,i) => {
    packed[i*3] = b.x*dpr;
    packed[i*3+1] = (height-b.y)*dpr;
    packed[i*3+2] = b.r*dpr;
  });
  gl.uniform2f(uResolution, canvas.width, canvas.height);
  gl.uniform1f(uTime, now/1000);
  gl.uniform1i(uCount, balls.length);
  gl.uniform1i(uHovered, hovered);
  gl.uniform3fv(uBalls, packed);
  gl.clearColor(0,0,0,0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
addEventListener('pointermove', e => { pointer.x=e.clientX; pointer.y=e.clientY; });
addEventListener('pointerleave', () => { pointer.x=-9999; pointer.y=-9999; });
addEventListener('scroll', () => {
  const delta = Math.abs(scrollY-lastY);
  lastY = scrollY;
  applyScrollKick(delta);
}, {passive:true});
addEventListener('wheel', e => {
  applyScrollKick(Math.abs(e.deltaY));
}, {passive:true});

resize();
requestAnimationFrame(frame);
