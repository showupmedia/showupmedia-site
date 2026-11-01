// 3D film for desktop AND phones. Loaded after first paint (see index.html), so the poster + H1 stay the LCP.
// Phones get a tuned scene (low DPR, fewer/smaller textures, cheap materials, poster screens, no env map).
// The scene is built in small chunks, then a ~2 s frame-time probe decides: keep the 3D, or fade back to the lite layout.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const root = document.documentElement;
const MOB = root.classList.contains('mob');
const nap = (ms = 0) => new Promise(r => setTimeout(r, ms)); // yield to the main thread between build steps (no long tasks)

function giveUp(reason){
  try { if (reason === 'slow') localStorage.setItem('sum3d-off', String(Date.now())); } catch (e) {}
  if (window.__filmFail) window.__filmFail(reason);
}

async function main(){
const canvas = document.getElementById('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias:!MOB && devicePixelRatio < 2, powerPreference:MOB ? 'default' : 'high-performance', failIfMajorPerformanceCaveat:true});
} catch (e) { return giveUp('nogl'); }   // no WebGL, or only a software renderer
renderer.setPixelRatio(Math.min(devicePixelRatio, MOB ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = MOB ? 1.15 : 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030409);
scene.fog = new THREE.FogExp2(0x030409, MOB ? .028 : .022);
if (!MOB){ // image-based lighting: desktop only (PMREM is expensive on phones)
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;
  pmrem.dispose();
}
const camera = new THREE.PerspectiveCamera(MOB ? 58 : 38, innerWidth / innerHeight, .1, MOB ? 140 : 300);

scene.add(new THREE.AmbientLight(0x8fa6ff, MOB ? .5 : .25));
const key = new THREE.SpotLight(0xffe2c4, 260, 90, .55, .6, 1.4); key.position.set(10, 16, 18); scene.add(key, key.target);
const cool = new THREE.PointLight(0x4fb8ff, 60, 60); cool.position.set(-14, 6, -6); scene.add(cool);
const sweep = new THREE.PointLight(0x9a7bff, 0, 22); scene.add(sweep);

const loader = new THREE.TextureLoader();
const tex = url => { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MOB ? 1 : 4; if (MOB){ t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; } return t; };
const FD = MOB ? 'film/m/' : 'film/';
const Std = MOB ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial; // Lambert on phones: no PBR maths per pixel
const std = (o, extra) => new Std(MOB ? o : Object.assign(o, extra));
await nap();

// ---------- the film strip (real frames from a creator's stream) ----------
const NF = MOB ? 18 : 44, FW = 4.8, FH = 2.7, GAP = 5.4, HERO = MOB ? 10 : 26;
const stripLen = NF * GAP;
const curvePt = u => new THREE.Vector3(-stripLen / 2 + u * stripLen, 1.6 + Math.sin(u * Math.PI * 2.2) * .9, -Math.sin(u * Math.PI) * 9);
// one canvas texture for the strip border with sprocket holes
const sc = document.createElement('canvas'); sc.width = MOB ? 270 : 540; sc.height = MOB ? 200 : 400; const sg = sc.getContext('2d');
sg.scale(sc.width / 540, sc.height / 400);
sg.fillStyle = '#0b0b0d'; sg.fillRect(0, 0, 540, 400);
sg.fillStyle = '#d9d2c3';
for (let k = 0; k < 9; k++){ const x = 14 + k * 60; [[10], [362]].forEach(([y]) => { sg.beginPath(); sg.roundRect(x, y, 32, 26, 6); sg.fill(); }); }
const stripTex = new THREE.CanvasTexture(sc); stripTex.colorSpace = THREE.SRGBColorSpace;
const stripMat = std({map:stripTex, side:THREE.DoubleSide}, {roughness:.55, metalness:.1});
const frames = [];
const strip = new THREE.Group(); scene.add(strip);
const borderGeo = new THREE.PlaneGeometry(GAP, FH * 1.48), imgGeo = new THREE.PlaneGeometry(FW, FH); // shared geometry
for (let i = 0; i < NF; i++){
  const n = 1 + Math.round(i * (43 / (NF - 1)));
  const src = (i % 3 === 1 && i !== HERO) ? `${FD}a_${String(2 + (i * 7) % 16 + (((2 + (i * 7) % 16) >= 3) ? 1 : 0)).padStart(2, '0')}.webp` : `${FD}f_${String(n).padStart(2, '0')}.webp`;
  const g = new THREE.Group();
  const border = new THREE.Mesh(borderGeo, stripMat);
  const img = new THREE.Mesh(imgGeo, new THREE.MeshBasicMaterial({map:tex(src), toneMapped:false, color:0x8a8a8a}));
  img.position.z = .01; g.add(border, img);
  const u = i / (NF - 1), p = curvePt(u), p2 = curvePt(Math.min(1, u + .002));
  g.position.copy(p); g.lookAt(p.clone().add(new THREE.Vector3(-(p2.z - p.z), 0, p2.x - p.x).normalize()));
  g.userData = {base: p.clone(), rot: g.quaternion.clone(), img};
  strip.add(g); frames.push(g);
}
// floor: dark polished stage
const floor = new THREE.Mesh(new THREE.CircleGeometry(MOB ? 110 : 160, MOB ? 24 : 64), std({color:0x07080d}, {roughness:.38, metalness:.6}));
floor.rotation.x = -Math.PI / 2; floor.position.y = -2.6; scene.add(floor);
await nap();

// ---------- the phone ----------
function screenMask(){ const c = document.createElement('canvas'); c.width = 270; c.height = 570; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 270, 570); g.fillStyle = '#fff'; g.beginPath(); g.roundRect(0, 0, 270, 570, 40); g.fill(); return new THREE.CanvasTexture(c); }
const MASK = screenMask();
const titanium = MOB ? new THREE.MeshPhongMaterial({color:0x3a3d44, specular:0x9aa0aa, shininess:50})
  : new THREE.MeshPhysicalMaterial({color:0x3a3d44, metalness:1, roughness:.32, clearcoat:.6, clearcoatRoughness:.25});
const glass = MOB ? new THREE.MeshPhongMaterial({color:0x050507, specular:0xffffff, shininess:120})
  : new THREE.MeshPhysicalMaterial({color:0x050507, metalness:0, roughness:.04, clearcoat:1, clearcoatRoughness:.02, reflectivity:.9});
const lensGlass = MOB ? new THREE.MeshBasicMaterial({color:0x0a0c14})
  : new THREE.MeshPhysicalMaterial({color:0x0a0c14, metalness:.2, roughness:.05, clearcoat:1});
const SEG = MOB ? 2 : 8, CSEG = MOB ? 12 : 32;
function makePhone(screenMap){
  const g = new THREE.Group();
  const W = 2.2, H = 4.6, D = .26;
  g.add(new THREE.Mesh(new RoundedBoxGeometry(W, H, D, SEG, .34), titanium));
  const front = new THREE.Mesh(new RoundedBoxGeometry(W - .06, H - .06, .02, MOB ? 2 : 6, .3), glass); front.position.z = D / 2 + .002; g.add(front);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W - .2, (W - .2) * 16 / 9), new THREE.MeshBasicMaterial({map:screenMap, alphaMap:MASK, transparent:true, toneMapped:false}));
  screen.position.z = D / 2 + .015; g.add(screen);
  const island = new THREE.Mesh(MOB ? new THREE.PlaneGeometry(.62, .17) : new RoundedBoxGeometry(.62, .17, .01, 4, .085), new THREE.MeshBasicMaterial({color:0x000000})); island.position.set(0, (W - .2) * 16 / 9 / 2 - .2, D / 2 + .02); g.add(island);
  if (!MOB) [[W / 2 + .01, .9, .55], [W / 2 + .01, .25, .45], [-W / 2 - .01, 1.1, .35]].forEach(([x, y, h]) => { const b = new THREE.Mesh(new RoundedBoxGeometry(.05, h, .1, 2, .02), titanium); b.position.set(x, y, 0); g.add(b); });
  // camera plateau + lenses on the back
  const bump = new THREE.Mesh(new RoundedBoxGeometry(.95, .95, .08, MOB ? 1 : 4, .22), titanium); bump.position.set(-.48, 1.62, -D / 2 - .03); g.add(bump);
  [[-.7, 1.84], [-.26, 1.84], [-.7, 1.4]].forEach(([x, y]) => {
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.12, CSEG), lensGlass); lens.rotation.y = Math.PI; lens.position.set(x, y, -D / 2 - .126);
    g.add(lens);
    if (!MOB){ const ring = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .07, CSEG), titanium); ring.rotation.x = Math.PI / 2; ring.position.set(x, y, -D / 2 - .09); g.add(ring); }
  });
  g.userData.screen = screen;
  return g;
}
// Desktop: live video screens (created here, so they never download unless the 3D runs). Phones: still poster frames.
const clips = ['clip2', 'ana1', 'clip3'];
const vids = MOB ? [] : clips.map(n => { const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.crossOrigin = 'anonymous'; v.src = `film/${n}.mp4`; return v; });
const phones = clips.map((n, k) => {
  let map;
  if (MOB) map = tex(`film/m/${n}-screen.webp`);
  else { map = new THREE.VideoTexture(vids[k]); map.colorSpace = THREE.SRGBColorSpace; }
  return makePhone(map);
});
const heroPos = frames[HERO].userData.base.clone();
phones.forEach(p => { p.visible = false; scene.add(p); });
await nap();

