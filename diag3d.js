/* SpaceDoc full check-up summary in 3D (Three.js r149): the astronaut stands on a holographic scan ring in the navy cabin.
   Five luminous markers on the body show the real values (heart rate, pressure, blood, mind, chest); colours and the cabin light follow the alert level;
   tap a marker (or a row of the 2D summary) to fly the camera closer; "Continue" retracts the ring and the astronaut walks on.
   Needs cabin3d.js + bike3d.js.   API: Diag3d.init(stage,{getData,onPick}) · focus(key) · setScanning(b) · advance(cb) · reset() · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D, B = window.Bike3D;
  const api = { ready: false, failed: false };
  window.Diag3d = api;
  if (!T || !C || !C.kit || !B || !B.makeAstronaut) { api.failed = true; return; }
  const K = C.kit, M = K.M, ctex = K.ctex, clamp = K.clamp, mesh = K.mesh;
  const V = (x, y, z) => new T.Vector3(x, y, z), lerp = (a, b, p) => a + (b - a) * p, ease = p => p * p * (3 - 2 * p);
  const GREY = 0x6f7c99, COL = [0x2ee6a6, 0xffd23f, 0xff4d5e];

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, getData = () => ({}), onPick = () => {};
  let t0 = performance.now(), last = 0, lastDraw = 0, drag = { yaw: 0, down: false, x: 0 }, camBase = { y: 1.9, z: 7 };
  let A, body, rigG, ringG, scanRing, platRing, cone, statusL, pg, ptex, o2g, o2tex, anaScr, anaTex, wireCurve, wireMesh, beads = [], markers = {}, hits = [], focusKey = null, scanning = false, adv = null, curPos, curLook, appear = 0;
  const KEYS = ['hr', 'bp', 'blood', 'mind', 'chest'];

  /* ---------- room, panel, oxygen gauge, blood analyzer ---------- */
  function room() {
    const wt = K.wallTexture(), ft = K.floorTexture();
    const wm = (w, h) => { const t = wt.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(w / 3, h / 3); return M({ map: t, roughness: .7, metalness: .25 }); };
    const plane = (w, h, x, y, z, rx, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), wm(w, h)); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); m.receiveShadow = true; scene.add(m); };
    const D = 26, CZ = 9.4, bz = -3.6;
    const fl = new T.Mesh(new T.PlaneGeometry(9, D), M({ map: ft, roughness: .45, metalness: .5 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, CZ); fl.receiveShadow = true; scene.add(fl);
    plane(9, D, 0, 5, CZ, Math.PI / 2, 0); plane(D, 5, -4.5, 2.5, CZ, 0, Math.PI / 2); plane(D, 5, 4.5, 2.5, CZ, 0, -Math.PI / 2);
    plane(1.1, 5, -3.95, 2.5, bz); plane(5.3, 5, 1.85, 2.5, bz); plane(2.6, 1.7, -2.1, 4.15, bz); plane(2.6, .9, -2.1, .45, bz);
    const fm = M({ color: 0x222838, roughness: .4, metalness: .8 }), fb = (w, h, x, y) => mesh(new T.BoxGeometry(w, h, .22), fm, x, y, bz - .02, scene);
    fb(2.8, .12, -2.1, 3.3); fb(2.8, .12, -2.1, .9); fb(.12, 2.52, -3.4, 2.1); fb(.12, 2.52, -.8, 2.1);
    const g = new T.BufferGeometry(), n = 1200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = Math.random() * 6.283, ph = Math.acos(Math.random() * 2 - 1); pos[i * 3] = 160 * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = 160 * Math.cos(ph); pos[i * 3 + 2] = 160 * Math.sin(ph) * Math.sin(th); }
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); scene.add(new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
    const eg = new T.Group(); eg.add(new T.Mesh(new T.SphereGeometry(12, 56, 40), new T.MeshStandardMaterial({ map: K.earthTexture(), roughness: .9, emissive: 0x0a2a60, emissiveIntensity: .35 })), new T.Mesh(new T.SphereGeometry(12.5, 40, 28), new T.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: .28, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false })));
    eg.position.set(-14, -9, -40); scene.add(eg); api._earth = eg;
    [-2, 2].forEach(x => mesh(new T.BoxGeometry(.5, .06, 14), new T.MeshBasicMaterial({ color: 0xffffff }), x, 4.94, 2, scene));
    // summary panel (back wall, right)
    mesh(new T.BoxGeometry(3.9, 2.45, .14), M({ color: 0x151a28, roughness: .4, metalness: .8 }), 2.45, 2.65, bz + .05, scene);
    const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 640; pg = pc.getContext('2d'); ptex = new T.CanvasTexture(pc); ptex.encoding = T.sRGBEncoding; ptex.anisotropy = 4;
    const sc = new T.Mesh(new T.PlaneGeometry(3.6, 2.25), new T.MeshBasicMaterial({ map: ptex, toneMapped: false })); sc.position.set(2.45, 2.65, bz + .13); scene.add(sc);
    mesh(new T.BoxGeometry(3.9, .9, .6), M({ color: 0x2a3042, roughness: .5, metalness: .6 }), 2.45, .45, bz + .45, scene);
    // cabin oxygen meter (left wall strip), synced with the "O2" of the header
    const og = new T.Group(); og.position.set(-3.95, 2.3, bz + .06); scene.add(og);
    mesh(new T.CylinderGeometry(.42, .42, .06, 48), M({ color: 0x151a28, roughness: .4, metalness: .8 }), 0, 0, 0, og).rotation.x = Math.PI / 2;
    const oc = document.createElement('canvas'); oc.width = 256; oc.height = 256; o2g = oc.getContext('2d'); o2tex = new T.CanvasTexture(oc); o2tex.encoding = T.sRGBEncoding;
    const of = new T.Mesh(new T.CircleGeometry(.38, 48), new T.MeshBasicMaterial({ map: o2tex, toneMapped: false })); of.position.z = .035; og.add(of);
    // blood analyzer on a small bench next to the scan platform
    const bn = new T.Group(); bn.position.set(1.7, 0, .1); scene.add(bn);
    mesh(new T.BoxGeometry(.8, .9, .5), M({ color: 0x38445f, roughness: .55, metalness: .5 }), 0, .45, 0, bn); mesh(new T.BoxGeometry(.86, .05, .56), M({ color: 0xd9dfeb, roughness: .2, metalness: .3 }), 0, .925, 0, bn);
    mesh(new T.BoxGeometry(.6, .34, .42), M({ color: 0xe9edf5, roughness: .35, metalness: .15 }), 0, 1.12, 0, bn);
    const ac = document.createElement('canvas'); ac.width = 256; ac.height = 160; const actx = ac.getContext('2d'); anaTex = new T.CanvasTexture(ac); anaTex.encoding = T.sRGBEncoding; anaTex.userData = { ctx: actx };
    const as = new T.Mesh(new T.PlaneGeometry(.4, .2), new T.MeshBasicMaterial({ map: anaTex, toneMapped: false })); as.position.set(0, 1.14, .216); bn.add(as);
    const port = mesh(new T.CylinderGeometry(.03, .03, .05, 12), M({ color: 0xc9d0dc, metalness: .9, roughness: .3 }), -.2, 1.31, 0, bn); api._port = bn.localToWorld(V(-.2, 1.36, 0));
    mesh(new T.BoxGeometry(.3, .02, .2), M({ color: 0x4cc9f0 }), 0, 1.3, 0, bn).visible = false;
  }

  /* ---------- scan platform ---------- */
  function platform() {
    rigG = new T.Group(); scene.add(rigG);
    mesh(new T.CylinderGeometry(.85, .92, .07, 56), M({ color: 0x1b2030, roughness: .4, metalness: .8 }), 0, .035, 0, rigG);
    platRing = new T.Mesh(new T.TorusGeometry(.8, .022, 10, 72), new T.MeshStandardMaterial({ color: 0x001a14, emissive: 0x2ee6a6, emissiveIntensity: 1.6 })); platRing.rotation.x = Math.PI / 2; platRing.position.y = .075; rigG.add(platRing);
    const disc = new T.Mesh(new T.CircleGeometry(.78, 56), new T.MeshBasicMaterial({ color: 0x2ee6a6, transparent: true, opacity: .12, blending: T.AdditiveBlending, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = .076; rigG.add(disc); platRing.userData.disc = disc;
    cone = new T.Mesh(new T.CylinderGeometry(.62, .78, 2.5, 48, 1, true), new T.MeshBasicMaterial({ color: 0x2ee6a6, transparent: true, opacity: .07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); cone.position.y = 1.32; rigG.add(cone);
    scanRing = new T.Mesh(new T.TorusGeometry(.7, .014, 8, 64), new T.MeshBasicMaterial({ color: 0x9fffe4, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false })); scanRing.rotation.x = Math.PI / 2; rigG.add(scanRing);
    const s = new T.Mesh(new T.CircleGeometry(.68, 48), new T.MeshBasicMaterial({ color: 0x9fffe4, transparent: true, opacity: .12, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); s.rotation.x = -Math.PI / 2; scanRing.add(s);
  }

  /* ---------- markers ---------- */
  const spriteCache = {};
  function labelTex(text, col) {
    return ctex(512, 96, (c, w, h) => { c.fillStyle = 'rgba(6,14,30,.82)'; c.beginPath(); c.roundRect ? c.roundRect(4, 8, w - 8, h - 16, 22) : c.rect(4, 8, w - 8, h - 16); c.fill(); c.strokeStyle = col; c.lineWidth = 4; c.stroke(); c.fillStyle = '#fff'; c.font = 'bold 36px "Segoe UI",Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 2); });
  }
  function makeMarker(key, parent, pos, o) {
    const g = new T.Group(); g.position.copy(pos); parent.add(g);
    const core = new T.Mesh(new T.SphereGeometry(.035, 16, 12), new T.MeshBasicMaterial({ color: GREY })); g.add(core);
    const halo = new T.Mesh(new T.SphereGeometry(.07, 16, 12), new T.MeshBasicMaterial({ color: GREY, transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false })); g.add(halo);
    const ring = new T.Mesh(new T.TorusGeometry(.09, .006, 8, 32), new T.MeshBasicMaterial({ color: GREY, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false })); g.add(ring);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: labelTex('—', '#6f7c99'), transparent: true, depthTest: false })); sp.scale.set(.62, .116, 1); sp.position.set(o.lx || .32, o.ly || .12, 0); sp.renderOrder = 10; g.add(sp);
    const h = new T.Mesh(new T.SphereGeometry(.2, 10, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); h.userData = { key }; g.add(h); hits.push(h);
    markers[key] = { g, core, halo, ring, sp, last: '' };
  }
  function setMarker(key, lv, text, pulse, t) {
    const m = markers[key], col = lv == null || lv < 0 ? GREY : COL[lv], hex = '#' + col.toString(16).padStart(6, '0');
    m.core.material.color.setHex(col); m.halo.material.color.setHex(col); m.ring.material.color.setHex(col);
    const k = text + hex; if (m.last !== k) { m.last = k; m.sp.material.map = labelTex(text, hex); m.sp.material.needsUpdate = true; }
    const s = 1 + pulse * .6 + (focusKey === key ? .25 + .1 * Math.sin(t * 6) : 0); m.halo.scale.setScalar(s * 1.2); m.ring.scale.setScalar(1 + (t * .8 % 1) * .8); m.ring.material.opacity = (1 - (t * .8 % 1)) * .9;
    m.g.visible = appear > .02; m.g.scale.setScalar(clamp(appear, 0, 1));
  }

  /* ---------- panels ---------- */
  function drawPanel(d) {
    const g = pg, w = 1024, h = 640, gl = d.g == null ? -1 : d.g, col = gl < 0 ? '#7f8fb0' : ['#2ee6a6', '#ffd23f', '#ff4d5e'][gl];
    g.fillStyle = '#04091a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(76,201,240,.10)'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#4cc9f0'; g.font = 'bold 32px "Segoe UI",Arial'; g.fillText('SPACEDOC · FULL CHECK-UP', 28, 48); g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText('Mission day ' + (d.day || ''), 28, 82);
    g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(680, 12, 316, 46, 23) : g.rect(680, 12, 316, 46); g.fill(); g.fillStyle = '#04091a'; g.font = 'bold 24px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(gl < 0 ? 'NO DATA' : ['STABLE', 'ATTENTION', 'EMERGENCY'][gl], 838, 44); g.textAlign = 'left';
    g.fillStyle = col; g.font = 'bold 190px "Segoe UI",Arial'; g.fillText(d.n == null ? '--' : String(d.n), 28, 270); const wv = g.measureText(d.n == null ? '--' : String(d.n)).width; g.fillStyle = '#9aa7c7'; g.font = '34px "Segoe UI",Arial'; g.fillText('/ 10 health', 40 + wv, 270);
    const rows = [['hr', '💓 Heart rate', d.hr == null ? '—' : d.hr + ' bpm' + (d.arr ? ' · irregular' : ''), d.lv && d.lv.hr], ['bp', '❤️ Pressure', d.sys == null ? '—' : d.sys + '/' + d.dia + ' mmHg', d.lv && d.lv.bp], ['blood', '🩸 Blood', d.glu == null ? '—' : d.glu + ' mg/dL · O₂ ' + d.spo2 + '%', d.lv && d.lv.glu], ['mind', '🧠 Mind', d.sleep == null ? '—' : 'stress ' + d.stress + '/10 · sleep ' + d.sleep + ' h', d.lv && d.lv.quiz], ['chest', '😣 Chest', d.pain == null ? '—' : ['no chest pain', 'mild chest pain', 'strong chest pain'][d.pain], d.lv && d.lv.pain]];
    rows.forEach(([k, l, v, lv], i) => { const y = 330 + i * 56, c = lv == null ? '#5b6781' : ['#2ee6a6', '#ffd23f', '#ff4d5e'][lv]; g.fillStyle = focusKey === k ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)'; g.beginPath(); g.roundRect ? g.roundRect(28, y - 34, 968, 46, 12) : g.rect(28, y - 34, 968, 46); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(54, y - 11, 10, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '26px "Segoe UI",Arial'; g.fillText(l, 78, y); g.fillStyle = c; g.font = 'bold 26px "Segoe UI",Arial'; g.textAlign = 'right'; g.fillText(v, 980, y); g.textAlign = 'left'; });
    g.fillStyle = '#9aa7c7'; g.font = '20px "Segoe UI",Arial'; g.fillText('Tap a glowing point on the astronaut to zoom in', 28, 626); ptex.needsUpdate = true;
    // oxygen gauge
    const o = o2g, v = Math.max(0, Math.round(d.o2 == null ? 100 : d.o2)), oc = v > 55 ? '#4cc9f0' : v > 25 ? '#ffd23f' : '#ff4d5e';
    o.fillStyle = '#04101e'; o.fillRect(0, 0, 256, 256); o.lineWidth = 22; o.lineCap = 'round'; o.strokeStyle = '#16203a'; o.beginPath(); o.arc(128, 140, 86, Math.PI * .8, Math.PI * 2.2); o.stroke(); o.strokeStyle = oc; o.beginPath(); o.arc(128, 140, 86, Math.PI * .8, Math.PI * (.8 + 1.4 * v / 100)); o.stroke();
    o.fillStyle = '#fff'; o.font = 'bold 54px Arial'; o.textAlign = 'center'; o.fillText(v + '%', 128, 152); o.fillStyle = '#9aa7c7'; o.font = '22px Arial'; o.fillText('CABIN O₂', 128, 186); o.fillText('SHIP AIR', 128, 40); o.textAlign = 'left'; o2tex.needsUpdate = true;
    // analyzer screen
    const a = anaTex.userData.ctx; a.fillStyle = '#04101e'; a.fillRect(0, 0, 256, 160); a.fillStyle = '#4cc9f0'; a.font = 'bold 20px Arial'; a.fillText('MICROFLOW', 10, 24); a.fillStyle = '#fff'; a.font = 'bold 44px Arial'; a.fillText(d.glu == null ? '--' : d.glu, 10, 80); a.fillStyle = '#9aa7c7'; a.font = '18px Arial'; a.fillText('mg/dL', 110, 80); a.fillStyle = '#4cc9f0'; a.font = 'bold 40px Arial'; a.fillText(d.spo2 == null ? '--' : d.spo2 + ' %', 10, 130); a.fillStyle = '#9aa7c7'; a.font = '18px Arial'; a.fillText('O₂', 130, 130); anaTex.needsUpdate = true;
  }

  /* ---------- controls ---------- */
  api.focus = function (k) { focusKey = (k === focusKey) ? null : (k || null); return focusKey; };
  api.setScanning = function (b) { scanning = !!b; };
  api.reset = function () { focusKey = null; adv = null; appear = 0; if (api.ready) { rigG.scale.set(1, 1, 1); rigG.visible = true; rigG.position.y = 0; body.position.z = 0; curPos = null; } };
  api.advance = function (cb) { if (adv) return; adv = { t: 0, cb }; focusKey = null; };

  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - (last || now)) / 1000); last = now; const d = getData() || {}, lv = d.lv || {}, g = d.g == null ? -1 : d.g;
    appear += ((scanning ? 0 : 1) - appear) * Math.min(1, dt * 2.5);
    const sCol = g < 0 ? GREY : COL[g];
    // status colours: platform, hologram cone, cabin light
    platRing.material.emissive.setHex(sCol); platRing.userData.disc.material.color.setHex(sCol); cone.material.color.setHex(sCol); cone.material.opacity = scanning ? .13 : .07;
    statusL.color.setHex(g < 0 ? 0x6f8bff : sCol); statusL.intensity = g === 2 ? 1.1 + .9 * Math.sin(t * 5) : g === 1 ? 1.0 : .9;
    // scan ring sweeps the astronaut while scanning, then rests at the platform
    const sy = scanning ? .1 + (Math.sin(t * 2.2) * .5 + .5) * 2.2 : .1; scanRing.position.y += (sy - scanRing.position.y) * Math.min(1, dt * 8); scanRing.material.opacity = scanning ? .9 : .25;
    // reactions
    const pain = d.pain || 0, tired = (d.sleep != null && d.sleep < 6) || (d.stress != null && d.stress >= 7), stable = g === 0 && (d.n == null || d.n >= 8);
    let ax = .0, lean = 0; const walk = adv ? adv.t : 0;
    A.shL.rotation.set(Math.sin(t * .9) * .05, 0, -.14); A.elL.rotation.set(-.15, 0, 0); A.shR.rotation.set(Math.sin(t * .9 + 1) * .05, 0, .14); A.elR.rotation.set(-.15, 0, 0);
    A.hipL.rotation.set(0, 0, -.04); A.hipR.rotation.set(0, 0, .04); A.kneeL.rotation.x = 0; A.kneeR.rotation.x = 0;
    if (pain > 0) { A.shL.rotation.set(-.45, 0, .55); A.elL.rotation.set(-1.95, 0, 0); lean = .1; }
    else if (tired) { lean = .14 + Math.sin(t * .8) * .02; A.shL.rotation.set(.1, 0, -.1); A.shR.rotation.set(.1, 0, .1); }
    else if (stable) { A.shR.rotation.set(-1.15 + Math.sin(t * 3) * .05, 0, .35); A.elR.rotation.set(-1.35, 0, 0); }
    if (g === 2 && pain === 0) lean = .12;
    if (adv) { adv.t += dt; const u = adv.t; const ringK = clamp(u / .9, 0, 1); rigG.scale.set(1 - ringK * .98 + .02, 1 - ringK * .9 + .1, 1 - ringK * .98 + .02); rigG.visible = ringK < .99; platRing.parent.position.y = -ringK * .08; if (u > .6) { const w = clamp((u - .6) / 1.6, 0, 1); body.position.z = ease(w) * 3.2; const s = Math.sin(w * Math.PI * 7) * .5; A.hipL.rotation.x = s; A.hipR.rotation.x = -s; A.kneeL.rotation.x = Math.max(0, -s) * .8; A.kneeR.rotation.x = Math.max(0, s) * .8; A.shL.rotation.x = -s * .6; A.shR.rotation.x = s * .6; A.shL.rotation.z = -.14; A.shR.rotation.z = .14; if (u > 2.4 && adv.cb) { const cb = adv.cb; adv.cb = null; cb(); } } }
    body.position.y = 1.16 + Math.sin(t * 1.2) * .004; body.rotation.set(lean + Math.sin(t * .7) * .015, 0, 0);
    // markers (values from the real mission)
    const hr = d.hr || 72, pulse = Math.pow(Math.max(0, Math.sin(t * Math.PI * hr / 60)), 6);
    setMarker('hr', d.hr == null ? -1 : lv.hr, d.hr == null ? 'Heart rate —' : '💓 ' + d.hr + ' bpm' + (d.arr ? ' · irregular' : ''), d.hr == null ? 0 : pulse, t);
    setMarker('bp', d.sys == null ? -1 : lv.bp, d.sys == null ? 'Pressure —' : '❤️ ' + d.sys + '/' + d.dia + ' mmHg', 0, t);
    setMarker('blood', d.glu == null ? -1 : lv.glu, d.glu == null ? 'Blood —' : '🩸 ' + d.glu + ' mg/dL · O₂ ' + d.spo2 + '%', 0, t);
    setMarker('mind', d.sleep == null ? -1 : lv.quiz, d.sleep == null ? 'Mind —' : '🧠 stress ' + d.stress + '/10 · sleep ' + d.sleep + ' h', 0, t);
    setMarker('chest', d.pain == null ? -1 : lv.pain, d.pain == null ? 'Chest —' : (pain === 0 ? '✔ no chest pain' : pain === 1 ? '⚠ mild chest pain' : '🚨 strong chest pain'), 0, t);
    // head aura (mind) + thorax contour (chest)
    const mc = d.sleep == null ? GREY : COL[lv.quiz || 0], cc = d.pain == null ? GREY : COL[lv.pain || 0]; markers.mind.aura.material.color.setHex(mc); markers.mind.aura.material.opacity = (.12 + .06 * Math.sin(t * 1.6)) * appear; markers.mind.aura.scale.setScalar(1 + .04 * Math.sin(t * 1.6));
    markers.chest.contour.forEach((c, i) => { c.material.color.setHex(cc); c.material.opacity = (.55 + .3 * Math.sin(t * 2 + i)) * appear; });
    // wrist sensor band + glowing data line to the blood analyzer
    const bc = d.glu == null ? GREY : COL[lv.glu || 0]; markers.blood.band.material.color.setHex(bc); markers.blood.band.visible = appear > .05;
    body.updateMatrixWorld(true); const ww = A.elL.localToWorld(V(0, -.37, 0)), port = api._port; const mid = ww.clone().lerp(port, .5).add(V(0, .5, .6)); wireCurve = new T.CatmullRomCurve3([ww, mid, port.clone().add(V(-.05, .2, 0)), port]);
    if (wireMesh) { scene.remove(wireMesh); wireMesh.geometry.dispose(); } wireMesh = new T.Mesh(new T.TubeGeometry(wireCurve, 24, .005, 5), new T.MeshBasicMaterial({ color: bc, transparent: true, opacity: .55 * appear, blending: T.AdditiveBlending, depthWrite: false })); scene.add(wireMesh);
    beads.forEach((b, i) => { const s = ((t * .45 - i * .09) % 1 + 1) % 1; b.position.copy(wireCurve.getPoint(s)); b.material.color.setHex(bc); b.visible = appear > .3 && d.glu != null; });
    if (now - lastDraw > 120) { lastDraw = now; drawPanel(d); }
    // camera: overview, or fly closer to the chosen region
    let wp = V(Math.sin(t * .2) * .25 + .8 + drag.yaw * .6, camBase.y + Math.sin(t * .27) * .04, camBase.z), wl = V(0, 1.2, .3);
    if (focusKey && markers[focusKey]) { const tg = markers[focusKey].g.getWorldPosition(V(0, 0, 0)); wl = tg.clone(); wp = tg.clone().add(V(.7, .18, 2.1)); }
    if (!curPos) { curPos = wp.clone(); curLook = wl.clone(); } curPos.lerp(wp, .06); curLook.lerp(wl, .06); cam.position.copy(curPos); cam.lookAt(curLook);
    api._earth.rotation.y = t * .01; R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 3.4, needW = clamp(a * 3.6, 3.4, 6.4);
    camBase.z = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)) + .2; cam.updateProjectionMatrix();
  }

  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; getData = opts.getData || getData; onPick = opts.onPick || onPick;
    try {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
      stage.insertBefore(canvas, stage.firstChild);
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02040c); cam = new T.PerspectiveCamera(38, 1, .1, 400); cam.position.set(.8, camBase.y, camBase.z);
      const envS = new T.Scene(); envS.background = new T.Color(0x0a1226);
      [[6, 3, 0, 6, 0, 0xffffff, 6], [4, 4, -7, 2, 2, 0xcfe6ff, 4], [4, 2, 6, 1, -4, 0xffd9a0, 3], [8, 3, 0, -6, 0, 0x4cc9f0, 1.2], [5, 5, 0, 2, -8, 0x2b6fd6, 1.5]].forEach(([w, h, x, y, z, c, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); });
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(envS, .02).texture; pm.dispose();
      scene.add(new T.HemisphereLight(0xbfd8ff, 0x2a2f44, .55));
      const key = new T.DirectionalLight(0xfff2e0, 1.5); key.position.set(2.5, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const s = key.shadow.camera; s.left = -3; s.right = 3; s.top = 3.5; s.bottom = -2; s.near = 1; s.far = 20; key.shadow.bias = -.0004; key.target.position.set(0, 1, 0); scene.add(key, key.target);
      const rim = new T.DirectionalLight(0x9fd0ff, .9); rim.position.set(-6, 3, -8); scene.add(rim);
      statusL = new T.PointLight(0x2ee6a6, .9, 9); statusL.position.set(0, 3.2, 1.2); scene.add(statusL);
      room(); platform();
      A = B.makeAstronaut(scene); body = A.body; body.position.set(0, 1.16, 0);
      // markers attached to the 3D body
      makeMarker('hr', body, V(.17, .5, .3), { lx: .36, ly: .1 }); makeMarker('bp', A.shR, V(.12, -.25, .06), { lx: .38, ly: .06 }); makeMarker('blood', A.elL, V(-.1, -.37, .06), { lx: -.38, ly: .1 });
      makeMarker('mind', body, V(0, 1.2, .1), { lx: .0, ly: .26 }); makeMarker('chest', body, V(-.16, .36, .3), { lx: -.38, ly: -.02 });
      markers.mind.aura = new T.Mesh(new T.SphereGeometry(.4, 32, 24), new T.MeshBasicMaterial({ color: GREY, transparent: true, opacity: .15, blending: T.AdditiveBlending, depthWrite: false, side: T.BackSide })); markers.mind.aura.position.set(0, .89, 0); body.add(markers.mind.aura);
      markers.chest.contour = [0, 1, 2].map(i => { const c = new T.Mesh(new T.TorusGeometry(.31 - i * .02, .006, 6, 40), new T.MeshBasicMaterial({ color: GREY, transparent: true, opacity: .6, blending: T.AdditiveBlending, depthWrite: false })); c.rotation.x = Math.PI / 2; c.scale.set(1, .8, 1); c.position.set(0, .22 + i * .12, 0); body.add(c); return c; });
      markers.blood.band = new T.Mesh(new T.TorusGeometry(.09, .016, 8, 28), new T.MeshBasicMaterial({ color: GREY, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false })); markers.blood.band.rotation.x = Math.PI / 2; markers.blood.band.position.set(0, -.37, 0); A.elL.add(markers.blood.band);
      for (let i = 0; i < 10; i++) { const b = new T.Mesh(new T.SphereGeometry(.014, 8, 6), new T.MeshBasicMaterial({ color: GREY, blending: T.AdditiveBlending, transparent: true, depthWrite: false })); b.visible = false; scene.add(b); beads.push(b); }
      // interaction
      const ray = new T.Raycaster(), mv = new T.Vector2(); let downX = 0, moved = 0;
      const pick = e => { const r = canvas.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); const hs = ray.intersectObjects(hits, false); return hs.length ? hs[0].object.userData.key : null; };
      canvas.addEventListener('pointerdown', e => { drag.down = true; drag.x = downX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag.down) { canvas.style.cursor = pick(e) ? 'pointer' : 'grab'; return; } moved = Math.max(moved, Math.abs(e.clientX - downX)); canvas.style.cursor = 'grabbing'; drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .008, -1.3, 1.3); drag.x = e.clientX; });
      canvas.addEventListener('pointerup', e => { const was = drag.down; drag.down = false; canvas.style.cursor = 'grab'; if (was && moved < 6) { const k = pick(e); if (k) { const f = api.focus(k); onPick(k, f); } else if (focusKey) { api.focus(null); onPick(null, null); } } });
      canvas.addEventListener('pointercancel', () => { drag.down = false; });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D check-up summary unavailable, using the 2D scan instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false; }
  };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
})();
