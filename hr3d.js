/* Heart-rate exam in 3D (Three.js r149): an astronaut strapped to a floor-mounted stretcher, ECG electrodes stuck on the chest,
   cables running to the ship's cardiac monitor. Tap the astronaut to start monitoring; the ECG appears on the panel.
   Needs cabin3d.js + bike3d.js.  API: Hr3d.init(stage,{getData,level,onPhase,onDone,onTap}) · measure(hr,arr) · show(hr,arr) · reset() · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D, B = window.Bike3D;
  const api = { ready: false, failed: false };
  window.Hr3d = api;
  if (!T || !C || !C.kit || !B || !B.makeAstronaut) { api.failed = true; return; }
  const K = C.kit, M = K.M, ctex = K.ctex, clamp = K.clamp, mesh = K.mesh;

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, getData = () => ({}), level = () => 0, onPhase = () => {}, onDone = () => {};
  let t0 = performance.now(), last = 0, lastPanel = 0, pg, ptex, lamp, ring, hit, led, drag = { yaw: 0, down: false, x: 0 };
  let mon = null, lastBeat = -1, doneSent = false;      // monitoring session
  const camBase = { y: 2.6, z: 7 };

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
    // the ship's cardiac monitor panel
    mesh(new T.BoxGeometry(3.9, 2.45, .14), M({ color: 0x151a28, roughness: .4, metalness: .8 }), 2.2, 2.55, bz + .05, scene);
    const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 640; pg = pc.getContext('2d'); ptex = new T.CanvasTexture(pc); ptex.encoding = T.sRGBEncoding; ptex.anisotropy = 4;
    const sc = new T.Mesh(new T.PlaneGeometry(3.6, 2.25), new T.MeshBasicMaterial({ map: ptex, toneMapped: false })); sc.position.set(2.2, 2.55, bz + .13); scene.add(sc);
    lamp = new T.Mesh(new T.BoxGeometry(3.6, .08, .06), new T.MeshBasicMaterial({ color: 0x6f7c99 })); lamp.position.set(2.2, 3.9, bz + .12); scene.add(lamp);
    mesh(new T.BoxGeometry(3.9, .9, .6), M({ color: 0x2a3042, roughness: .5, metalness: .6 }), 2.2, .45, bz + .45, scene);
  }

  /* ---------- the stretcher (bolted to the floor) ---------- */
  function stretcher() {
    const alu = M({ color: 0xd7dce8, metalness: .9, roughness: .26 }), steel = M({ color: 0x8d96a8, metalness: .95, roughness: .35 }), orange = M({ color: 0xff7a1a, roughness: .55 });
    const pad = M({ color: 0x2f5fa8, roughness: .8 }), padDark = M({ color: 0x1c3a6e, roughness: .85 });
    const g = new T.Group(); g.position.set(-.1, 0, .25); scene.add(g);
    const L = 2.5, top = .98;
    const tube = (a, b, r, mt) => { const p = new T.Vector3(...a), q = new T.Vector3(...b), d = q.clone().sub(p), m = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 16), mt); m.position.copy(p).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); m.castShadow = m.receiveShadow = true; g.add(m); };
    mesh(new T.BoxGeometry(L, .1, .86), alu, 0, .86, 0, g);                      // frame
    const mat = mesh(new T.BoxGeometry(L - .06, .09, .76), pad, 0, .945, 0, g);     // mattress
    mesh(new T.BoxGeometry(.5, .11, .6), padDark, -L / 2 + .45, 1.0, 0, g);          // head pillow
    [-.4, .4].forEach(z => tube([-L / 2, .93, z], [L / 2, .93, z], .02, steel));      // side rails
    // pedestal legs + floor plates with bolts
    [[-L / 2 + .25, -.34], [-L / 2 + .25, .34], [L / 2 - .25, -.34], [L / 2 - .25, .34]].forEach(([x, z]) => {
      tube([x, .06, z], [x, .86, z], .035, steel); mesh(new T.CylinderGeometry(.11, .11, .03, 24), steel, x, .015, z, g);
      for (let i = 0; i < 3; i++) { const a = i * 2.094; mesh(new T.CylinderGeometry(.014, .014, .03, 6), M({ color: 0x20242f, metalness: .6 }), x + Math.cos(a) * .075, .04, z + Math.sin(a) * .075, g); }
      mesh(new T.CylinderGeometry(.12, .12, .01, 24), M({ color: 0xffd23f, roughness: .6 }), x, .006, z, g);
    });
    tube([-L / 2 + .25, .35, -.34], [-L / 2 + .25, .35, .34], .02, steel); tube([L / 2 - .25, .35, -.34], [L / 2 - .25, .35, .34], .02, steel); tube([-L / 2 + .25, .35, 0], [L / 2 - .25, .35, 0], .02, steel);
    // restraint straps (hips, thighs, shins) with buckles
    const strap = (x, r) => { mesh(new T.BoxGeometry(.11, .014, .86), orange, x, r, 0, g); [-.43, .43].forEach(z => mesh(new T.BoxGeometry(.11, r - .9, .014), orange, x, (r + .9) / 2, z, g)); mesh(new T.BoxGeometry(.06, .02, .08), steel, x, r + .012, .12, g); };
    strap(.05, 1.39); strap(.55, 1.36); strap(1.0, 1.33);
    // name plate
    const plate = new T.Mesh(new T.PlaneGeometry(.5, .1), new T.MeshStandardMaterial({ map: ctex(256, 52, (c, w, h) => { c.fillStyle = '#ffd23f'; c.fillRect(0, 0, w, h); c.fillStyle = '#101216'; c.font = 'bold 26px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MED-BAY · FIXED TO FLOOR', w / 2, h / 2 + 2); }), roughness: .6 })); plate.position.set(0, .86, .435); g.add(plate);
    // cable junction box on the rail
    mesh(new T.BoxGeometry(.18, .1, .1), M({ color: 0x1b2030, roughness: .4, metalness: .6 }), -.1, .93, .47, g);
    led = mesh(new T.SphereGeometry(.012, 8, 6), new T.MeshBasicMaterial({ color: 0x2ee6a6 }), -.05, .96, .52, g);
    return g;
  }

  /* ---------- electrodes + lead wires on the astronaut's chest ---------- */
  function electrodes(body, bed) {
    const spots = [{ n: 'RA', c: 0xf1f3f8, p: [-.2, .5, .152], r: .4 }, { n: 'LA', c: 0x1a1c22, p: [.2, .5, .152], r: -.4 }, { n: 'LL', c: 0xff4d5e, p: [.12, .13, .192], r: -.2 }, { n: 'RL', c: 0x2ee6a6, p: [-.12, .13, .192], r: .2 }];
    const wires = new T.Group(); scene.add(wires);
    body.updateMatrixWorld(true); bed.updateMatrixWorld(true);
    const jb = new T.Vector3(-.1 - .1, .93, .25 + .47); // junction box world position (bed origin -.1,.25)
    spots.forEach((s, i) => {
      const e = new T.Group(); e.position.set(...s.p); e.rotation.y = s.r; body.add(e);
      const pd = mesh(new T.CylinderGeometry(.034, .034, .006, 24), M({ color: 0xf6efe0, roughness: .9 }), 0, 0, 0, e); pd.rotation.x = Math.PI / 2;
      const sn = mesh(new T.CylinderGeometry(.011, .011, .012, 14), M({ color: s.c, roughness: .35, metalness: .4 }), 0, 0, .008, e); sn.rotation.x = Math.PI / 2;
      const wp = new T.Vector3(); e.getWorldPosition(wp);
      const mid1 = wp.clone().add(new T.Vector3(0, .12, .0)), mid2 = new T.Vector3((wp.x + jb.x) / 2 + (i - 1.5) * .06, wp.y + .08, (wp.z + jb.z) / 2);
      const curve = new T.CatmullRomCurve3([wp.clone().add(new T.Vector3(0, .01, 0)), mid1, mid2, jb.clone().add(new T.Vector3((i - 1.5) * .02, .05, 0))]);
      const tb = new T.Mesh(new T.TubeGeometry(curve, 32, .006, 6), M({ color: s.c, roughness: .6 })); tb.castShadow = true; wires.add(tb);
    });
    // trunk cable from the junction box, over the floor, up to the monitor desk
    const trunk = new T.CatmullRomCurve3([jb.clone().add(new T.Vector3(0, -.05, .06)), new T.Vector3(-.1, .5, 1.1), new T.Vector3(.2, .02, 1.6), new T.Vector3(1.2, .02, .6), new T.Vector3(1.8, .02, -2.6), new T.Vector3(1.6, .95, -3.0)]);
    const tt = new T.Mesh(new T.TubeGeometry(trunk, 64, .018, 8), M({ color: 0x15171d, roughness: .7 })); tt.castShadow = true; wires.add(tt);
  }

  /* ---------- ECG waveform + panel ---------- */
  const gauss = (p, m, s) => Math.exp(-((p - m) ** 2) / (2 * s * s));
  function ecg(tt, bpm, arr, px) {
    if (arr) tt += .22 * Math.sin(tt * 2.3) + .15 * Math.sin(tt * 5.1);
    const p = ((tt * bpm / 60) % 1 + 1) % 1;
    return (arr ? .04 * Math.sin(px / 5 + tt * 9) : .1 * gauss(p, .12, .03)) - .12 * gauss(p, .205, .01) + gauss(p, .235, .012) - .25 * gauss(p, .265, .012) + .2 * gauss(p, .45, .04);
  }
  function drawPanel(t) {
    const g = pg, w = 1024, h = 640, d = getData() || {}, on = !!mon, el = on ? t - mon.start : 0, acq = on && el < 2.4, lock = on && !acq;
    const bpm = on ? mon.hr : 72, arr = on && mon.arr, lv = lock ? level(bpm, arr) : -1, col = lv < 0 ? '#7f8fb0' : ['#2ee6a6', '#ffd23f', '#ff4d5e'][lv];
    const word = !on ? 'NO SIGNAL' : acq ? 'ACQUIRING…' : arr ? 'IRREGULAR RHYTHM' : ['STABLE', 'ATTENTION', 'EMERGENCY'][lv];
    g.fillStyle = '#02070f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4cc9f0'; g.font = 'bold 32px "Segoe UI",Arial'; g.fillText('CARDIAC MONITOR · ECG', 28, 48);
    g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(660, 12, 336, 46, 23) : g.rect(660, 12, 336, 46); g.fill(); g.fillStyle = '#04091a'; g.font = 'bold 24px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(word, 828, 44); g.textAlign = 'left';
    // trace area
    const ex = 28, ey = 80, ew = 690, eh = 330; g.fillStyle = '#010509'; g.fillRect(ex, ey, ew, eh);
    g.strokeStyle = 'rgba(46,230,166,.10)'; g.lineWidth = 1; for (let x = ex; x <= ex + ew; x += 15) { g.beginPath(); g.moveTo(x, ey); g.lineTo(x, ey + eh); g.stroke(); } for (let y = ey; y <= ey + eh; y += 15) { g.beginPath(); g.moveTo(ex, y); g.lineTo(ex + ew, y); g.stroke(); }
    g.strokeStyle = 'rgba(46,230,166,.28)'; for (let x = ex; x <= ex + ew; x += 75) { g.beginPath(); g.moveTo(x, ey); g.lineTo(x, ey + eh); g.stroke(); } for (let y = ey; y <= ey + eh; y += 75) { g.beginPath(); g.moveTo(ex, y); g.lineTo(ex + ew, y); g.stroke(); }
    g.strokeStyle = lock ? (lv < 0 ? '#2ee6a6' : col) : '#2ee6a6'; g.lineWidth = 3.5; g.shadowColor = g.strokeStyle; g.shadowBlur = 10; g.beginPath();
    for (let px = 0; px < ew; px += 3) {
      const tt = t - (ew - px) / ew * 4.2; let y;
      if (!on || tt < mon.start) y = (on ? (Math.random() - .5) * .05 : 0);
      else if (tt < mon.start + 2.4) y = (Math.random() - .5) * .1 + .03 * Math.sin(tt * 40);       // electrodes settling
      else y = ecg(tt, mon.hr, mon.arr, px);
      const yy = ey + eh * .66 - y * eh * .55; px ? g.lineTo(ex + px, yy) : g.moveTo(ex + px, yy);
    }
    g.stroke(); g.shadowBlur = 0;
    g.fillStyle = '#9aa7c7'; g.font = '20px "Segoe UI",Arial'; g.fillText('LEAD II · 25 mm/s · 10 mm/mV', ex + 10, ey + eh - 10);
    // electrode map
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText('ELECTRODES', 740, 100);
    [['RA', 780, 150, '#f1f3f8'], ['LA', 900, 150, '#555b6a'], ['RL', 790, 240, '#2ee6a6'], ['LL', 890, 240, '#ff4d5e']].forEach(([n, x, y, c]) => { g.fillStyle = on ? c : '#2a3350'; g.beginPath(); g.arc(x, y, 22, 0, 7); g.fill(); g.fillStyle = on ? '#04091a' : '#5b6781'; g.font = 'bold 18px Arial'; g.textAlign = 'center'; g.fillText(n, x, y + 6); g.textAlign = 'left'; g.fillStyle = on ? '#2ee6a6' : '#ff4d5e'; g.font = '16px Arial'; g.fillText(on ? 'OK' : 'OFF', x - 12, y + 40); });
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText('HEART RATE', 740, 320); g.fillStyle = lock ? '#2ee6a6' : '#5b6781'; g.font = 'bold 92px "Segoe UI",Arial'; g.fillText(lock ? String(Math.round(bpm)) : '--', 740, 400); const wv = g.measureText(lock ? String(Math.round(bpm)) : '--').width; g.fillStyle = '#9aa7c7'; g.font = '24px "Segoe UI",Arial'; g.fillText('bpm', 750 + wv, 400);
    // bottom info
    g.fillStyle = '#16203a'; g.fillRect(28, 436, 968, 2);
    const info = (l, v, x, c) => { g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(l, x, 480); g.fillStyle = c || '#fff'; g.font = 'bold 40px "Segoe UI",Arial'; g.fillText(v, x, 528); };
    info('RHYTHM', lock ? (arr ? 'Irregular' : 'Regular') : '--', 28, lock ? (arr ? '#ffd23f' : '#2ee6a6') : '#5b6781'); info('R-R INTERVAL', lock ? Math.round(60000 / bpm) + ' ms' : '--', 300, '#fff'); info('SIGNAL', on ? (acq ? 'Settling' : 'Good') : 'None', 600, on ? '#2ee6a6' : '#ff4d5e'); info('NORMAL RANGE', '60–100', 810, '#4cc9f0');
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(on ? (acq ? 'Reading the heart signal from the electrodes…' : arr ? 'Fast, uncoordinated rhythm: an arrhythmia (like atrial fibrillation).' : 'Live ECG from the astronaut on the stretcher') : "Tap the astronaut to start monitoring the heart", 28, 590); g.textAlign = 'right'; g.fillText('● LIVE', 996, 590); g.textAlign = 'left';
    ptex.needsUpdate = true;
  }

  api.measure = function (hr, arr) { if (mon && !doneSent) return false; mon = { start: (performance.now() - t0) / 1000, hr, arr: !!arr, manual: false }; doneSent = false; lastBeat = -1; onPhase('start'); return true; };
  api.show = function (hr, arr) { mon = { start: (performance.now() - t0) / 1000 - 10, hr, arr: !!arr, manual: true }; doneSent = true; lastBeat = -1; };
  api.reset = function () { mon = null; doneSent = false; lastBeat = -1; };

  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    const t = (now - t0) / 1000; last = now;
    if (mon) {
      const el = t - mon.start;
      if (!doneSent && !mon.manual && el > 6) { doneSent = true; onDone(mon.hr, mon.arr); }
      if (el > 2.4) { let tw = t; if (mon.arr) tw += .22 * Math.sin(t * 2.3) + .15 * Math.sin(t * 5.1); const b = Math.floor(tw * mon.hr / 60 - .235); if (b !== lastBeat) { if (lastBeat !== -1) onPhase('beep'); lastBeat = b; } }
    }
    body.rotation.z = Math.sin(t * .6) * .0; ring.visible = !mon; ring.scale.setScalar(1 + Math.sin(t * 4) * .1); ring.material.opacity = .5 + Math.sin(t * 4) * .35;
    led.visible = mon ? (Math.floor(t * 4) % 2 === 0) : true;
    if (now - lastPanel > 50) { lastPanel = now; drawPanel(t); }
    const lv = mon && t - mon.start > 2.4 ? level(mon.hr, mon.arr) : -1; lamp.material.color.set(lv < 0 ? (mon ? 0xffd23f : 0x6f7c99) : [0x2ee6a6, 0xffd23f, 0xff4d5e][lv]);
    api._earth.rotation.y = t * .01;
    cam.position.x = Math.sin(t * .2) * .25 - .3 + drag.yaw * .6; cam.position.y = camBase.y + Math.sin(t * .27) * .04; cam.lookAt(.35, 1.55, 0);
    R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 3.1, needW = clamp(a * 3.7, 3.4, 6);
    cam.position.z = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)) - .2; cam.updateProjectionMatrix();
  }
  let body;
  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; getData = opts.getData || getData; level = opts.level || level; onPhase = opts.onPhase || onPhase; onDone = opts.onDone || onDone;
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
      const key = new T.DirectionalLight(0xfff2e0, 1.7); key.position.set(2, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const s = key.shadow.camera; s.left = -3.2; s.right = 3.2; s.top = 3; s.bottom = -3; s.near = 1; s.far = 20; key.shadow.bias = -.0004; key.target.position.set(0, 1, 0); scene.add(key, key.target);
      const rim = new T.DirectionalLight(0x9fd0ff, 1.0); rim.position.set(-6, 3, -8); scene.add(rim);
      const sl = new T.PointLight(0x4cc9f0, 1.2, 9); sl.position.set(2.2, 2.4, -2.2); scene.add(sl);
      room(); const bed = stretcher();
      // astronaut lying face-up, head to the left, feet to the right
      const lie = new T.Group(); lie.position.set(-.1 + .05, 0, .25); lie.rotation.y = Math.PI / 2; scene.add(lie);
      const A = B.makeAstronaut(lie, { bare: true }); body = A.body; body.rotation.x = -Math.PI / 2; body.position.set(0, 1.21, 0);
      A.shL.rotation.set(0, 0, -.14); A.shR.rotation.set(0, 0, .14); A.elL.rotation.x = -.1; A.elR.rotation.x = -.1;
      A.hipL.rotation.set(0, 0, -.05); A.hipR.rotation.set(0, 0, .05); A.kneeL.rotation.x = .06; A.kneeR.rotation.x = .06; A.ankleL.rotation.x = -.6; A.ankleR.rotation.x = -.6;
      lie.updateMatrixWorld(true); electrodes(body, bed);
      ring = new T.Mesh(new T.TorusGeometry(.34, .01, 8, 48), new T.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: .9 })); ring.position.set(0, .5, .12); body.add(ring);
      hit = new T.Mesh(new T.SphereGeometry(.55, 12, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.set(0, .45, .1); body.add(hit);
      const ray = new T.Raycaster(), mv = new T.Vector2(); let downX = 0, moved = 0;
      const over = e => { const r = canvas.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); return ray.intersectObject(hit, false).length > 0; };
      canvas.addEventListener('pointerdown', e => { drag.down = true; drag.x = downX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag.down) { canvas.style.cursor = over(e) ? 'pointer' : 'grab'; return; } moved = Math.max(moved, Math.abs(e.clientX - downX)); canvas.style.cursor = 'grabbing'; drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .008, -1.2, 1.2); drag.x = e.clientX; });
      canvas.addEventListener('pointerup', e => { const was = drag.down; drag.down = false; canvas.style.cursor = 'grab'; if (was && moved < 6 && over(e) && opts.onTap) opts.onTap(); });
      canvas.addEventListener('pointercancel', () => { drag.down = false; });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D heart-rate scene unavailable, using the 2D ECG instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false; }
  };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
})();