// ---------- platforms (soft labels) ----------
const labels = ['TikTok', 'YouTube Shorts', 'Reels', 'Facebook', 'X'].map(name => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 120; const g = c.getContext('2d');
  g.font = '800 70px Archivo, Inter, sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(name, 256, 88);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c), transparent:true, opacity:0, depthWrite:false}));
  s.scale.set(3.4, .8, 1); s.visible = false; scene.add(s); return s;
});

// ---------- the receipts corridor ----------
const proofs = MOB ? ['fb-30m', 'tt-1-17m', 'tt-19m', 'fb-earnings', 'yt-28d'] : ['fb-30m', 'tt-1-17m', 'tt-19m', 'fb-earnings', 'yt-28d', 'tt-768k', 'yt-22m', 'tt-588k'];
const corridor = new THREE.Group(); scene.add(corridor);
const panels = [];
const frameMat = std({color:0x10141f}, {metalness:.6, roughness:.35});
proofs.forEach((n, i) => loader.load(`proof/${MOB ? 'm/' : ''}${n}.webp`, t => {
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MOB ? 1 : 4;
  const a = t.image.width / t.image.height, h = a > 1.2 ? 3.4 : 5.4, w = h * a;
  const g = new THREE.Group();
  const frame = new THREE.Mesh(MOB ? new THREE.BoxGeometry(w + .24, h + .24, .1) : new RoundedBoxGeometry(w + .24, h + .24, .1, 4, .1), frameMat);
  const img = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map:t, toneMapped:false, color:0xd2d2d2, transparent:true, opacity:0}));
  img.position.z = .06; g.add(frame, img);
  const side = i % 2 ? 1 : -1;
  g.position.set(heroPos.x + (MOB ? side * 2.6 : (side > 0 ? 4.8 : 1.2 + i * .1)), heroPos.y + .6 + (i % 3 - 1) * .5, heroPos.z - 14 - i * (MOB ? 8 : 6.5));
  g.rotation.y = -side * .5; g.userData = {img, side, base: g.position.clone()};
  corridor.add(g); panels.push(g);
}));

