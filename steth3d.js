/* Phase 2 · Stethoscope in 3D (Three.js r149): the spacesuit astronaut next to the medical cart.
   A digital stethoscope with a flexible cable plugs into the AI computer; drag the chest piece over the heart (5 s), lung (3 s) or stomach:
   holographic targets, a progress ring, an X-ray view of the organs, and the sound waves drawn live on the computer screen.
   Needs cabin3d.js + bike3d.js.   API: Steth3d.init(stage,{getData,onZone,onPlug}) · reset() · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D, B = window.Bike3D;
  const api = { ready: false, failed: false };
  window.Steth3d = api;
  if (!T || !C || !C.kit || !B || !B.makeAstronaut) { api.failed = true; return; }
  const K = C.kit, M = K.M, ctex = K.ctex, clamp = K.clamp, mesh = K.mesh;
  const V = (x, y, z) => new T.Vector3(x, y, z), lerp = (a, b, p) => a + (b - a) * p, ease = p => p * p * (3 - 2 * p);
  const NEED = { heart: 5, lung: 3 };

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, getData = () => ({}), onZone = () => {}, onPlug = () => {};
  let t0 = performance.now(), last = 0, lastDraw = 0, drag = { yaw: 0, down: false, x: 0 }, camBase = { y: 1.9, z: 7 };
  let A, body, face, piece, pieceRing, cableMesh, cableMat, beads = [], plug, plugLed, port, scrCtx, scrTex, statusL, targets = {}, organs = {}, torsoMat, xr = 0, zone = null, pieceOn = false, plugT = 0, hitPiece, hitPlug, prog, progTex, progCtx, lastZoneKey = '';
  const anchors = {};

  /* ---------- room + medical cart with the AI computer ---------- */
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
    // the AI computer: on a rolling cart next to the astronaut + the same screen mirrored on the wall
    const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 640; scrCtx = sc.getContext('2d'); scrTex = new T.CanvasTexture(sc); scrTex.encoding = T.sRGBEncoding; scrTex.anisotropy = 4;
    mesh(new T.BoxGeometry(3.9, 2.45, .14), M({ color: 0x151a28, roughness: .4, metalness: .8 }), 2.45, 2.75, bz + .05, scene);
    const wall = new T.Mesh(new T.PlaneGeometry(3.6, 2.25), new T.MeshBasicMaterial({ map: scrTex, toneMapped: false })); wall.position.set(2.45, 2.75, bz + .13); scene.add(wall);
    const cart = new T.Group(); cart.position.set(1.35, 0, -.5); scene.add(cart);
    const alu = M({ color: 0xd7dce8, metalness: .9, roughness: .3 }), dark = M({ color: 0x1b2030, roughness: .4, metalness: .6 });
    mesh(new T.BoxGeometry(1.5, .06, .75), M({ color: 0xe9edf5, roughness: .3, metalness: .3 }), 0, .86, 0, cart); mesh(new T.BoxGeometry(1.4, .7, .65), M({ color: 0x38445f, roughness: .55, metalness: .5 }), 0, .46, 0, cart);
    [[-.65, -.3], [.65, -.3], [-.65, .3], [.65, .3]].forEach(([x, z]) => { mesh(new T.CylinderGeometry(.05, .05, .06, 14), dark, x, .03, z, cart); });
    mesh(new T.BoxGeometry(.55, .5, .5), dark, .5, 1.14, 0, cart);                                                     // computer tower
    mesh(new T.BoxGeometry(.04, .3, .02), new T.MeshStandardMaterial({ color: 0x111, emissive: 0x4cc9f0, emissiveIntensity: .8 }), .72, 1.14, .26, cart);
    port = new T.Group(); port.position.set(.78, 1.05, 0); cart.add(port); mesh(new T.BoxGeometry(.07, .08, .1), M({ color: 0x0b0f1a, roughness: .5 }), 0, 0, 0, port); mesh(new T.BoxGeometry(.015, .05, .07), new T.MeshStandardMaterial({ color: 0x111, emissive: 0x4cc9f0, emissiveIntensity: 1 }), .04, 0, 0, port);
    mesh(new T.CylinderGeometry(.04, .06, .26, 14), alu, -.25, 1.0, 0, cart); mesh(new T.BoxGeometry(.9, .58, .04), dark, -.25, 1.44, 0, cart);
    const ms = new T.Mesh(new T.PlaneGeometry(.84, .52), new T.MeshBasicMaterial({ map: scrTex, toneMapped: false })); ms.position.set(-.25, 1.44, .025); cart.add(ms);
    cart.updateMatrixWorld(true); api._portW = port.localToWorld(V(.045, 0, 0)); api._plugRest = cart.localToWorld(V(.45, .72, .45));
  }

  /* ---------- the astronaut (same spacesuit as the other scenes) ---------- */
  function astronaut() {
    A = B.makeAstronaut(scene, { noChest: true }); body = A.body; body.position.set(-.55, 1.16, -.3); body.rotation.y = -.35;
    A.shL.rotation.set(0, 0, -.12); A.shR.rotation.set(-.2, 0, .12); A.elL.rotation.x = -.15; A.elR.rotation.x = -.3; A.hipL.rotation.set(0, 0, -.04); A.hipR.rotation.set(0, 0, .04);
    // torso becomes see-through for the X-ray view; organs sit inside
    torsoMat = A.torso.material = A.torso.material.clone(); torsoMat.transparent = true;
    const hg = new T.Group(); hg.position.set(.09, .4, .02); hg.visible = false; body.add(hg); organs.heart = hg;
    const hm = new T.MeshStandardMaterial({ color: 0xd0243a, emissive: 0x6a0a14, emissiveIntensity: .8, roughness: .35 }); const h1 = mesh(new T.SphereGeometry(.07, 24, 18), hm, 0, 0, 0, hg); h1.scale.set(1, 1.18, .9); mesh(new T.SphereGeometry(.045, 16, 12), hm, -.045, .07, 0, hg); mesh(new T.CylinderGeometry(.018, .018, .1, 10), new T.MeshStandardMaterial({ color: 0xe0586a }), .03, .12, 0, hg);
    const lg = new T.Group(); lg.visible = false; body.add(lg); organs.lung = lg; const lm = new T.MeshStandardMaterial({ color: 0x8fd3ff, emissive: 0x2a6fa0, emissiveIntensity: .7, transparent: true, opacity: .7, roughness: .4 });
    [-1, 1].forEach(s => { const l = mesh(new T.SphereGeometry(.1, 24, 18), lm, s * .14, .42, -.01, lg); l.scale.set(.9, 1.5, .8); l.userData.s = s; });
    const sg = new T.Group(); sg.position.set(.05, .12, .06); sg.visible = false; body.add(sg); organs.stomach = sg; mesh(new T.SphereGeometry(.07, 20, 14), new T.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false }), 0, 0, 0, sg);
    for (let i = 0; i < 8; i++) { const b = mesh(new T.SphereGeometry(.014, 8, 6), new T.MeshBasicMaterial({ color: 0xffe9c0, transparent: true, opacity: .8, blending: T.AdditiveBlending, depthWrite: false }), 0, 0, 0, sg); b.userData.p = i / 8; }
    const rib = new T.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: .0, blending: T.AdditiveBlending, depthWrite: false }); organs.ribs = [0, 1, 2, 3].map(i => { const r = new T.Mesh(new T.TorusGeometry(.27 - i * .01, .006, 6, 40), rib.clone()); r.rotation.x = Math.PI / 2; r.scale.set(1, .8, 1); r.position.set(0, .22 + i * .08, 0); body.add(r); return r; });
    body.updateMatrixWorld(true);
    // zone anchors (world) on the front of the chest
    anchors.heart = body.localToWorld(V(.09, .4, .24)); anchors.lung = body.localToWorld(V(-.13, .43, .24)); anchors.stomach = body.localToWorld(V(.05, .13, .26));
    const mkT = (k, label, col) => { const g = new T.Group(); g.position.copy(anchors[k]); scene.add(g); const ring = new T.Mesh(new T.TorusGeometry(.09, .005, 8, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .8, blending: T.AdditiveBlending, depthWrite: false })); g.add(ring); const dot = new T.Mesh(new T.CircleGeometry(.09, 32), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .1, blending: T.AdditiveBlending, depthWrite: false })); g.add(dot);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: ctex(256, 64, (c, w, h) => { c.fillStyle = 'rgba(6,14,30,.8)'; c.beginPath(); c.roundRect ? c.roundRect(4, 6, w - 8, h - 12, 18) : c.rect(4, 6, w - 8, h - 12); c.fill(); c.strokeStyle = '#' + col.toString(16).padStart(6, '0'); c.lineWidth = 3; c.stroke(); c.fillStyle = '#fff'; c.font = 'bold 30px "Segoe UI",Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, w / 2, h / 2 + 1); }), transparent: true, depthTest: false })); sp.scale.set(.36, .09, 1); sp.position.set(.0, .15, .04); sp.renderOrder = 10; g.add(sp); targets[k] = { g, ring, dot, sp }; };
    mkT('heart', '❤ heart · 5 s', 0xff6b7a); mkT('lung', '💨 lung · 3 s', 0x7fd6ff); mkT('stomach', '🍽 stomach', 0xffd9a0);
  }

  /* ---------- stethoscope: chest piece, flexible cable, plug ---------- */
  function stethoscope() {
    piece = new T.Group(); piece.position.copy(anchors.stomach).add(V(.55, -.2, .35)); scene.add(piece);
    mesh(new T.CylinderGeometry(.046, .046, .018, 28), M({ color: 0xcfd6e4, metalness: .95, roughness: .2 }), 0, 0, 0, piece).rotation.x = Math.PI / 2; mesh(new T.CylinderGeometry(.036, .036, .02, 28), M({ color: 0x1b2030, roughness: .3 }), 0, 0, .004, piece).rotation.x = Math.PI / 2;
    mesh(new T.CylinderGeometry(.012, .012, .05, 10), M({ color: 0x20242f }), 0, 0, -.03, piece).rotation.x = Math.PI / 2; const led = mesh(new T.SphereGeometry(.007, 8, 6), new T.MeshBasicMaterial({ color: 0x4cc9f0 }), .03, .03, .012, piece);
    pieceRing = new T.Mesh(new T.TorusGeometry(.07, .006, 8, 40), new T.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: .0 })); piece.add(pieceRing);
    // progress ring sprite (follows the chest piece)
    const pc = document.createElement('canvas'); pc.width = 128; pc.height = 128; progCtx = pc.getContext('2d'); progTex = new T.CanvasTexture(pc); prog = new T.Sprite(new T.SpriteMaterial({ map: progTex, transparent: true, depthTest: false })); prog.scale.set(.26, .26, 1); prog.renderOrder = 11; piece.add(prog); prog.visible = false;
    // cable + plug (the plug blinks near the computer input until it is connected)
    cableMat = new T.MeshStandardMaterial({ color: 0x20242f, emissive: 0x000000, roughness: .5 });
    plug = new T.Group(); scene.add(plug); mesh(new T.BoxGeometry(.05, .05, .09), M({ color: 0x20242f, roughness: .4, metalness: .6 }), 0, 0, 0, plug); mesh(new T.BoxGeometry(.04, .012, .05), M({ color: 0xc9d0dc, metalness: .95, roughness: .2 }), 0, 0, .06, plug);
    plugLed = mesh(new T.SphereGeometry(.012, 8, 6), new T.MeshBasicMaterial({ color: 0xffd23f }), 0, .03, 0, plug);
    for (let i = 0; i < 10; i++) { const b = new T.Mesh(new T.SphereGeometry(.012, 8, 6), new T.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); b.visible = false; scene.add(b); beads.push(b); }
    hitPiece = new T.Mesh(new T.SphereGeometry(.14, 10, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); piece.add(hitPiece);
    hitPlug = new T.Mesh(new T.SphereGeometry(.16, 10, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); plug.add(hitPlug);
  }
  let curve = null;
  function updateCable(connected) {
    const a = piece.position.clone().add(V(0, 0, -.05)), b = plug.position.clone().add(V(0, 0, -.06)), mid = a.clone().lerp(b, .5); mid.y -= .45 + a.distanceTo(b) * .08; mid.z += .1;
    const c1 = a.clone().add(V(0, -.12, -.08)), c2 = b.clone().add(V(-.08, -.1, -.1));
    curve = new T.CatmullRomCurve3([a, c1, mid, c2, b]);
    if (cableMesh) { scene.remove(cableMesh); cableMesh.geometry.dispose(); } cableMesh = new T.Mesh(new T.TubeGeometry(curve, 36, .007, 6), cableMat); cableMesh.castShadow = true; scene.add(cableMesh);
  }

  /* ---------- computer screen ---------- */
  const gauss = (p, m, s) => Math.exp(-((p - m) ** 2) / (2 * s * s));
  function drawScreen(t, d) {
    const g = scrCtx, w = 1024, h = 640, conn = !!d.conn, done = !!d.done, zn = zone, gl = d.g == null ? -1 : d.g, hr = d.hr || 72, arr = !!d.arr || d.lvhr === 2;
    g.fillStyle = '#04091a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(76,201,240,.10)'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#4cc9f0'; g.font = 'bold 32px "Segoe UI",Arial'; g.fillText('AI STETHOSCOPE · SPACEDOC', 28, 46);
    const col = done ? '#2ee6a6' : conn ? '#4cc9f0' : '#ffd23f', word = done ? 'ANALYSIS DONE' : d.busy ? 'PROCESSING…' : conn ? 'LISTENING' : 'NOT CONNECTED';
    g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(700, 12, 296, 46, 23) : g.rect(700, 12, 296, 46); g.fill(); g.fillStyle = '#04091a'; g.font = 'bold 24px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(word, 848, 44); g.textAlign = 'left';
    // waveform
    const ex = 28, ey = 76, ew = 640, eh = 250; g.fillStyle = '#010509'; g.fillRect(ex, ey, ew, eh); g.strokeStyle = 'rgba(46,230,166,.12)'; for (let x = ex; x <= ex + ew; x += 40) { g.beginPath(); g.moveTo(x, ey); g.lineTo(x, ey + eh); g.stroke(); }
    g.beginPath(); g.moveTo(ex, ey + eh / 2); g.lineTo(ex + ew, ey + eh / 2); g.stroke();
    g.strokeStyle = zn === 'heart' ? '#ff7a8a' : zn === 'lung' ? '#7fd6ff' : zn === 'stomach' ? '#ffd9a0' : '#3a4a6a'; g.lineWidth = 2.6; g.shadowColor = g.strokeStyle; g.shadowBlur = zn ? 8 : 0; g.beginPath();
    for (let px = 0; px < ew; px += 2) {
      const tt = t - (ew - px) / ew * 3.6; let y = (Math.random() - .5) * .02;
      if (conn && zn === 'heart') { let tw = tt; if (arr) tw += .2 * Math.sin(tt * 2.3) + .14 * Math.sin(tt * 5.1); const p = ((tw * hr / 60) % 1 + 1) % 1, env = gauss(p, .06, .022) + .6 * gauss(p, .34, .018); y = env * Math.sin(px * 1.1 + t * 40) * .8 + (Math.random() - .5) * .04; }
      else if (conn && zn === 'lung') { const env = .5 - .5 * Math.cos(tt * Math.PI * 2 / 4.3); y = (Math.random() - .5) * (.15 + .75 * env); }
      else if (conn && zn === 'stomach') { const e = Math.max(0, Math.sin(tt * 3.1) * Math.sin(tt * 1.3)); y = (Math.random() - .5) * (.05 + .7 * e * e); }
      const yy = ey + eh / 2 - y * eh * .45; px ? g.lineTo(ex + px, yy) : g.moveTo(ex + px, yy);
    } g.stroke(); g.shadowBlur = 0;
    g.fillStyle = '#9aa7c7'; g.font = '20px "Segoe UI",Arial'; g.fillText(zn === 'heart' ? 'Phonocardiogram · "lub-dub" · ' + (arr ? 'irregular rhythm' : hr + ' bpm') : zn === 'lung' ? 'Breathing sound · inhale / exhale' : zn === 'stomach' ? 'Abdominal sounds' : 'Waiting for a sound…', ex + 10, ey + eh - 10);
    // microgravity: fluid shift towards the head
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText('MICROGRAVITY', 700, 100); g.strokeStyle = '#8fb9ff'; g.lineWidth = 3; g.beginPath(); g.arc(790, 160, 22, 0, 7); g.stroke(); g.beginPath(); g.moveTo(790, 182); g.lineTo(790, 270); g.moveTo(790, 205); g.lineTo(760, 240); g.moveTo(790, 205); g.lineTo(820, 240); g.moveTo(790, 270); g.lineTo(772, 316); g.moveTo(790, 270); g.lineTo(808, 316); g.stroke();
    for (let i = 0; i < 9; i++) { const k = ((t * .5 + i / 9) % 1), y = 300 - k * 150; g.fillStyle = 'rgba(100,170,255,' + (1 - k) * .9 + ')'; g.beginPath(); g.arc(790 + Math.sin(i * 2 + t) * 8, y, 4, 0, 7); g.fill(); } g.fillStyle = '#d6def5'; g.font = '19px "Segoe UI",Arial'; g.fillText('fluids rise to the head', 850, 170); g.fillText('puffy face · "bird legs"', 850, 198); g.fillText('the heart works less', 850, 226);
    // progress bars
    const bar = (label, v, need, y, c) => { g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(label, 28, y); g.fillStyle = '#16203a'; g.fillRect(190, y - 20, 360, 22); g.fillStyle = c; g.fillRect(190, y - 20, 360 * clamp(v / need, 0, 1), 22); g.fillStyle = '#fff'; g.fillText(Math.min(need, v).toFixed(1) + ' / ' + need + ' s', 566, y); };
    bar('❤ Heart', d.t ? d.t.heart : 0, 5, 372, '#ff7a8a'); bar('💨 Lung', d.t ? d.t.lung : 0, 3, 416, '#7fd6ff');
    g.fillStyle = '#d6def5'; g.font = '24px "Segoe UI",Arial'; const lines = done ? ['> Heart sounds analyzed ✔', '> Lung sounds analyzed ✔', '> Output saved. Press NEXT (+4 XP).'] : d.busy ? ['> AI processing the audio…'] : conn ? ['> Cable connected!', '> Listen to the heart (5 s) and the lung (3 s).'] : ['> Waiting for stethoscope sounds…', '> Do not forget to connect the cable to the computer!'];
    lines.forEach((l, i) => g.fillText(l, 28, 478 + i * 34));
    g.fillStyle = gl === 2 ? '#ff7a8a' : gl === 1 ? '#ffd23f' : '#2ee6a6'; g.font = '20px "Segoe UI",Arial'; g.textAlign = 'right'; g.fillText(gl < 0 ? '' : 'Patient status: ' + ['STABLE', 'ATTENTION', 'EMERGENCY'][gl], 996, 610); g.textAlign = 'left';
    scrTex.needsUpdate = true;
  }
  function drawProg(p, col) { const c = progCtx; c.clearRect(0, 0, 128, 128); c.lineWidth = 10; c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(64, 64, 50, 0, 7); c.stroke(); c.strokeStyle = col; c.beginPath(); c.arc(64, 64, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(p, 0, 1)); c.stroke(); progTex.needsUpdate = true; }

  /* ---------- loop ---------- */
  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - (last || now)) / 1000); last = now; const d = getData() || {}, conn = !!d.conn, g = d.g == null ? -1 : d.g, hr = d.hr || 72, arr = !!d.arr || d.lvhr === 2;
    // astronaut idle (floating gently, relaxed)
    body.position.y = 1.16 + Math.sin(t * .9) * .012; body.rotation.set(Math.sin(t * .6) * .015, -.35 + Math.sin(t * .4) * .04, Math.sin(t * .5) * .012);
    A.shL.rotation.x = Math.sin(t * .9) * .05;
    // cabin mood
    statusL.color.setHex(g === 2 ? 0xff3050 : 0x6fb4ff); statusL.intensity = g === 2 ? .9 + .7 * Math.sin(t * 5) : .8;
    // plug: blinks near the input until connected, then travels into the port
    const rest = api._plugRest, portW = api._portW; plugT += ((conn ? 1 : 0) - plugT) * Math.min(1, dt * 4); plug.position.lerpVectors(rest, portW.clone().add(V(-.06, 0, 0)), ease(plugT)); plug.rotation.y = lerp(.9, Math.PI / 2, ease(plugT)); plug.rotation.x = 0;
    plugLed.material.color.setHex(conn ? 0x2ee6a6 : (Math.floor(t * 3) % 2 ? 0xffd23f : 0x3a3000));
    cableMat.emissive.setHex(conn ? (d.busy ? 0xffd23f : 0x1fbf7a) : 0x000000); cableMat.emissiveIntensity = conn ? .8 + .3 * Math.sin(t * 6) : 0;
    // chest piece: stays where it was left; zone detection
    const pp = piece.position; let z2 = null; if (pieceOn) { ['heart', 'lung', 'stomach'].forEach(k => { const a = anchors[k]; if (Math.hypot(pp.x - a.x, pp.y - a.y) < .11 && Math.abs(pp.z - a.z) < .2) z2 = k; }); }
    if (z2 !== zone) { zone = z2; onZone(zone); }
    const key = zone || ''; if (key !== lastZoneKey) lastZoneKey = key;
    // X-ray: torso turns see-through and the organ under the probe appears
    const want = zone === 'heart' || zone === 'lung' || zone === 'stomach' ? 1 : 0; xr += (want - xr) * Math.min(1, dt * 5); torsoMat.opacity = 1 - .78 * xr; torsoMat.depthWrite = xr < .4;
    organs.heart.visible = xr > .05 && zone === 'heart'; organs.lung.visible = xr > .05 && zone === 'lung'; organs.stomach.visible = xr > .05 && zone === 'stomach'; organs.ribs.forEach(r => r.material.opacity = xr * .5);
    const beat = arr ? Math.pow(Math.max(0, Math.sin(t * Math.PI * hr / 60 * (1 + .25 * Math.sin(t * 3)) + Math.sin(t * 2.3))), 5) : Math.pow(Math.max(0, Math.sin(t * Math.PI * hr / 60)), 5);
    organs.heart.scale.setScalar(1 + beat * .22); organs.heart.children[0].material.emissiveIntensity = .5 + beat * 1.4;
    const br = .5 - .5 * Math.cos(t * Math.PI * 2 / 4.3); organs.lung.children.forEach(l => { l.scale.set(.9 + br * .2, 1.5 + br * .22, .8 + br * .16); }); organs.lung.children.forEach((l, i) => l.material.emissiveIntensity = .5 + br * .6);
    organs.stomach.children.forEach((b, i) => { if (!b.userData.p && b.userData.p !== 0) return; const k = ((t * .4 + b.userData.p) % 1); b.position.set(Math.sin(i * 3 + t) * .04, -.05 + k * .14, Math.cos(i * 2 + t) * .03); b.material.opacity = (1 - k) * .8; });
    // holographic targets (stronger while dragging) + progress ring on the chest piece
    Object.keys(targets).forEach(k => { const tg = targets[k]; const hot = zone === k; tg.ring.material.opacity = (pieceOn ? .85 : .35) + (hot ? .15 : 0); tg.ring.scale.setScalar(1 + (hot ? .1 : 0) + .04 * Math.sin(t * 3 + k.length)); tg.dot.material.opacity = hot ? .3 : .08; tg.sp.material.opacity = pieceOn || hot ? 1 : .55; tg.g.lookAt(cam.position); });
    pieceRing.material.opacity = zone ? .9 : 0; prog.visible = !!zone && NEED[zone] != null;
    if (prog.visible) { const val = d.t ? d.t[zone] : 0; drawProg(val / NEED[zone], zone === 'heart' ? '#ff7a8a' : '#7fd6ff'); }
    // cable + sound waves travelling from the chest piece to the computer
    updateCable(conn); beads.forEach((b, i) => { const on = conn && zone && !d.done; b.visible = !!on; if (on) { const s = ((t * .7 - i * .1) % 1 + 1) % 1; b.position.copy(curve.getPoint(s)); b.material.color.setHex(zone === 'heart' ? 0xff9aa6 : zone === 'lung' ? 0x9fe0ff : 0xffe2b0); } });
    if (now - lastDraw > 70) { lastDraw = now; drawScreen(t, d); }
    api._earth.rotation.y = t * .01;
    cam.position.x = Math.sin(t * .2) * .25 + .5 + drag.yaw * .6; cam.position.y = camBase.y + Math.sin(t * .27) * .04; cam.lookAt(.3, 1.5, -.4);
    R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 2.5, needW = clamp(a * 2.7, 3.0, 5.0);
    camBase.z = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)) + .1; cam.position.z = camBase.z; cam.updateProjectionMatrix();
  }
  api.reset = function () { zone = null; pieceOn = false; if (api.ready) { piece.position.copy(anchors.stomach).add(V(.55, -.2, .35)); plugT = 0; xr = 0; } };

  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; getData = opts.getData || getData; onZone = opts.onZone || onZone; onPlug = opts.onPlug || onPlug;
    try {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab'; stage.insertBefore(canvas, stage.firstChild);
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02040c); cam = new T.PerspectiveCamera(38, 1, .1, 400); cam.position.set(.5, camBase.y, camBase.z);
      const envS = new T.Scene(); envS.background = new T.Color(0x0a1226);
      [[6, 3, 0, 6, 0, 0xffffff, 6], [4, 4, -7, 2, 2, 0xcfe6ff, 4], [4, 2, 6, 1, -4, 0xffd9a0, 3], [8, 3, 0, -6, 0, 0x4cc9f0, 1.2], [5, 5, 0, 2, -8, 0x2b6fd6, 1.5]].forEach(([w, h, x, y, z, c, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); });
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(envS, .02).texture; pm.dispose();
      scene.add(new T.HemisphereLight(0xbfd8ff, 0x2a2f44, .6));
      const key = new T.DirectionalLight(0xfff2e0, 1.6); key.position.set(2.5, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const s = key.shadow.camera; s.left = -3.5; s.right = 3.5; s.top = 3.5; s.bottom = -2; s.near = 1; s.far = 20; key.shadow.bias = -.0004; key.target.position.set(0, 1, -.4); scene.add(key, key.target);
      const rim = new T.DirectionalLight(0x9fd0ff, .9); rim.position.set(-6, 3, -8); scene.add(rim); statusL = new T.PointLight(0x6fb4ff, .8, 8); statusL.position.set(0, 3.2, 1); scene.add(statusL);
      room(); astronaut(); stethoscope();
      // interaction: drag the chest piece over the torso, tap the plug to connect, drag elsewhere to rotate
      const ray = new T.Raycaster(), mv = new T.Vector2(), plane = new T.Plane(V(0, 0, 1), -anchors.heart.z), hitp = V(0, 0, 0); let mode = null, downX = 0, moved = 0;
      const ndc = e => { const r = canvas.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); };
      const over = (e, o) => { ndc(e); return ray.intersectObject(o, false).length > 0; };
      canvas.addEventListener('pointerdown', e => { downX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); drag.x = e.clientX; if (over(e, hitPiece)) { mode = 'piece'; pieceOn = true; canvas.style.cursor = 'grabbing'; } else if (over(e, hitPlug)) mode = 'plug'; else { mode = 'cam'; } });
      canvas.addEventListener('pointermove', e => {
        if (!mode) { canvas.style.cursor = over(e, hitPiece) ? 'grab' : over(e, hitPlug) ? 'pointer' : 'grab'; return; }
        moved = Math.max(moved, Math.abs(e.clientX - downX));
        if (mode === 'piece') { ndc(e); if (ray.ray.intersectPlane(plane, hitp)) { piece.position.set(clamp(hitp.x, anchors.heart.x - .55, anchors.heart.x + .75), clamp(hitp.y, anchors.stomach.y - .12, anchors.heart.y + .35), anchors.heart.z + .02); piece.lookAt(cam.position); } }
        else if (mode === 'cam') { drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .008, -1.3, 1.3); drag.x = e.clientX; }
      });
      const up = () => { if (mode === 'piece') { pieceOn = false; } else if (mode === 'plug' && moved < 8) onPlug(); mode = null; canvas.style.cursor = 'grab'; };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      // keyboard: H / L / S put the probe on heart / lung / stomach, C connects the cable, arrows nudge the probe
      document.addEventListener('keydown', e => { if (!running || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; const k = e.key.toLowerCase(), z = { h: 'heart', l: 'lung', s: 'stomach' }[k];
        if (z) { const a = anchors[z]; piece.position.set(a.x, a.y, a.z + .02); piece.lookAt(cam.position); pieceOn = true; e.preventDefault(); }
        else if (k === 'c') { onPlug(); } else if (k === 'x') { pieceOn = false; }
        else if (e.key.startsWith('Arrow')) { const dd = { ArrowLeft: [-.04, 0], ArrowRight: [.04, 0], ArrowUp: [0, .04], ArrowDown: [0, -.04] }[e.key]; if (dd) { piece.position.x += dd[0]; piece.position.y += dd[1]; pieceOn = true; e.preventDefault(); } } });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D stethoscope unavailable, using the 2D scene instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false; }
  };
  api.debug = function () { const f = o => { const v = o.clone().project(cam); const r = canvas.getBoundingClientRect(); return [Math.round(r.left + (v.x * .5 + .5) * r.width), Math.round(r.top + (-v.y * .5 + .5) * r.height)]; }; return { piece: f(piece.position), heart: f(anchors.heart), lung: f(anchors.lung), plug: f(plug.position) }; };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; if (zone) { zone = null; onZone(null); } pieceOn = false; };
})();
