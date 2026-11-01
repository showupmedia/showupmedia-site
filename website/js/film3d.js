// Desktop-only 3D film. Loaded lazily after the page is interactive (see index.html).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const mobile = false; // phones never load this file; they get the static poster
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias:devicePixelRatio < 2, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030409);
scene.fog = new THREE.FogExp2(0x030409, mobile ? .028 : .022);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;
const camera = new THREE.PerspectiveCamera(mobile ? 58 : 38, innerWidth / innerHeight, .1, 300);

scene.add(new THREE.AmbientLight(0x8fa6ff, .25));
const key = new THREE.SpotLight(0xffe2c4, 260, 90, .55, .6, 1.4); key.position.set(10, 16, 18); scene.add(key, key.target);
const cool = new THREE.PointLight(0x4fb8ff, 60, 60); cool.position.set(-14, 6, -6); scene.add(cool);
const sweep = new THREE.PointLight(0x9a7bff, 0, 22); scene.add(sweep);

const loader = new THREE.TextureLoader();
const tex = url => { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

// ---------- the film strip (real frames from a creator's stream) ----------
const NF = mobile ? 26 : 44, FW = 4.8, FH = 2.7, GAP = 5.4, HERO = mobile ? 15 : 26;
const stripLen = NF * GAP;
const curvePt = u => new THREE.Vector3(-stripLen / 2 + u * stripLen, 1.6 + Math.sin(u * Math.PI * 2.2) * .9, -Math.sin(u * Math.PI) * 9);
// one canvas texture for the strip border with sprocket holes
const sc = document.createElement('canvas'); sc.width = 540; sc.height = 400; const sg = sc.getContext('2d');
sg.fillStyle = '#0b0b0d'; sg.fillRect(0, 0, 540, 400);
sg.fillStyle = '#d9d2c3';
for (let k = 0; k < 9; k++){ const x = 14 + k * 60; [[10], [362]].forEach(([y]) => { sg.beginPath(); sg.roundRect(x, y, 32, 26, 6); sg.fill(); }); }
const stripTex = new THREE.CanvasTexture(sc); stripTex.colorSpace = THREE.SRGBColorSpace;
const stripMat = new THREE.MeshStandardMaterial({map:stripTex, roughness:.55, metalness:.1, side:THREE.DoubleSide});
const frames = [];
const strip = new THREE.Group(); scene.add(strip);
for (let i = 0; i < NF; i++){
  const n = 1 + Math.round(i * (43 / (NF - 1)));
  const src = (i % 3 === 1 && i !== HERO) ? `film/a_${String(2 + (i * 7) % 16 + (((2 + (i * 7) % 16) >= 3) ? 1 : 0)).padStart(2, '0')}.webp` : `film/f_${String(n).padStart(2, '0')}.webp`;
  const g = new THREE.Group();
  const border = new THREE.Mesh(new THREE.PlaneGeometry(GAP, FH * 1.48), stripMat);
  const img = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), new THREE.MeshBasicMaterial({map:tex(src), toneMapped:false, color:0x8a8a8a}));
  img.position.z = .01; g.add(border, img);
  const u = i / (NF - 1), p = curvePt(u), p2 = curvePt(Math.min(1, u + .002));
  g.position.copy(p); g.lookAt(p.clone().add(new THREE.Vector3(-(p2.z - p.z), 0, p2.x - p.x).normalize()));
  g.userData = {base: p.clone(), rot: g.quaternion.clone(), img};
  strip.add(g); frames.push(g);
}
// floor: dark polished stage
const floor = new THREE.Mesh(new THREE.CircleGeometry(160, 64), new THREE.MeshStandardMaterial({color:0x07080d, roughness:.38, metalness:.6}));
floor.rotation.x = -Math.PI / 2; floor.position.y = -2.6; scene.add(floor);

