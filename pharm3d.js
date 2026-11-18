/* Phase 5 · Emergency pharmacy in 3D (Three.js r149): the astronaut lies strapped to a floor-mounted stretcher with the LUCAS 3 compressor on the chest;
   a medicine tray holds the red and blue pills, the AI agenda is on a clipboard; tap a pill and the astronaut opens the helmet and takes it.
   Needs cabin3d.js + bike3d.js.
   API: Pharm3d.init(stage,{getData,isCorrect,commit,onLucas}) · setLucas(on) · telemetry() · reset() · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D, B = window.Bike3D;
  const api = { ready: false, failed: false };
  window.Pharm3d = api;
  if (!T || !C || !C.kit || !B || !B.makeAstronaut) { api.failed = true; return; }
  const K = C.kit, M = K.M, ctex = K.ctex, clamp = K.clamp, mesh = K.mesh;
  const V = (x, y, z) => new T.Vector3(x, y, z), lerp = (a, b, p) => a + (b - a) * p, ease = p => p * p * (3 - 2 * p);

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, getData = () => ({}), isCorrect = () => false, commit = () => null, onLucas = () => {};
  let t0 = performance.now(), last = 0, lastPanel = 0, pg, ptex, lamp, ag, agTex, drag = { yaw: 0, down: false, x: 0 }, camBase = { y: 2.6, z: 7 };
  let A, body, face, mouth, bubble, skinMat, pills = {}, pillHome = {}, lucasG, pad, rod, lucasOn = false, lucasT = 0, hits = [], dish, tel = null, telBeads = [], telCurve, glowS, act = null, mouthW = V(0, 0, 0), spark;
  const trays = {};

  /* ---------- room (navy cabin, Earth window) ---------- */
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
    // red emergency strobe on the ceiling
    glowS = new T.PointLight(0xff2040, 0, 9); glowS.position.set(0, 4.4, 0); scene.add(glowS);
    // emergency panel
    mesh(new T.BoxGeometry(3.9, 2.45, .14), M({ color: 0x151a28, roughness: .4, metalness: .8 }), 2.45, 2.65, bz + .05, scene);
    const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 640; pg = pc.getContext('2d'); ptex = new T.CanvasTexture(pc); ptex.encoding = T.sRGBEncoding; ptex.anisotropy = 4;
    const sc = new T.Mesh(new T.PlaneGeometry(3.6, 2.25), new T.MeshBasicMaterial({ map: ptex, toneMapped: false })); sc.position.set(2.45, 2.65, bz + .13); scene.add(sc);
    lamp = new T.Mesh(new T.BoxGeometry(3.6, .08, .06), new T.MeshBasicMaterial({ color: 0xff4d5e })); lamp.position.set(2.45, 3.92, bz + .12); scene.add(lamp);
    mesh(new T.BoxGeometry(3.9, .9, .6), M({ color: 0x2a3042, roughness: .5, metalness: .6 }), 2.45, .45, bz + .45, scene);
    // locked pharmacy cabinet (left wall strip): the AI unlocks the right medicine
    const cab = new T.Group(); cab.position.set(-3.95, 2.0, bz + .12); scene.add(cab);
    mesh(new T.BoxGeometry(.95, 1.6, .22), M({ color: 0xe9edf5, roughness: .35, metalness: .2 }), 0, 0, 0, cab);
    mesh(new T.BoxGeometry(.18, .05, .01), M({ color: 0xff4d5e }), 0, .65, .115, cab); mesh(new T.BoxGeometry(.05, .18, .01), M({ color: 0xff4d5e }), 0, .65, .115, cab);
    for (let i = 0; i < 4; i++) { mesh(new T.BoxGeometry(.8, .24, .02), M({ color: 0xc9d0dc, metalness: .6, roughness: .3 }), 0, .28 - i * .3, .12, cab); mesh(new T.SphereGeometry(.025, 10, 8), new T.MeshStandardMaterial({ color: 0x111, emissive: i === 1 ? 0x2ee6a6 : 0xff4d5e, emissiveIntensity: 1 }), .32, .28 - i * .3, .14, cab); }
    const lbl = new T.Mesh(new T.PlaneGeometry(.8, .1), new T.MeshBasicMaterial({ map: ctex(256, 32, (c, w, h) => { c.fillStyle = '#04101e'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff7a8a'; c.font = 'bold 22px Arial'; c.textAlign = 'center'; c.fillText('PHARMACY · SEALED', w / 2, 24); }), toneMapped: false })); lbl.position.set(0, .8, .12); cab.add(lbl);
    const cl = mesh(new T.BoxGeometry(1, 1.7, .5), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 0, 0, 0, cab); cl.userData = { name: 'cabinet' }; hits.push(cl);
  }

  /* ---------- stretcher, astronaut, face, LUCAS 3 ---------- */
  function stretcher() {
    const alu = M({ color: 0xd7dce8, metalness: .9, roughness: .26 }), steel = M({ color: 0x8d96a8, metalness: .95, roughness: .35 }), orange = M({ color: 0xff7a1a, roughness: .55 });
    const pad = M({ color: 0x2f5fa8, roughness: .8 }), padDark = M({ color: 0x1c3a6e, roughness: .85 });
    const g = new T.Group(); g.position.set(-.1, 0, .25); scene.add(g); const L = 2.5;
    const tube = (a, b, r, mt) => { const p = V(...a), q = V(...b), d = q.clone().sub(p), m = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 16), mt); m.position.copy(p).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); m.castShadow = m.receiveShadow = true; g.add(m); };
    mesh(new T.BoxGeometry(L, .1, .86), alu, 0, .86, 0, g); mesh(new T.BoxGeometry(L - .06, .09, .76), pad, 0, .945, 0, g); mesh(new T.BoxGeometry(.5, .11, .6), padDark, -L / 2 + .45, 1.0, 0, g);
    [-.4, .4].forEach(z => tube([-L / 2, .93, z], [L / 2, .93, z], .02, steel));
    [[-L / 2 + .25, -.34], [-L / 2 + .25, .34], [L / 2 - .25, -.34], [L / 2 - .25, .34]].forEach(([x, z]) => { tube([x, .06, z], [x, .86, z], .035, steel); mesh(new T.CylinderGeometry(.11, .11, .03, 24), steel, x, .015, z, g); mesh(new T.CylinderGeometry(.12, .12, .01, 24), M({ color: 0xffd23f, roughness: .6 }), x, .006, z, g); });
    tube([-L / 2 + .25, .35, 0], [L / 2 - .25, .35, 0], .02, steel);
    const strap = (x, r) => { mesh(new T.BoxGeometry(.11, .014, .86), orange, x, r, 0, g); [-.43, .43].forEach(z => mesh(new T.BoxGeometry(.11, r - .9, .014), orange, x, (r + .9) / 2, z, g)); };
    strap(.2, 1.39); strap(.7, 1.36); strap(1.1, 1.33);
    return g;
  }
  function makeFace() {
    face = new T.Group(); face.visible = false; body.add(face);
    skinMat = new T.MeshStandardMaterial({ color: 0xd9a583, roughness: .65, emissive: 0x000000 });
    const head = mesh(new T.SphereGeometry(.205, 28, 20), skinMat, 0, .89, 0, face); head.scale.set(1, 1.08, .95);
    mesh(new T.SphereGeometry(.21, 24, 14, 0, Math.PI * 2, 0, Math.PI * .45), M({ color: 0x2a1a10, roughness: .8 }), 0, .9, -.015, face);                 // hair
    [-.07, .07].forEach(x => { mesh(new T.SphereGeometry(.022, 10, 8), M({ color: 0x15171d }), x, .93, .185, face); mesh(new T.BoxGeometry(.06, .012, .01), M({ color: 0x2a1a10 }), x, .968, .19, face); });
    mouth = mesh(new T.SphereGeometry(.03, 12, 8), M({ color: 0x5a1a1a, roughness: .5 }), 0, .83, .195, face); mouth.scale.set(1.5, .45, .5);
    bubble = new T.Mesh(new T.SphereGeometry(.3, 32, 24), new T.MeshStandardMaterial({ color: 0xdff1ff, transparent: true, opacity: .14, roughness: .05, metalness: .2, depthWrite: false })); bubble.position.y = .89; bubble.visible = false; body.add(bubble);
  }
  function helmet(open) { A.shell.visible = !open; A.visor.visible = !open; face.visible = open; bubble.visible = open; }
  function buildLucas(chest) {
    lucasG = new T.Group(); scene.add(lucasG);
    const white = M({ color: 0xf1f3f8, roughness: .35, metalness: .3 }), red = M({ color: 0xe5303f, roughness: .4 }), steel = M({ color: 0xaab2c4, metalness: .9, roughness: .3 }), dark = M({ color: 0x20242f, roughness: .5, metalness: .5 });
    const zs = [chest.z - .42, chest.z + .42], top = 1.95;
    zs.forEach(z => { mesh(new T.BoxGeometry(.07, top - .93, .07), white, chest.x, (top + .93) / 2, z, lucasG); mesh(new T.BoxGeometry(.16, .05, .16), steel, chest.x, .96, z, lucasG); });
    mesh(new T.BoxGeometry(.12, .1, .98), white, chest.x, top, chest.z, lucasG);
    const head = mesh(new T.BoxGeometry(.34, .2, .26), white, chest.x, top + .05, chest.z, lucasG); mesh(new T.BoxGeometry(.3, .05, .22), red, chest.x, top + .17, chest.z, lucasG);
    const dis = new T.Mesh(new T.PlaneGeometry(.22, .09), new T.MeshBasicMaterial({ map: ctex(256, 104, (c, w, h) => { c.fillStyle = '#04101e'; c.fillRect(0, 0, w, h); c.fillStyle = '#2ee6a6'; c.font = 'bold 30px Arial'; c.fillText('LUCAS 3', 12, 40); c.fillStyle = '#fff'; c.font = '24px Arial'; c.fillText('102/min · 5 cm', 12, 82); }), toneMapped: false })); dis.position.set(chest.x + .1, top + .05, chest.z + .131 + 0); dis.rotation.y = 0; lucasG.add(dis); dis.rotation.y = Math.PI / 2; dis.position.set(chest.x + .171, top + .05, chest.z);
    const rg = new T.CylinderGeometry(.03, .03, 1, 16); rg.translate(0, -.5, 0); rod = new T.Mesh(rg, steel); rod.position.set(chest.x, top - .06, chest.z); rod.castShadow = true; lucasG.add(rod);
    pad = new T.Group(); pad.position.set(chest.x, 1.6, chest.z); lucasG.add(pad); mesh(new T.CylinderGeometry(.085, .1, .05, 28), red, 0, 0, 0, pad); mesh(new T.CylinderGeometry(.1, .1, .012, 28), dark, 0, -.03, 0, pad);
    const h = new T.Mesh(new T.BoxGeometry(.5, .35, 1.1), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); h.position.set(chest.x, 1.7, chest.z); h.userData = { name: 'lucas' }; lucasG.add(h); hits.push(h);
  }

  /* ---------- medicine tray, pills, agenda clipboard, antenna dish ---------- */
  function pillMesh(col) {
    const g = new T.Group(), c = M({ color: col, roughness: .3, metalness: .1 }), w = M({ color: 0xf6f6f6, roughness: .3 });
    const half = (m, s) => { mesh(new T.CylinderGeometry(.05, .05, .075, 20), m, s * .0375, 0, 0, g).rotation.z = Math.PI / 2; mesh(new T.SphereGeometry(.05, 20, 14), m, s * .075, 0, 0, g); };
    half(c, 1); half(w, -1); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
  }
  function tray() {
    const tb = new T.Group(); tb.position.set(1.55, 0, 1.0); scene.add(tb);
    const steel = M({ color: 0x8d96a8, metalness: .9, roughness: .3 });
    mesh(new T.CylinderGeometry(.04, .04, .9, 14), steel, 0, .45, 0, tb); mesh(new T.CylinderGeometry(.26, .3, .04, 32), steel, 0, .02, 0, tb);
    mesh(new T.BoxGeometry(1.1, .04, .7), M({ color: 0xe9edf5, roughness: .3, metalness: .3 }), 0, .92, 0, tb);
    mesh(new T.BoxGeometry(.5, .03, .3), M({ color: 0x1b2030, roughness: .8 }), -.15, .95, .1, tb);
    [['red', 0xff3b4a, -.3], ['blue', 0x2b7cff, -.0]].forEach(([k, col, x]) => {
      const dish = mesh(new T.CylinderGeometry(.13, .1, .03, 28), M({ color: 0xdfe6f2, roughness: .3 }), x - .05, .97, .1, tb); const p = pillMesh(col); p.position.set(tb.position.x + x - .05, .97 + .06, tb.position.z + .1); p.rotation.y = .5; scene.add(p);
      const h = new T.Mesh(new T.SphereGeometry(.17, 12, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); h.position.copy(p.position); h.userData = { name: 'pill', color: k }; scene.add(h); hits.push(h);
      pills[k] = p; pillHome[k] = p.position.clone();
    });
    // agenda clipboard
    const cb = new T.Group(); cb.position.set(tb.position.x + .36, .98 + .13, tb.position.z + .12); cb.rotation.set(-.9, -.2, 0); scene.add(cb);
    mesh(new T.BoxGeometry(.36, .5, .02), M({ color: 0x5a3b22, roughness: .7 }), 0, 0, 0, cb);
    const ac = document.createElement('canvas'); ac.width = 256; ac.height = 360; ag = ac.getContext('2d'); agTex = new T.CanvasTexture(ac); agTex.encoding = T.sRGBEncoding; agTex.anisotropy = 4;
    const ap = new T.Mesh(new T.PlaneGeometry(.32, .45), new T.MeshBasicMaterial({ map: agTex, toneMapped: false })); ap.position.z = .012; cb.add(ap); mesh(new T.BoxGeometry(.12, .05, .03), steel, 0, .24, .02, cb);
  }
  function drawAgenda() {
    const c = ag, d = getData() || {}, col = d.correct || 'blue', other = col === 'blue' ? 'red' : 'blue', hex = { blue: '#1d4ed8', red: '#c1121f' };
    c.fillStyle = '#fff7d6'; c.fillRect(0, 0, 256, 360); c.fillStyle = '#2b2200'; c.font = 'bold 26px Arial'; c.fillText('📅 AGENDA', 14, 38); c.strokeStyle = '#b38f00'; c.lineWidth = 3; c.beginPath(); c.moveTo(14, 50); c.lineTo(242, 50); c.stroke();
    c.font = '20px Arial'; c.fillText('14:00 · Heart attack', 14, 86); c.fillText('protocol:', 14, 112); c.fillText('take the', 14, 150); c.fillStyle = hex[col]; c.font = 'bold 44px Arial'; c.fillText(col.toUpperCase(), 14, 200); c.fillStyle = '#2b2200'; c.font = '20px Arial'; c.fillText('pill.', 14, 232); c.fillText('NEVER the', 14, 280); c.fillStyle = hex[other]; c.font = 'bold 26px Arial'; c.fillText(other.toUpperCase() + ' one!', 14, 316); agTex.needsUpdate = true;
  }
  function antenna() {
    dish = new T.Group(); dish.position.set(-2.1, .97, -3.35); scene.add(dish);
    const st = M({ color: 0xd7dce8, metalness: .9, roughness: .3 }); mesh(new T.CylinderGeometry(.04, .06, .3, 12), st, 0, .15, 0, dish);
    const d = mesh(new T.SphereGeometry(.26, 28, 14, 0, Math.PI * 2, 0, Math.PI * .4), st, 0, .38, 0, dish); d.rotation.set(-.9, 0, .3); d.material.side = T.DoubleSide; mesh(new T.CylinderGeometry(.012, .012, .2, 8), st, 0, .45, .1, dish).rotation.x = -.6;
  }

  /* ---------- panel ---------- */
  function ecg(tt, bpm, arr, px) { const g = (p, m, s) => Math.exp(-((p - m) ** 2) / (2 * s * s)); if (arr) tt += .22 * Math.sin(tt * 2.3) + .15 * Math.sin(tt * 5.1); const p = ((tt * bpm / 60) % 1 + 1) % 1; return (arr ? .04 * Math.sin(px / 5 + tt * 9) : .1 * g(p, .12, .03)) - .12 * g(p, .205, .01) + g(p, .235, .012) - .25 * g(p, .265, .012) + .2 * g(p, .45, .04); }
  function drawPanel(t) {
    const g = pg, w = 1024, h = 640, d = getData() || {}, ok = !!d.ok, lucas = lucasOn, hr = d.hr || 100, lost = d.lives <= 0;
    const col = ok ? '#2ee6a6' : '#ff4d5e', word = ok ? 'RECOVERING' : lost ? 'CRITICAL' : 'CRITICAL · HEART ATTACK';
    g.fillStyle = '#04091a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,77,94,.10)'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#ff8a96'; g.font = 'bold 32px "Segoe UI",Arial'; g.fillText('🚨 EMERGENCY PROTOCOL', 28, 48);
    g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(600, 12, 396, 46, 23) : g.rect(600, 12, 396, 46); g.fill(); g.fillStyle = '#04091a'; g.font = 'bold 22px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(word, 798, 43); g.textAlign = 'left';
    // ECG
    const ex = 28, ey = 80, ew = 600, eh = 230; g.fillStyle = '#010509'; g.fillRect(ex, ey, ew, eh); g.strokeStyle = 'rgba(46,230,166,.12)'; for (let x = ex; x <= ex + ew; x += 30) { g.beginPath(); g.moveTo(x, ey); g.lineTo(x, ey + eh); g.stroke(); } for (let y = ey; y <= ey + eh; y += 30) { g.beginPath(); g.moveTo(ex, y); g.lineTo(ex + ew, y); g.stroke(); }
    g.strokeStyle = ok ? '#2ee6a6' : '#ff4d5e'; g.lineWidth = 3.5; g.shadowColor = g.strokeStyle; g.shadowBlur = 10; g.beginPath();
    for (let px = 0; px < ew; px += 3) { const tt = t - (ew - px) / ew * 3.6; let y = ecg(tt, ok ? 82 : hr, ok ? false : !!d.arr, px); if (lucas) y += .22 * Math.max(0, Math.sin(tt * Math.PI * 2 * 1.7)) * (ok ? 0 : 1); const yy = ey + eh * .66 - y * eh * .55; px ? g.lineTo(ex + px, yy) : g.moveTo(ex + px, yy); } g.stroke(); g.shadowBlur = 0;
    g.fillStyle = '#9aa7c7'; g.font = '20px "Segoe UI",Arial'; g.fillText(lucas ? 'ECG · LUCAS 3 compressions' : 'ECG · lead II', ex + 10, ey + eh - 10);
    const big = (l, v, u, x, y, c) => { g.fillStyle = '#9aa7c7'; g.font = '21px "Segoe UI",Arial'; g.fillText(l, x, y); g.fillStyle = c; g.font = 'bold 60px "Segoe UI",Arial'; g.fillText(v, x, y + 56); const wv = g.measureText(v).width; g.fillStyle = '#9aa7c7'; g.font = '21px "Segoe UI",Arial'; g.fillText(u, x + wv + 8, y + 56); };
    big('HEART RATE', String(Math.round(ok ? 82 : hr)), 'bpm', 660, 96, ok ? '#2ee6a6' : '#ff7a8a'); big('PRESSURE', (ok ? 124 : d.sys || 150) + '/' + (ok ? 80 : d.dia || 95), 'mmHg', 660, 196, ok ? '#2ee6a6' : '#ffd23f'); big('SpO₂', String(ok ? 98 : d.spo2 || 94), '%', 660, 296, '#4cc9f0');
    // lower info
    const box = (x, y, wd, title, line, c) => { g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.roundRect ? g.roundRect(x, y, wd, 108, 14) : g.rect(x, y, wd, 108); g.fill(); g.fillStyle = '#9aa7c7'; g.font = '20px "Segoe UI",Arial'; g.fillText(title, x + 14, y + 30); g.fillStyle = c; g.font = 'bold 30px "Segoe UI",Arial'; g.fillText(line, x + 14, y + 74); };
    box(28, 340, 300, 'LUCAS 3', lucas ? 'ON · 102 / min' : 'READY', lucas ? '#2ee6a6' : '#ffd23f'); box(344, 340, 300, 'LIVES', '❤️'.repeat(Math.max(0, d.lives || 0)) + '🖤'.repeat(Math.max(0, 2 - (d.lives || 0))), '#fff');
    box(660, 340, 336, 'TELEMETRY TO EARTH', d.tel === 'sent' ? 'SENT ✔' : d.tel === 'sending' ? 'SENDING…' : 'NOT SENT', d.tel === 'sent' ? '#2ee6a6' : '#ffd23f');
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(ok ? 'The medicine worked. The astronaut is stabilizing.' : 'Read the agenda on the clipboard, then tap the right pill.', 28, 500); g.fillText(d.tel === 'sent' ? 'Signal time: ' + (d.delay || '') : 'Earth reply delay: ' + (d.delay || ''), 28, 540);
    g.textAlign = 'right'; g.fillText('● LIVE', 996, 600); g.textAlign = 'left'; ptex.needsUpdate = true;
  }

  /* ---------- actions ---------- */
  api.setLucas = function (on) { lucasOn = !!on; };
  api.reset = function () { act = null; if (api.ready) { helmet(false); Object.keys(pills).forEach(k => { pills[k].visible = true; pills[k].position.copy(pillHome[k]); }); skinMat.emissive.setHex(0); } };
  api.telemetry = function () {
    if (!telCurve) { const s = dish.position.clone().add(V(0, .6, .1)); telCurve = new T.CatmullRomCurve3([s, V(-3, 3, -9), V(-8, 0, -24), V(-14, -9, -38)]); for (let i = 0; i < 14; i++) { const b = new T.Mesh(new T.SphereGeometry(.05, 8, 6), new T.MeshBasicMaterial({ color: 0x9fe8ff, blending: T.AdditiveBlending, transparent: true, depthWrite: false })); b.visible = false; scene.add(b); telBeads.push(b); } }
    tel = { t: 0 };
  };
  function startPick(color) {
    if (act || (getData() || {}).ok) return; const okc = isCorrect(color); act = { color, ok: okc, t: 0 }; helmet(true);
  }
  const bez = (a, b, c, p) => V(lerp(a.x, c.x, p) + (b.x - lerp(a.x, c.x, .5)) * 4 * p * (1 - p), lerp(a.y, c.y, p) + (b.y - lerp(a.y, c.y, .5)) * 4 * p * (1 - p), lerp(a.z, c.z, p) + (b.z - lerp(a.z, c.z, .5)) * 4 * p * (1 - p));
  function stepAct(dt) {
    if (!act) return; act.t += dt; const p = pills[act.color], home = pillHome[act.color]; body.updateMatrixWorld(true); mouth.getWorldPosition(mouthW);
    if (act.t < .6) { skinMat.emissive.setHex(0); }                                                    // helmet opens
    else if (act.t < 1.8) { const u = ease((act.t - .6) / 1.2), mid = home.clone().lerp(mouthW, .5).add(V(0, .45, 0)); p.position.copy(bez(home, mid, mouthW.clone().add(V(0, .05, 0)), u)); p.rotation.z += dt * 4; }
    else if (act.t < 2.6) { const u = (act.t - 1.8) / .8; p.position.copy(mouthW.clone().add(V(0, .03, 0))); p.scale.setScalar(1 - u * .9); mouth.scale.y = .45 + Math.sin(u * Math.PI * 3) * .7; }
    else if (!act.did) {
      act.did = true; p.visible = false; p.scale.setScalar(1); mouth.scale.y = .45;
      if (act.ok) { commit(act.color); act.phase = 'good'; } else { const r = commit(act.color); act.phase = 'bad'; act.fall = { v: V(.25, 1.4, .8) }; p.visible = true; p.position.copy(mouthW); skinMat.emissive.setHex(0x661010); }
    } else if (act.phase === 'good') { const u = act.t - 2.6; skinMat.emissive.setRGB(.05 * Math.max(0, 1 - u), .35 * Math.max(0, 1 - u / 1.5), .2 * Math.max(0, 1 - u / 1.5)); if (u > 1.6) { helmet(false); skinMat.emissive.setHex(0); act = null; } }
    else if (act.phase === 'bad') { const f = act.fall; f.v.y -= 6 * dt; p.position.addScaledVector(f.v, dt); p.rotation.z += dt * 8; if (act.t > 4.0 || p.position.y < .1) { p.visible = true; p.position.copy(home); p.rotation.set(0, .5, 0); helmet(false); skinMat.emissive.setHex(0); act = null; } }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - (last || now)) / 1000); last = now; const d = getData() || {};
    stepAct(dt);
    // LUCAS 3: steady compressions at ~102/min (the pad goes down 4.5 cm); idle = pad lifted
    const comp = lucasOn ? (.5 - .5 * Math.cos(t * Math.PI * 2 * 1.7)) : 0; pad.position.y = lerp(lucasOn ? 1.49 : 1.6, lucasOn ? 1.435 : 1.6, lucasOn ? comp : 0); pad.position.y = lucasOn ? 1.485 - .05 * comp : 1.6;
    rod.scale.y = 1.89 - pad.position.y; body.position.y = 1.21 - (lucasOn ? .012 * comp : 0);
    Object.keys(pills).forEach(k => { if (!act || act.color !== k) pills[k].position.y = pillHome[k].y + Math.sin(t * 2 + (k === 'red' ? 0 : 1)) * .012; });
    // emergency strobe until recovered
    glowS.intensity = d.ok ? 0 : 1.2 + 1.2 * Math.sin(t * 5); lamp.material.color.set(d.ok ? 0x2ee6a6 : 0xff4d5e);
    if (now - lastPanel > 50) { lastPanel = now; drawPanel(t); drawAgenda(); }
    // telemetry beam to Earth
    if (tel) { tel.t += dt; telBeads.forEach((b, i) => { const s = tel.t * .55 - i * .05; b.visible = s > 0 && s < 1; if (b.visible) b.position.copy(telCurve.getPoint(s)); }); if (tel.t > 3) { tel = null; telBeads.forEach(b => b.visible = false); } }
    api._earth.rotation.y = t * .01;
    cam.position.x = Math.sin(t * .2) * .25 - .3 + drag.yaw * .6; cam.position.y = camBase.y + Math.sin(t * .27) * .04; cam.lookAt(.5, 1.35, .2);
    R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 3.6, needW = clamp(a * 4.3, 3.8, 7.2);
    camBase.z = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)) + .3; cam.position.z = camBase.z; cam.updateProjectionMatrix();
  }

  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; getData = opts.getData || getData; isCorrect = opts.isCorrect || isCorrect; commit = opts.commit || commit; onLucas = opts.onLucas || onLucas;
    try {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
      stage.insertBefore(canvas, stage.firstChild);
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02040c); cam = new T.PerspectiveCamera(38, 1, .1, 400); cam.position.set(-.3, camBase.y, camBase.z);
      const envS = new T.Scene(); envS.background = new T.Color(0x0a1226);
      [[6, 3, 0, 6, 0, 0xffffff, 6], [4, 4, -7, 2, 2, 0xcfe6ff, 4], [4, 2, 6, 1, -4, 0xffd9a0, 3], [8, 3, 0, -6, 0, 0x4cc9f0, 1.2], [5, 5, 0, 2, -8, 0x2b6fd6, 1.5]].forEach(([w, h, x, y, z, c, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); });
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(envS, .02).texture; pm.dispose();
      scene.add(new T.HemisphereLight(0xbfd8ff, 0x2a2f44, .6));
      const key = new T.DirectionalLight(0xfff2e0, 1.7); key.position.set(2, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const s = key.shadow.camera; s.left = -3.5; s.right = 3.5; s.top = 3.5; s.bottom = -3; s.near = 1; s.far = 20; key.shadow.bias = -.0004; key.target.position.set(0, 1, 0); scene.add(key, key.target);
      const rim = new T.DirectionalLight(0x9fd0ff, 1.0); rim.position.set(-6, 3, -8); scene.add(rim); const sl = new T.PointLight(0x4cc9f0, 1.0, 8); sl.position.set(2.4, 2.4, -2.2); scene.add(sl);
      room(); stretcher(); antenna();
      const lie = new T.Group(); lie.position.set(-.05, 0, .25); lie.rotation.y = Math.PI / 2; scene.add(lie);
      A = B.makeAstronaut(lie, { bare: true }); body = A.body; body.rotation.x = -Math.PI / 2; body.position.set(0, 1.21, 0);
      A.shL.rotation.set(0, 0, -.14); A.shR.rotation.set(0, 0, .14); A.elL.rotation.x = -.1; A.elR.rotation.x = -.1; A.hipL.rotation.set(0, 0, -.05); A.hipR.rotation.set(0, 0, .05); A.kneeL.rotation.x = .06; A.kneeR.rotation.x = .06; A.ankleL.rotation.x = -.6; A.ankleR.rotation.x = -.6;
      lie.updateMatrixWorld(true); makeFace(); const chest = body.localToWorld(V(0, .4, .2)); buildLucas(chest); tray();
      const ray = new T.Raycaster(), mv = new T.Vector2(); let downX = 0, moved = 0;
      const pick = e => { const r = canvas.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); const hs = ray.intersectObjects(hits, false); return hs.length ? hs[0].object.userData : null; };
      canvas.addEventListener('pointerdown', e => { drag.down = true; drag.x = downX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag.down) { canvas.style.cursor = pick(e) ? 'pointer' : 'grab'; return; } moved = Math.max(moved, Math.abs(e.clientX - downX)); canvas.style.cursor = 'grabbing'; drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .008, -1.2, 1.2); drag.x = e.clientX; });
      canvas.addEventListener('pointerup', e => { const was = drag.down; drag.down = false; canvas.style.cursor = 'grab'; if (was && moved < 6) { const o = pick(e); if (!o) return; if (o.name === 'pill') startPick(o.color); else if (o.name === 'lucas') onLucas(); else if (o.name === 'cabinet' && opts.onCabinet) opts.onCabinet(); } });
      canvas.addEventListener('pointercancel', () => { drag.down = false; });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D pharmacy unavailable, using the 2D scene instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false; }
  };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
})();