// ---------- dust ----------
const DN = MOB ? 140 : 1400, dp = new Float32Array(DN * 3);
for (let i = 0; i < DN; i++){ dp[i * 3] = (Math.random() - .5) * stripLen * 1.2; dp[i * 3 + 1] = Math.random() * 14 - 2; dp[i * 3 + 2] = 14 - Math.random() * 90; }
const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
const dust = new THREE.Points(dg, new THREE.PointsMaterial({color:0xffe8cc, size:MOB ? .08 : .05, transparent:true, opacity:.55, depthWrite:false}));
scene.add(dust);

// ---------- direction: camera shots keyed to the scroll ----------
const H0 = heroPos;
const SHOTS = [ // p, camera, target
  [0.00, [-stripLen / 2 - 6, 3.2, 9], [-stripLen / 2 + 8, 1.6, 0]],
  [0.17, [H0.x - 30, 2.6, H0.z + 8.5], [H0.x - 18, 1.6, H0.z]],
  [0.30, [H0.x - 4, 2.2, H0.z + 7.5], [H0.x, 1.8, H0.z]],
  [0.37, [H0.x - .8, 2.6, H0.z + 7.2], [H0.x, 2.6, H0.z]],
  [0.48, [H0.x + 2.6, 3.7, H0.z + 8.8], [H0.x, 3.6, H0.z]],
  [0.57, [H0.x - 2.4, 3.9, H0.z + 9.2], [H0.x, 3.6, H0.z]],
  [0.70, [H0.x, 4.6, H0.z + 13], [H0.x, 3.6, H0.z]],
  [0.80, [H0.x, 3.6, H0.z - 4], [H0.x, 3.6, H0.z - 20]],
  [1.00, [H0.x, 3.2, H0.z - 52], [H0.x, 3.4, H0.z - 80]],
];
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const V = a => new THREE.Vector3(...a);
const camC = new THREE.CatmullRomCurve3(SHOTS.map(s => V(s[1])), false, 'centripetal');
const tgtC = new THREE.CatmullRomCurve3(SHOTS.map(s => V(s[2])), false, 'centripetal');
function shotU(p){ // map scroll progress to curve parameter, holding on each shot like cuts in an edit
  for (let k = 0; k < SHOTS.length - 1; k++){ const a = SHOTS[k][0], b = SHOTS[k + 1][0];
    if (p <= b) return (k + ease((p - a) / (b - a))) / (SHOTS.length - 1); }
  return 1;
}
const R = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const sm = t => t * t * (3 - 2 * t);