// ---------- a properly modelled phone ----------
function screenMask(){ const c = document.createElement('canvas'); c.width = 270; c.height = 570; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 270, 570); g.fillStyle = '#fff'; g.beginPath(); g.roundRect(0, 0, 270, 570, 40); g.fill(); return new THREE.CanvasTexture(c); }
const MASK = screenMask();
const titanium = new THREE.MeshPhysicalMaterial({color:0x3a3d44, metalness:1, roughness:.32, clearcoat:.6, clearcoatRoughness:.25});
const glass = new THREE.MeshPhysicalMaterial({color:0x050507, metalness:0, roughness:.04, clearcoat:1, clearcoatRoughness:.02, reflectivity:.9});
const lensGlass = new THREE.MeshPhysicalMaterial({color:0x0a0c14, metalness:.2, roughness:.05, clearcoat:1});
function makePhone(video){
  const g = new THREE.Group();
  const W = 2.2, H = 4.6, D = .26;
  g.add(new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 8, .34), titanium));
  const front = new THREE.Mesh(new RoundedBoxGeometry(W - .06, H - .06, .02, 6, .3), glass); front.position.z = D / 2 + .002; g.add(front);
  const vt = new THREE.VideoTexture(video); vt.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W - .2, (W - .2) * 16 / 9), new THREE.MeshBasicMaterial({map:vt, alphaMap:MASK, transparent:true, toneMapped:false}));
  screen.position.z = D / 2 + .015; g.add(screen);
  const island = new THREE.Mesh(new RoundedBoxGeometry(.62, .17, .01, 4, .085), new THREE.MeshBasicMaterial({color:0x000000})); island.position.set(0, (W - .2) * 16 / 9 / 2 - .2, D / 2 + .02); g.add(island);
  // side buttons
  [[W / 2 + .01, .9, .55], [W / 2 + .01, .25, .45], [-W / 2 - .01, 1.1, .35]].forEach(([x, y, h]) => { const b = new THREE.Mesh(new RoundedBoxGeometry(.05, h, .1, 2, .02), titanium); b.position.set(x, y, 0); g.add(b); });
  // camera plateau + lenses on the back
  const bump = new THREE.Mesh(new RoundedBoxGeometry(.95, .95, .08, 4, .22), titanium); bump.position.set(-.48, 1.62, -D / 2 - .03); g.add(bump);
  [[-.7, 1.84], [-.26, 1.84], [-.7, 1.4]].forEach(([x, y]) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .07, 32), titanium); ring.rotation.x = Math.PI / 2; ring.position.set(x, y, -D / 2 - .09);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.12, 32), lensGlass); lens.rotation.y = Math.PI; lens.position.set(x, y, -D / 2 - .126);
    g.add(ring, lens);
  });
  g.userData.screen = screen;
  return g;
}
// phone-screen videos are created here (not in the HTML) so they never download unless the 3D runs
const vids = ['clip2', 'ana1', 'clip3'].map(n => { const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.crossOrigin = 'anonymous'; v.src = `film/${n}.mp4`; return v; });
const phones = vids.map(makePhone);
const heroPos = frames[HERO].userData.base.clone();
phones.forEach(p => { p.visible = false; scene.add(p); });

// ---------- platforms (soft labels) ----------
const labels = ['TikTok', 'YouTube Shorts', 'Reels', 'Facebook', 'X'].map((name, i) => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 120; const g = c.getContext('2d');
  g.font = '800 70px Archivo, Inter, sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(name, 256, 88);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c), transparent:true, opacity:0, depthWrite:false}));
  s.scale.set(3.4, .8, 1); scene.add(s); return s;
});

// ---------- the receipts corridor ----------
const proofs = ['fb-30m', 'tt-1-17m', 'tt-19m', 'fb-earnings', 'yt-28d', 'tt-768k', 'yt-22m', 'tt-588k'];
const corridor = new THREE.Group(); scene.add(corridor);
const panels = [];
proofs.forEach((n, i) => loader.load(`proof/${n}.webp`, t => {
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const a = t.image.width / t.image.height, h = a > 1.2 ? 3.4 : 5.4, w = h * a;
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new RoundedBoxGeometry(w + .24, h + .24, .1, 4, .1), new THREE.MeshStandardMaterial({color:0x10141f, metalness:.6, roughness:.35}));
  const img = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map:t, toneMapped:false, color:0xd2d2d2, transparent:true, opacity:0}));
  img.position.z = .06; g.add(frame, img);
  const side = i % 2 ? 1 : -1;
  g.position.set(heroPos.x + (mobile ? side * 2.6 : (side > 0 ? 4.8 : 1.2 + i * .1)), heroPos.y + .6 + (i % 3 - 1) * .5, heroPos.z - 14 - i * 6.5);
  g.rotation.y = -side * .5; g.userData = {img, side, base: g.position.clone()};
  corridor.add(g); panels.push(g);
}));

