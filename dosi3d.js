/* Radiation dosimeter in 3D (Three.js r149): the astronaut wears an EVARM-style digital dosimeter (status LED) and a white Radi-N2-style sphere sits on the wall.
   Normal day = calm window; solar storm = a bright Sun and "radiation rain" outside, beams crossing the cabin, amber light, fast-blinking LED and the astronaut
   hides next to the shielded wall. "Read dosimeter" raises a hand-held reader that scans the chest sensor; "Send to SpaceDoc" fires a data pulse to the console.
   Needs cabin3d.js + bike3d.js.   API: Dosi3d.init(stage,{getData,onRead}) · read() · send(cb) · reset() · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D, B = window.Bike3D;
  const api = { ready: false, failed: false };
  window.Dosi3d = api;
  if (!T || !C || !C.kit || !B || !B.makeAstronaut) { api.failed = true; return; }
  const K = C.kit, M = K.M, ctex = K.ctex, clamp = K.clamp, mesh = K.mesh;
  const V = (x, y, z) => new T.Vector3(x, y, z), lerp = (a, b, p) => a + (b - a) * p, ease = p => p * p * (3 - 2 * p), rnd = (a, b) => a + Math.random() * (b - a);
  const COL = [0x2ee6a6, 0xffd23f, 0xff4d5e], CSS = ['#2ee6a6', '#ffd23f', '#ff4d5e'];

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, getData = () => ({}), onRead = () => {};
  let t0 = performance.now(), last = 0, lastDraw = 0, drag = { yaw: 0, down: false, x: 0 }, camBase = { y: 1.9, z: 7 };
  let A, body, statusL, sunL, sunG, sunSprite, rain, rainPos, beams = [], dosi, led, reader, readBeam, radi, ring, pg, ptex, lamp, conCtx, conTex, port, shield, barrier, spark, hitD;
  let winTint, inside = false, face = .3, sk = 0, walk = 0, rd = null, snd = null, shelterK = 0, pulses = [];

  /* ---------- room ---------- */
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
    // the Sun outside the window (blazing during a storm)
    const sg = ctex(256, 256, (c, w, h) => { const gr = c.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(.18, 'rgba(255,214,120,.95)'); gr.addColorStop(.5, 'rgba(255,150,40,.35)'); gr.addColorStop(1, 'rgba(255,120,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    sunSprite = new T.Sprite(new T.SpriteMaterial({ map: sg, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); sunSprite.scale.set(34, 34, 1); sunSprite.position.set(-9, 5, -34); scene.add(sunSprite);
    sunL = new T.PointLight(0xffb040, 0, 12); sunL.position.set(-2.4, 2.4, -3.2); scene.add(sunL);
    // radiation rain (streaks falling outside the window)
    const N = 260, ps = new Float32Array(N * 6); rainPos = ps; for (let i = 0; i < N; i++) respawn(i);
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(ps, 3)); rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); rain.frustumCulled = false; scene.add(rain);
    // beams crossing the cabin
    for (let i = 0; i < 7; i++) { const b = new T.Mesh(new T.CylinderGeometry(.01, .01, 9, 6), new T.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); b.userData = { life: rnd(0, 2), dur: rnd(.6, 1.4) }; scene.add(b); beams.push(b); respawnBeam(b); }
    // shielded shelter wall (left): thick plates + water tanks
    // storm shelter: a booth with thick plated walls, a roof and a row of visible water tanks; a glass door closes when the crew is inside
    shield = new T.Group(); scene.add(shield);
    const plate = M({ color: 0x3a4666, roughness: .45, metalness: .7 }), dark = M({ color: 0x1a2133, roughness: .6, metalness: .6 });
    mesh(new T.BoxGeometry(1.75, 3.0, .35), plate, -3.55, 1.5, -2.17, shield);            // back wall
    mesh(new T.BoxGeometry(.3, 3.0, 1.95), plate, -2.85, 1.5, -1.2, shield);               // thick right wall
    mesh(new T.BoxGeometry(.3, 3.0, 1.95), plate, -4.4, 1.5, -1.2, shield);                // left wall
    mesh(new T.BoxGeometry(1.95, .3, 2.0), plate, -3.62, 3.1, -1.2, shield);               // roof
    mesh(new T.BoxGeometry(1.3, .06, 1.7), M({ color: 0x23304d, roughness: .8 }), -3.62, .04, -1.3, shield);   // floor mat
    for (let i = 0; i < 4; i++) mesh(new T.BoxGeometry(.04, 2.7, .02), dark, -3.2 - i * .3, 1.5, -1.98, shield);  // wall plating stripes
    const roofL = new T.Mesh(new T.BoxGeometry(1.0, .04, .12), new T.MeshBasicMaterial({ color: 0x9fe8ff })); roofL.position.set(-3.62, 2.92, -1.3); shield.add(roofL);
    // water tanks mounted on the right wall: glass shell + visible water + metal rings and caps
    for (let i = 0; i < 3; i++) {
      const z = -1.85 + i * .55, tk = new T.Group(); tk.position.set(-2.55, 1.5, z); shield.add(tk);
      mesh(new T.CylinderGeometry(.19, .19, 2.5, 24), new T.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: .22, roughness: .1, metalness: .1 }), 0, 0, 0, tk);
      const wm = new T.Mesh(new T.CylinderGeometry(.165, .165, 2.0, 24), new T.MeshStandardMaterial({ color: 0x2b8cff, transparent: true, opacity: .8, roughness: .15, emissive: 0x0a4a9a, emissiveIntensity: .7 })); wm.position.y = -.22; tk.add(wm);
      [-1.26, 1.26].forEach(y => mesh(new T.CylinderGeometry(.21, .21, .08, 24), M({ color: 0x9aa7c7, metalness: .9, roughness: .25 }), 0, y, 0, tk));
      [-.5, .3, 1.0].forEach(y => mesh(new T.TorusGeometry(.19, .012, 6, 24), M({ color: 0x9aa7c7, metalness: .9 }), 0, y, 0, tk).rotation.x = Math.PI / 2);
    }
    const sl = new T.Mesh(new T.PlaneGeometry(1.7, .22), new T.MeshBasicMaterial({ map: ctex(320, 42, (c, w, h) => { c.fillStyle = '#04101e'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd23f'; c.font = 'bold 26px Arial'; c.textAlign = 'center'; c.fillText('STORM SHELTER · WATER SHIELD', w / 2, 30); }), toneMapped: false })); sl.position.set(-3.62, 3.3, -.19); shield.add(sl);
    barrier = new T.Mesh(new T.BoxGeometry(1.3, 2.7, .04), new T.MeshStandardMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0, roughness: .05, emissive: 0x2ee6a6, emissiveIntensity: .35, depthWrite: false })); barrier.position.set(-3.62, 1.4, -.33); shield.add(barrier);   // glass door
    // window tint: the sky outside turns red while the storm lasts
    winTint = new T.Mesh(new T.PlaneGeometry(2.6, 2.4), new T.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); winTint.position.set(-2.1, 2.1, -3.45); scene.add(winTint);
    // Radi-N2 style detector: a white sphere on a wall bracket near the window
    radi = new T.Group(); radi.position.set(-.45, 2.4, -3.4); scene.add(radi);
    mesh(new T.BoxGeometry(.12, .3, .08), M({ color: 0x8d96a8, metalness: .9, roughness: .3 }), 0, 0, 0, radi); mesh(new T.CylinderGeometry(.03, .03, .3, 10), M({ color: 0x8d96a8, metalness: .9 }), 0, 0, .18, radi).rotation.x = Math.PI / 2;
    mesh(new T.SphereGeometry(.2, 40, 28), M({ color: 0xf6f8fc, roughness: .3, metalness: .1 }), 0, 0, .4, radi); ring = new T.Mesh(new T.TorusGeometry(.205, .008, 8, 48), new T.MeshStandardMaterial({ color: 0x001a14, emissive: 0x2ee6a6, emissiveIntensity: 1.4 })); ring.position.z = .4; radi.add(ring);
    const rl = new T.Mesh(new T.PlaneGeometry(.5, .08), new T.MeshBasicMaterial({ map: ctex(256, 40, (c, w, h) => { c.fillStyle = '#04101e'; c.fillRect(0, 0, w, h); c.fillStyle = '#4cc9f0'; c.font = 'bold 22px Arial'; c.textAlign = 'center'; c.fillText('Radi-N2 · NEUTRONS', w / 2, 27); }), toneMapped: false })); rl.position.set(0, -.32, .12); radi.add(rl);
    // wall panel + data console
    mesh(new T.BoxGeometry(3.9, 2.45, .14), M({ color: 0x151a28, roughness: .4, metalness: .8 }), 1.75, 2.75, bz + .05, scene);
    const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 640; pg = pc.getContext('2d'); ptex = new T.CanvasTexture(pc); ptex.encoding = T.sRGBEncoding; ptex.anisotropy = 4;
    const ps2 = new T.Mesh(new T.PlaneGeometry(3.6, 2.25), new T.MeshBasicMaterial({ map: ptex, toneMapped: false })); ps2.position.set(1.75, 2.75, bz + .13); scene.add(ps2);
    lamp = new T.Mesh(new T.BoxGeometry(3.6, .08, .06), new T.MeshBasicMaterial({ color: 0x6f7c99 })); lamp.position.set(1.75, 4.0, bz + .12); scene.add(lamp);
    mesh(new T.BoxGeometry(3.9, .9, .6), M({ color: 0x2a3042, roughness: .5, metalness: .6 }), 1.75, .45, bz + .45, scene);
    const cu = new T.Group(); cu.position.set(2.65, .95, -3.15); scene.add(cu);
    mesh(new T.BoxGeometry(.9, .6, .5), M({ color: 0x20242f, roughness: .45, metalness: .6 }), 0, .3, 0, cu); const cc = document.createElement('canvas'); cc.width = 384; cc.height = 256; conCtx = cc.getContext('2d'); conTex = new T.CanvasTexture(cc); conTex.encoding = T.sRGBEncoding;
    const cs = new T.Mesh(new T.PlaneGeometry(.62, .4), new T.MeshBasicMaterial({ map: conTex, toneMapped: false })); cs.position.set(-.08, .3, .256); cu.add(cs);
    const rg2 = mesh(new T.TorusGeometry(.1, .012, 10, 40), new T.MeshStandardMaterial({ color: 0x001018, emissive: 0x4cc9f0, emissiveIntensity: 1.4 }), 0, .68, 0, cu); rg2.rotation.x = Math.PI / 2; cu.updateMatrixWorld(true); port = cu.localToWorld(V(0, .7, 0));
  }
  function respawn(i) { const o = i * 6, x = rnd(-14, 6), z = rnd(-40, -5), y = rnd(-4, 14); rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x + .25; rainPos[o + 4] = y + .9; rainPos[o + 5] = z; }
  function respawnBeam(b) { const p = V(rnd(-3, 3), rnd(.8, 3.8), rnd(-3, 3)), d = V(rnd(-1, 1), rnd(-.3, .5), rnd(-1, 1)).normalize(); b.position.copy(p); b.quaternion.setFromUnitVectors(V(0, 1, 0), d); b.userData.life = 0; b.userData.dur = rnd(.5, 1.2); }

  /* ---------- astronaut + dosimeter + hand reader ---------- */
  function astronaut() {
    A = B.makeAstronaut(scene, { noChest: true }); body = A.body; body.position.set(-.5, 1.16, -.3); body.rotation.y = .3;
    dosi = new T.Group(); dosi.position.set(.1, .44, .235); body.add(dosi);      // EVARM-style digital dosimeter on the chest
    mesh(new T.BoxGeometry(.13, .09, .035), M({ color: 0x20242f, roughness: .4, metalness: .6 }), 0, 0, 0, dosi); mesh(new T.BoxGeometry(.1, .05, .006), new T.MeshBasicMaterial({ color: 0x04101e }), 0, .006, .02, dosi);
    const lab = new T.Mesh(new T.PlaneGeometry(.1, .04), new T.MeshBasicMaterial({ map: ctex(128, 48, (c, w, h) => { c.fillStyle = '#04101e'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd23f'; c.font = 'bold 26px Arial'; c.textAlign = 'center'; c.fillText('☢ EVARM', w / 2, 32); }), toneMapped: false })); lab.position.set(0, .004, .0235); dosi.add(lab);
    led = new T.Mesh(new T.SphereGeometry(.014, 12, 8), new T.MeshBasicMaterial({ color: 0x2ee6a6 })); led.position.set(.045, -.026, .022); dosi.add(led);
    hitD = new T.Mesh(new T.SphereGeometry(.2, 10, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hitD.position.set(0, 0, .05); dosi.add(hitD);
    reader = new T.Group(); scene.add(reader); mesh(new T.BoxGeometry(.06, .14, .03), M({ color: 0xe9edf5, roughness: .3, metalness: .3 }), 0, 0, 0, reader); mesh(new T.CylinderGeometry(.005, .005, .1, 6), M({ color: 0xc9d0dc, metalness: .9 }), .02, .1, 0, reader);
    mesh(new T.BoxGeometry(.045, .03, .004), new T.MeshBasicMaterial({ color: 0x4cc9f0 }), 0, .03, .017, reader); reader.visible = false;
    readBeam = new T.Mesh(new T.ConeGeometry(.07, 1, 24, 1, true), new T.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); scene.add(readBeam);
    for (let i = 0; i < 10; i++) { const s = new T.Mesh(new T.SphereGeometry(.016, 8, 6), new T.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); s.visible = false; scene.add(s); pulses.push(s); }
  }

  /* ---------- screen ---------- */
  const xray = d => d == null ? '--' : '≈ ' + Math.round(d / .1) + ' chest X-rays';
  function drawPanel(d, t) {
    const g = pg, w = 1024, h = 640, lv = d.lv == null ? 0 : d.lv, col = CSS[lv], storm = !!d.storm, dose = d.dose, shown = dose == null ? null : dose * clamp((t - (rd ? rd.tDone : 0)) * 1.4, 0, 1);
    g.fillStyle = '#04091a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,170,60,.10)'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#ffd23f'; g.font = 'bold 32px "Segoe UI",Arial'; g.fillText('☢ RADIATION MONITOR', 28, 48);
    g.fillStyle = storm ? '#ff9a3a' : '#2ee6a6'; g.beginPath(); g.roundRect ? g.roundRect(640, 12, 356, 46, 23) : g.rect(640, 12, 356, 46); g.fill(); g.fillStyle = '#04091a'; g.font = 'bold 24px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(storm ? (d.sheltered ? '☀ STORM · IN SHELTER' + (d.stormLeft != null ? ' · ' + Math.ceil(d.stormLeft) + ' s' : '') : '☀ SOLAR STORM · GET IN!') : 'NORMAL DAY', 818, 44); g.textAlign = 'left';
    // semicircular gauge
    const cx = 250, cy = 330, r = 170; g.lineWidth = 30; g.lineCap = 'butt'; [[0, 1 / 3, '#2ee6a6'], [1 / 3, 2 / 3, '#ffd23f'], [2 / 3, 1, '#ff4d5e']].forEach(([a, b, c]) => { g.strokeStyle = c; g.beginPath(); g.arc(cx, cy, r, Math.PI + Math.PI * a, Math.PI + Math.PI * b); g.stroke(); });
    const frac = shown == null ? 0 : clamp(shown * 30 / (250 * 1.5), 0, 1), ang = Math.PI + Math.PI * frac; g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ang) * (r - 8), cy + Math.sin(ang) * (r - 8)); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 14, 0, 7); g.fill();
    g.fillStyle = dose == null ? '#5b6781' : col; g.font = 'bold 96px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(shown == null ? '0.00' : shown.toFixed(2), cx, cy + 110); g.fillStyle = '#9aa7c7'; g.font = '26px "Segoe UI",Arial'; g.fillText('mSv today', cx, cy + 148); g.textAlign = 'left';
    const box = (x, y, wd, title, line, sub, c) => { g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.roundRect ? g.roundRect(x, y, wd, 124, 14) : g.rect(x, y, wd, 124); g.fill(); g.fillStyle = '#9aa7c7'; g.font = '21px "Segoe UI",Arial'; g.fillText(title, x + 16, y + 32); g.fillStyle = c; g.font = 'bold 40px "Segoe UI",Arial'; g.fillText(line, x + 16, y + 80); g.fillStyle = '#9aa7c7'; g.font = '19px "Segoe UI",Arial'; g.fillText(sub, x + 16, y + 108); };
    box(520, 90, 476, 'In 30 days', shown == null ? '-- mSv' : (shown * 30).toFixed(0) + ' mSv', 'NASA limit: 250 mSv · career 600 mSv', dose == null ? '#5b6781' : col); box(520, 230, 476, 'A chest X-ray ≈ 0.1 mSv', shown == null ? '--' : xray(shown), 'you received', '#fff');
    box(520, 370, 476, 'Normal dose here', (d.envRad || .6) + ' mSv/day', d.env || '', '#4cc9f0');
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(dose == null ? 'Tap the dosimeter on the astronaut (or "Read dosimeter") to scan.' : lv === 0 ? 'Safe dose. The ship and the suit protect you.' : lv === 1 ? 'High dose. Stay in the protected areas.' : 'Dangerous dose! Everyone to the shelter!', 28, 600);
    ptex.needsUpdate = true;
    const c = conCtx; c.fillStyle = '#04101e'; c.fillRect(0, 0, 384, 256); c.fillStyle = '#4cc9f0'; c.font = 'bold 24px Arial'; c.fillText('SPACEDOC · RADIATION LOG', 12, 30); c.fillStyle = '#fff'; c.font = 'bold 56px Arial'; c.fillText(dose == null ? '--' : dose.toFixed(2), 12, 110); c.fillStyle = '#9aa7c7'; c.font = '22px Arial'; c.fillText('mSv', 170, 110); c.fillStyle = snd ? '#ffd23f' : d.logged ? '#2ee6a6' : '#5b6781'; c.font = 'bold 24px Arial'; c.fillText(snd ? 'RECEIVING DATA…' : d.logged ? 'EXPOSURE LOGGED ✔' : 'WAITING FOR DATA', 12, 160); conTex.needsUpdate = true;
  }

  /* ---------- actions ---------- */
  api.read = function () { rd = { t: (performance.now() - t0) / 1000, tDone: (performance.now() - t0) / 1000 + .9 }; };
  api.send = function (cb) { if (snd) return; snd = { t: 0, cb }; };
  api.reset = function () { rd = null; snd = null; };
  api.inShelter = function () { return !!inside; };

  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    const t = (now - t0) / 1000, dt = Math.min(.1, (now - (last || now)) / 1000); last = now; const d = getData() || {}, storm = !!d.storm, sh = !!d.sheltered;
    sk += ((storm ? 1 : 0) - sk) * Math.min(1, dt * 1.6); shelterK += ((storm && sh ? 1 : 0) - shelterK) * Math.min(1, dt * 2);
    // outside: Sun + radiation rain; inside: amber alert light + beams
    sunSprite.material.opacity = sk * (.85 + .15 * Math.sin(t * 7)); sunL.intensity = sk * (2.2 + .6 * Math.sin(t * 9)); rain.material.opacity = sk * .85;
    const pa = rain.geometry.attributes.position; for (let i = 0; i < 260; i++) { const o = i * 6, v = (14 + (i % 6)) * dt * (.3 + sk); for (let k = 0; k < 2; k++) { rainPos[o + k * 3] += 0; } rainPos[o + 1] -= v * 1.2; rainPos[o + 4] -= v * 1.2; rainPos[o] -= v * .35; rainPos[o + 3] -= v * .35; if (rainPos[o + 1] < -6) respawn(i); } pa.needsUpdate = true;
    beams.forEach(b => { const u = b.userData; u.life += dt; if (u.life > u.dur) respawnBeam(b); const a = Math.sin(clamp(u.life / u.dur, 0, 1) * Math.PI); b.material.opacity = sk * .55 * a * (1 - .9 * shelterK) * (Math.random() < .03 ? 0 : 1); });
    statusL.color.setHex(storm ? 0xffa030 : 0x6fb4ff); statusL.intensity = storm ? 1.1 + .6 * Math.sin(t * 8) : .8;
    // dosimeter LED: green normally, amber-fast blink in a storm (red if the reading is dangerous)
    const lv = d.lv == null ? 0 : d.lv, blink = storm || lv === 2 ? (Math.sin(t * 16) > 0) : lv === 1 ? (Math.sin(t * 5) > 0) : true; led.material.color.setHex(storm && lv < 2 ? (blink ? 0xffa030 : 0x2a1500) : (blink ? COL[lv] : 0x103020));
    ring.material.emissive.setHex(storm ? 0xffa030 : 0x2ee6a6); ring.material.emissiveIntensity = storm ? 1 + Math.sin(t * 12) * .8 : 1.4; barrier.material.opacity = (inside ? .32 : 0) + (inside ? .06 * Math.sin(t * 3) : 0);
    winTint.material.opacity = sk * (.34 + .06 * Math.sin(t * 5)); sunSprite.material.color.setHex(0xff6a3a); rain.material.color.setHex(0xff5a3a);
    // astronaut: stands in the cabin, or walks to the shield wall and braces during the storm
    // walks to the shelter door, then inside (and back out again the same way)
    const want = storm && sh, home = V(-.5, 1.16, -.3), door = V(-3.62, 1.16, .15), inn = V(-3.62, 1.16, -1.3), bp = body.position;
    const tgt = want ? (bp.x < -3.3 ? inn : door) : (bp.z < -.5 ? door : home);
    const dx = tgt.x - bp.x, dz = tgt.z - bp.z, dist = Math.hypot(dx, dz), moving = dist > .06, step = Math.min(dist, dt * 1.9);
    if (moving) { bp.x += dx / dist * step; bp.z += dz / dist * step; face = lerp(face, Math.atan2(dx, dz), .12); }
    else face = lerp(face, want ? 0 : .3 + Math.sin(t * .4) * .04, .08);
    inside = want && !moving && tgt === inn;
    const ws = moving ? Math.sin(t * 8) * .5 : 0; A.hipL.rotation.x = ws; A.hipR.rotation.x = -ws; A.kneeL.rotation.x = Math.max(0, -ws) * .8; A.kneeR.rotation.x = Math.max(0, ws) * .8;
    const hide = inside; body.rotation.set(hide ? .22 : 0, face, 0);
    if (hide) { A.shL.rotation.set(-2.5, 0, -.3); A.shR.rotation.set(-2.5, 0, .3); A.elL.rotation.set(-1.4, 0, 0); A.elR.rotation.set(-1.4, 0, 0); A.hipL.rotation.x = -.5; A.hipR.rotation.x = -.5; A.kneeL.rotation.x = .9; A.kneeR.rotation.x = .9; body.position.y = 1.0; }
    else { A.shL.rotation.set(Math.sin(t * .9) * .05 + (moving ? -ws * .6 : 0), 0, -.14); A.elL.rotation.set(-.15, 0, 0); A.shR.rotation.set(Math.sin(t * .9 + 1) * .05 + (moving ? ws * .6 : 0), 0, .14); A.elR.rotation.set(-.15, 0, 0); body.position.y = 1.16 + Math.sin(t * 1.1) * .005; }
    // reading: the right hand raises a hand-held reader to the chest sensor and a beam scans it
    reader.visible = false; readBeam.material.opacity = 0; let u = rd ? (t - rd.t) / 1.0 : 2;
    if (rd && u < 1.4 && !hide) { const up = u < .25 ? ease(u / .25) : u > 1.15 ? 1 - ease((u - 1.15) / .25) : 1; A.shR.rotation.set(-.9 * up, 0, .15 + .1 * up); A.elR.rotation.set(-1.9 * up - .15, 0, 0);
      body.updateMatrixWorld(true); const hand = A.elR.localToWorld(V(0, -.46, .02)), dp = dosi.getWorldPosition(V(0, 0, 0)); reader.visible = true; reader.position.copy(hand); reader.lookAt(dp); reader.rotateX(Math.PI / 2);
      const dir = dp.clone().sub(hand), len = dir.length(); readBeam.position.copy(hand).addScaledVector(dir, .5); readBeam.scale.set(1, len, 1); readBeam.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize().negate()); readBeam.material.opacity = (u > .25 && u < 1.15) ? .35 + .2 * Math.sin(t * 30) : 0; }
    // data pulse to the SpaceDoc console
    pulses.forEach(p => p.visible = false); if (snd) { snd.t += dt; const dp = dosi.getWorldPosition(V(0, 0, 0)); pulses.forEach((p, i) => { const k = snd.t * .9 - i * .07; p.visible = k > 0 && k < 1; if (p.visible) { const m = dp.clone().lerp(port, .5).add(V(0, .9, .4)); p.position.set(lerp(lerp(dp.x, m.x, k), lerp(m.x, port.x, k), k), lerp(lerp(dp.y, m.y, k), lerp(m.y, port.y, k), k), lerp(lerp(dp.z, m.z, k), lerp(m.z, port.z, k), k)); } }); if (snd.t > 1.5) { const cb = snd.cb; snd = null; if (cb) cb(); } }
    lamp.material.color.setHex(storm ? 0xffa030 : COL[lv]);
    if (now - lastDraw > 70) { lastDraw = now; drawPanel(d, t); }
    api._earth.rotation.y = t * .01;
    cam.position.x = Math.sin(t * .2) * .25 - .8 + drag.yaw * .6; cam.position.y = camBase.y + Math.sin(t * .27) * .04; cam.lookAt(-.8, 1.5, -.8);
    R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 3.5, needW = clamp(a * 5.8, 4.6, 10);
    camBase.z = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)) + .4; cam.position.z = camBase.z; cam.updateProjectionMatrix();
  }

  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; getData = opts.getData || getData; onRead = opts.onRead || onRead;
    try {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab'; stage.insertBefore(canvas, stage.firstChild);
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02040c); cam = new T.PerspectiveCamera(38, 1, .1, 400); cam.position.set(.3, camBase.y, camBase.z);
      const envS = new T.Scene(); envS.background = new T.Color(0x0a1226);
      [[6, 3, 0, 6, 0, 0xffffff, 6], [4, 4, -7, 2, 2, 0xcfe6ff, 4], [4, 2, 6, 1, -4, 0xffd9a0, 3], [8, 3, 0, -6, 0, 0x4cc9f0, 1.2], [5, 5, 0, 2, -8, 0x2b6fd6, 1.5]].forEach(([w, h, x, y, z, c, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); });
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(envS, .02).texture; pm.dispose();
      scene.add(new T.HemisphereLight(0xbfd8ff, 0x2a2f44, .6));
      const key = new T.DirectionalLight(0xfff2e0, 1.5); key.position.set(2.5, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const s = key.shadow.camera; s.left = -4; s.right = 4; s.top = 4; s.bottom = -2; s.near = 1; s.far = 22; key.shadow.bias = -.0004; key.target.position.set(-.5, 1, -.5); scene.add(key, key.target);
      const rim = new T.DirectionalLight(0x9fd0ff, .9); rim.position.set(-6, 3, -8); scene.add(rim); statusL = new T.PointLight(0x6fb4ff, .8, 9); statusL.position.set(0, 3.2, 1); scene.add(statusL);
      room(); astronaut();
      const ray = new T.Raycaster(), mv = new T.Vector2(); let downX = 0, moved = 0;
      const over = e => { const r = canvas.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); return ray.intersectObject(hitD, false).length > 0; };
      canvas.addEventListener('pointerdown', e => { drag.down = true; drag.x = downX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag.down) { canvas.style.cursor = over(e) ? 'pointer' : 'grab'; return; } moved = Math.max(moved, Math.abs(e.clientX - downX)); canvas.style.cursor = 'grabbing'; drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .008, -1.3, 1.3); drag.x = e.clientX; });
      canvas.addEventListener('pointerup', e => { const was = drag.down; drag.down = false; canvas.style.cursor = 'grab'; if (was && moved < 6 && over(e)) onRead(); });
      canvas.addEventListener('pointercancel', () => { drag.down = false; });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D radiation scene unavailable, using the 2D scene instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false; }
  };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
})();