// ---------- frame-time probe: ~2 s of real rendering decides whether this device keeps the 3D ----------
const PROBE_MS = 2000, WARMUP_MS = 300, MIN_FPS = 40;
const probe = {on:false, start:0, last:0, time:0, n:0, long:0, result:null, fps:0};
let cap = 0, lastDraw = 0; // cap = min ms between draws (30 fps cap on phones that pass but can't hold 60)

let PT = 0, P = 0, mx = 0, my = 0, smx = 0, smy = 0, running = !document.hidden && !window.__belowFilm, dead = false;
window.__film = v => PT = v;
window.__state = () => ({P, PT, mob:MOB, probe:probe.result, fps:probe.fps, long:probe.long, frames:probe.n, cap:Math.round(cap)});
window.__filmRun = v => { const was = running; running = v && !dead; if (running && !was){ probe.last = 0; requestAnimationFrame(frame); } };
if (!MOB) addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; });
let lastW = innerWidth, lastH = innerHeight;
addEventListener('resize', () => { // phones fire resize when the URL bar shows/hides; ignore those small height changes
  if (MOB && innerWidth === lastW && Math.abs(innerHeight - lastH) < 160) return;
  lastW = innerWidth; lastH = innerHeight; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const look = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), upQ = new THREE.Quaternion(), eul = new THREE.Euler();
const clock = new THREE.Clock(); let playing = false;
function setVideos(on){ if (on === playing) return; playing = on; vids.forEach(v => { if (on){ v.preload = 'auto'; v.play().catch(() => {}); } else v.pause(); }); }
document.addEventListener('visibilitychange', () => window.__filmRun(!document.hidden && !window.__belowFilm));

function probeTick(now){
  if (!probe.last){ probe.last = now; return; }        // first frame after start / resume
  const dt = now - probe.last; probe.last = now;
  if (now - probe.start < WARMUP_MS) return;           // ignore shader/texture warm-up frames
  probe.time += dt; probe.n++; if (dt > 50) probe.long++;
  // bail out early on a clearly struggling device, so it never sits through 2 s of janky frames
  if (dt > 250 || (probe.n >= 8 && probe.time / probe.n > 50)){ probe.on = false; probe.fps = Math.round(probe.n / (probe.time / 1000)); probe.result = 'fail'; return die('slow'); }
  if (probe.time < PROBE_MS) return;
  probe.on = false; probe.fps = Math.round(probe.n / (probe.time / 1000));
  const ok = probe.fps >= MIN_FPS && probe.long / probe.n <= .1;
  probe.result = ok ? 'pass' : 'fail';
  if (!ok) return die('slow');
  if (MOB && probe.fps < 55) cap = 1000 / 30 - 2;      // a steady 30 fps beats an uneven 40-50
  root.classList.add('gl-on');                          // poster fades out, live 3D shows
}
function die(reason){
  dead = true; running = false; setVideos(false);
  root.classList.remove('gl-probe', 'gl-on');
  giveUp(reason);
  setTimeout(() => { renderer.dispose(); renderer.forceContextLoss(); }, 1200); // after the canvas has faded out
}
// Testing hook: add ?lowfps to the URL to simulate a slow phone (each frame burns 40 ms) and watch the fallback.
const FORCE_SLOW = /[?&]lowfps\b/.test(location.search);
function busy(ms){ const t = performance.now(); while (performance.now() - t < ms); }

function frame(now){
  if (!running) return;
  requestAnimationFrame(frame);
  if (probe.on) probeTick(now);
  else if (cap && now - lastDraw < cap) return;
  if (dead) return;
  lastDraw = now;
  if (FORCE_SLOW) busy(40);
  const t = clock.getElapsedTime();
  P += (PT - P) * (cap ? .16 : .085); smx += (mx - smx) * .05; smy += (my - smy) * .05;
  const u = shotU(P);
  camera.position.copy(camC.getPoint(u)); look.copy(tgtC.getPoint(u));   // getPoint: hits each shot exactly at its scroll mark
  camera.position.x += smx * .6; camera.position.y -= smy * .35; // handheld drift with the mouse
  camera.position.y += Math.sin(t * .7) * .04;                   // breathing camera
  camera.lookAt(look);

  // Act I-II: strip glides; a projector light sweeps toward the hero frame; everything else dims
  const scan = R(P, .17, .33), focus = sm(R(P, .28, .37));
  const sweepX = frames[0].userData.base.x + (H0.x - frames[0].userData.base.x) * sm(scan);
  sweep.position.set(sweepX, 3.5, H0.z + 3); sweep.intensity = 40 * Math.sin(Math.PI * Math.min(1, scan * 1.05)) + 30 * focus;
  const stripOn = P < .8;
  strip.visible = stripOn;
  if (stripOn) frames.forEach((f, i) => {
    const d = f.userData, isHero = i === HERO;
    const wave = Math.sin(t * .6 + i * .35) * .06;
    f.position.set(d.base.x, d.base.y + wave, d.base.z);
    const lit = 1 - Math.min(1, Math.abs(d.base.x - sweepX) / 9);
    const dim = isHero ? 1 : 1 - focus * .75;
    d.img.material.color.setScalar((.62 + .38 * Math.max(lit * (scan > 0 && scan < 1 ? 1 : 0), isHero ? focus : 0)) * dim);
    if (isHero){ // Act III: the moment lifts out of the strip and turns vertical
      const lift = sm(R(P, .37, .47));
      f.position.y = d.base.y + lift * 2;
      f.quaternion.copy(d.rot); f.rotateZ(lift * Math.PI / 2);
      f.scale.setScalar(1 + lift * .08);
      f.visible = lift < .6;
    }
  });

  // phones: the hero frame becomes a phone; then two more join for the release
  const born = sm(R(P, .41, .48)), fan = sm(R(P, .58, .7)), away = sm(R(P, .76, .84));
  phones.forEach((ph, k) => {
    const side = k === 0 ? 0 : (k === 1 ? -1 : 1);
    const show = k === 0 ? born : fan;
    ph.visible = show > .001 && away < .999;
    if (!ph.visible) return;
    ph.position.set(H0.x + side * 3.2 * fan, H0.y + 2 + Math.sin(t * .9 + k) * .08, H0.z + (k ? -1.2 : 0) * fan);
    ph.scale.setScalar(Math.max(.001, show * (1 - away)));
    tmpQ.setFromEuler(eul.set(0, side * -.35 * fan + Math.sin(t * .4 + k) * .12 + smx * .25, 0));
    upQ.setFromEuler(eul.set(0, Math.PI * (1 - show), 0)); // spin in
    ph.quaternion.copy(tmpQ).multiply(upQ);
  });
  setVideos(P > .4 && P < .82);
  const lo = fan * (1 - away);
  labels.forEach((s, i) => { s.visible = lo > .001; if (!s.visible) return; const a = t * .25 + i * Math.PI * 2 / 5;
    s.position.set(H0.x + Math.cos(a) * 6.5, H0.y + 2.4 + Math.sin(a * 1.4) * 1.6, H0.z + Math.sin(a) * 3.5 - 1); s.material.opacity = lo * .9; });

  // Act V: walk through the receipts
  const rin = sm(R(P, .78, .86));
  corridor.visible = rin > 0;
  if (rin > 0) panels.forEach((g, i) => { const d = g.userData; d.img.material.opacity = rin;
    g.position.y = d.base.y + Math.sin(t * .5 + i) * .12; g.rotation.y = -d.side * .5 + smx * .1; });

  dust.position.y = Math.sin(t * .15) * .4; dust.rotation.y = t * .004;
  key.position.set(camera.position.x + 8, 16, camera.position.z + 10); key.target.position.copy(look);
  renderer.render(scene, camera);
}

if (window.__filmP != null) PT = P = window.__filmP;
await nap();
// compile every shader up front (in parallel where the browser supports it), so the first frame is not one long task
try { await renderer.compileAsync(scene, camera); } catch (e) {}
await nap();
root.classList.add('gl-probe');      // canvas is live under the poster; the poster only fades once the probe passes
probe.on = true; probe.start = performance.now();
if (running) requestAnimationFrame(frame);
}

main().catch(() => giveUp('error'));