// ---------- dust ----------
const DN = mobile ? 500 : 1400, dp = new Float32Array(DN * 3);
for (let i = 0; i < DN; i++){ dp[i * 3] = (Math.random() - .5) * stripLen * 1.2; dp[i * 3 + 1] = Math.random() * 14 - 2; dp[i * 3 + 2] = 14 - Math.random() * 90; }
const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
const dust = new THREE.Points(dg, new THREE.PointsMaterial({color:0xffe8cc, size:.05, transparent:true, opacity:.55, depthWrite:false}));
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

let PT = 0, P = 0, mx = 0, my = 0, smx = 0, smy = 0, running = true;
window.__film = v => PT = v;
window.__state = () => ({P, PT});
window.__filmRun = v => { const was = running; running = v; if (v && !was) requestAnimationFrame(frame); };
addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const look = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), upQ = new THREE.Quaternion();
const clock = new THREE.Clock(); let playing = false;
function setVideos(on){ if (on === playing) return; playing = on; vids.forEach(v => { if (on){ v.preload = 'auto'; v.play().catch(() => {}); } else v.pause(); }); }
document.addEventListener('visibilitychange', () => window.__filmRun(!document.hidden && !window.__belowFilm));
let first = true;

function frame(){
  if (!running) return;
  requestAnimationFrame(frame);
  const t = clock.getElapsedTime();
  P += (PT - P) * .085; smx += (mx - smx) * .05; smy += (my - smy) * .05;
  const u = shotU(P);
  camera.position.copy(camC.getPoint(u)); look.copy(tgtC.getPoint(u));   // getPoint: hits each shot exactly at its scroll mark
  camera.position.x += smx * .6; camera.position.y -= smy * .35; // handheld drift with the mouse
  camera.position.y += Math.sin(t * .7) * .04;                   // breathing camera
  camera.lookAt(look);

  // Act I-II: strip glides; a projector light sweeps toward the hero frame; everything else dims
  const scan = R(P, .17, .33), focus = sm(R(P, .28, .37));
  const sweepX = frames[0].userData.base.x + (H0.x - frames[0].userData.base.x) * sm(scan);
  sweep.position.set(sweepX, 3.5, H0.z + 3); sweep.intensity = 40 * Math.sin(Math.PI * Math.min(1, scan * 1.05)) + 30 * focus;
  frames.forEach((f, i) => {
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
  strip.visible = P < .8;

  // phones: the hero frame becomes a phone; then two more join for the release
  const born = sm(R(P, .41, .48)), fan = sm(R(P, .58, .7)), away = sm(R(P, .76, .84));
  phones.forEach((ph, k) => {
    const side = k === 0 ? 0 : (k === 1 ? -1 : 1);
    const show = k === 0 ? born : fan;
    ph.visible = show > .001 && away < .999;
    ph.position.set(H0.x + side * 3.2 * fan, H0.y + 2 + side * 0 + Math.sin(t * .9 + k) * .08, H0.z + (k ? -1.2 : 0) * fan);
    ph.scale.setScalar(Math.max(.001, show * (1 - away)));
    tmpQ.setFromEuler(new THREE.Euler(0, side * -.35 * fan + Math.sin(t * .4 + k) * .12 + smx * .25, 0));
    upQ.setFromEuler(new THREE.Euler(0, Math.PI * (1 - show), 0)); // spin in
    ph.quaternion.copy(tmpQ).multiply(upQ);
  });
  setVideos(P > .4 && P < .82);
  labels.forEach((s, i) => { const a = t * .25 + i * Math.PI * 2 / 5; const o = fan * (1 - away);
    s.position.set(H0.x + Math.cos(a) * 6.5, H0.y + 2.4 + Math.sin(a * 1.4) * 1.6, H0.z + Math.sin(a) * 3.5 - 1); s.material.opacity = o * .9; });

  // Act V: walk through the receipts
  const rin = sm(R(P, .78, .86));
  panels.forEach((g, i) => { const d = g.userData; d.img.material.opacity = rin;
    g.position.y = d.base.y + Math.sin(t * .5 + i) * .12; g.rotation.y = -d.side * .5 + smx * .1; });
  corridor.visible = rin > 0;

  dust.position.y = Math.sin(t * .15) * .4; dust.rotation.y = t * .004;
  key.position.set(camera.position.x + 8, 16, camera.position.z + 10); key.target.position.copy(look);
  renderer.render(scene, camera);
  if (first){ first = false; document.documentElement.classList.add('gl-on'); }
}
if (window.__filmP != null) PT = window.__filmP;
frame();
