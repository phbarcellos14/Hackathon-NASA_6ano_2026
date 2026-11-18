/* Phase 6 · Therapy in 3D (Three.js r149): same navy cabin, Earth window and free camera.
   Isolation: cold blue light, sad face on the helmet visor, laptop on standby, a blue flash drive floats in microgravity.
   Drag (or tap / press U / Enter) the flash drive into the blinking cyan USB port -> REC video call with the team on Earth, the light warms up,
   photos glow, the visor smile grows and the shoulders relax. When the session ends the drive blinks green (saved).
   Needs cabin3d.js + bike3d.js.   API: Therapy3d.init(stage,{getData,onPlug}) · plug(durationSec) · reset() · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D, B = window.Bike3D;
  const api = { ready: false, failed: false };
  window.Therapy3d = api;
  if (!T || !C || !C.kit || !B || !B.makeAstronaut) { api.failed = true; return; }
  const K = C.kit, M = K.M, ctex = K.ctex, clamp = K.clamp, mesh = K.mesh;
  const V = (x, y, z) => new T.Vector3(x, y, z), lerp = (a, b, p) => a + (b - a) * p, ease = p => p * p * (3 - 2 * p);
  const COLD = new T.Color(0x6f9cff), WARM = new T.Color(0xffc890), COLD2 = new T.Color(0x2a3a66), WARM2 = new T.Color(0x6a4a30);

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, getData = () => ({}), onPlug = () => {};
  let t0 = performance.now(), last = 0, lastDraw = 0, drag = { yaw: 0, down: false, x: 0 }, camBase = { y: 1.9, z: 7 };
  let A, body, hemi, key, warmL, alertL, beacon, faceCtx, faceTex, lapCtx, lapTex, usb, usbLed, usbBody, portRing, portPos, photos = [], earth;
  let objHits = [], clockCtx, clockTex, moodCtx, moodTex, moodRing, tabCtx, tabTex, plantG, bagG, onObj = () => {}, bump = {}, sess = null, plugAnim = null, dragging = null, dragOff = V(0, 0, 0), warm = 0, ledBlink = 0, moodK = 0, startPos = V(0.35, 1.85, -2.15), hitUsb;

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
    eg.position.set(-14, -9, -40); scene.add(eg); earth = eg;
    [-2, 2].forEach(x => mesh(new T.BoxGeometry(.5, .06, 14), new T.MeshBasicMaterial({ color: 0xffffff }), x, 4.94, 2, scene));
    // bench + laptop
    mesh(new T.BoxGeometry(2.6, 1.0, .9), M({ color: 0x2a3042, roughness: .5, metalness: .6 }), 2.2, .5, -3.05, scene);
    mesh(new T.BoxGeometry(2.7, .06, .95), M({ color: 0x3a4666, roughness: .35, metalness: .7 }), 2.2, 1.03, -3.05, scene);
    const lap = new T.Group(); lap.position.set(2.2, 1.06, -2.9); scene.add(lap);
    mesh(new T.BoxGeometry(1.0, .05, .66), M({ color: 0x20242f, roughness: .4, metalness: .7 }), 0, .025, 0, lap);
    const kb = new T.Mesh(new T.PlaneGeometry(.84, .38), new T.MeshBasicMaterial({ map: ctex(256, 112, (c, w, h) => { c.fillStyle = '#0d1018'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b3246'; for (let r = 0; r < 4; r++) for (let q = 0; q < 12; q++) c.fillRect(8 + q * 20, 8 + r * 24, 16, 18); }) })); kb.rotation.x = -Math.PI / 2; kb.position.set(0, .052, .06); lap.add(kb);
    const sc = new T.Group(); sc.position.set(0, .05, -.3); sc.rotation.x = -.28; lap.add(sc);
    mesh(new T.BoxGeometry(1.0, .64, .04), M({ color: 0x20242f, roughness: .4, metalness: .7 }), 0, .32, 0, sc);
    const lc = document.createElement('canvas'); lc.width = 768; lc.height = 480; lapCtx = lc.getContext('2d'); lapTex = new T.CanvasTexture(lc); lapTex.encoding = T.sRGBEncoding; lapTex.anisotropy = 4;
    const lp = new T.Mesh(new T.PlaneGeometry(.92, .575), new T.MeshBasicMaterial({ map: lapTex, toneMapped: false })); lp.position.set(0, .32, .022); sc.add(lp);
    // USB port on the right side of the laptop (cyan outline blinks)
    mesh(new T.BoxGeometry(.03, .022, .06), M({ color: 0x050608 }), .505, .045, .05, lap);
    portRing = new T.Mesh(new T.BoxGeometry(.035, .05, .1), new T.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: .8, blending: T.AdditiveBlending, depthWrite: false })); portRing.position.set(.51, .045, .05); lap.add(portRing);
    lap.updateMatrixWorld(true); portPos = lap.localToWorld(V(.5, .045, .05));
    // family / friends photos stuck with velcro next to the monitor
    const PH = [['#ffb3a0', '#ffd23f'], ['#9ad7c8', '#4cc9f0'], ['#ffc890', '#ff9a8b'], ['#cdb4ff', '#ffd9a0']];
    PH.forEach((cl, i) => {
      const gp = new T.Group(); gp.position.set(.9 + i * .78, 2.55 + (i % 2) * .5, bz + .03); gp.rotation.z = (i - 1.5) * .06; scene.add(gp);
      mesh(new T.BoxGeometry(.6, .46, .02), M({ color: 0xf2ecdf, roughness: .6 }), 0, 0, 0, gp);
      const pm = new T.MeshBasicMaterial({ map: ctex(192, 140, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, cl[0]); gr.addColorStop(1, cl[1]); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(40,30,50,.85)'; [[60, 80, 20], [100, 74, 22], [138, 84, 17]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y - 22, r * .7, 0, 7); c.fill(); c.fillRect(x - r * .8, y - 10, r * 1.6, 56); }); c.fillStyle = '#fff'; c.beginPath(); c.arc(160, 26, 10, 0, 7); c.fill(); }), color: 0x555a6a, toneMapped: false }); const pl = new T.Mesh(new T.PlaneGeometry(.52, .38), pm); pl.position.z = .012; gp.add(pl); photos.push(pm);
      [-.28, .28].forEach(x => mesh(new T.BoxGeometry(.07, .03, .012), M({ color: 0x777c88, roughness: .9 }), x, .2, .014, gp));
    });
    // emergency beacon (only visible on an Emergency match until the session calms things down)
    beacon = new T.Group(); beacon.position.set(3.85, 3.9, bz + .08); scene.add(beacon);
    mesh(new T.CylinderGeometry(.09, .11, .08, 16), M({ color: 0x333a4a, metalness: .8 }), 0, 0, 0, beacon).rotation.x = Math.PI / 2;
    beacon.userData.lens = mesh(new T.SphereGeometry(.09, 16, 12), new T.MeshStandardMaterial({ color: 0x300008, emissive: 0xff2040, emissiveIntensity: 0 }), 0, 0, .06, beacon);
    alertL = new T.PointLight(0xff2040, 0, 7); alertL.position.set(3.8, 3.7, -2.9); scene.add(alertL);
  }

  /* ---------- astronaut with an LED face on the visor ---------- */
  function astronaut() {
    A = B.makeAstronaut(scene, { noChest: false }); body = A.body; body.position.set(-1.75, 1.16, -2.0); body.rotation.y = .55;
    const fc = document.createElement('canvas'); fc.width = 192; fc.height = 128; faceCtx = fc.getContext('2d'); faceTex = new T.CanvasTexture(fc); faceTex.encoding = T.sRGBEncoding;
    const fp = new T.Mesh(new T.PlaneGeometry(.3, .2), new T.MeshBasicMaterial({ map: faceTex, transparent: true, toneMapped: false, depthWrite: false })); fp.position.set(0, .9, .318); body.add(fp);
  }
  function drawFace(m, t) {
    const c = faceCtx, w = 192, h = 128; c.clearRect(0, 0, w, h);
    const col = m < .5 ? '#7fb2ff' : m < .85 ? '#ffe3a8' : '#ffd23f'; c.strokeStyle = col; c.fillStyle = col; c.lineCap = 'round'; c.shadowColor = col; c.shadowBlur = 10;
    const blink = (t % 4.5) < .12 ? .15 : 1, ey = 50 + (1 - m) * 8; c.lineWidth = 8;
    [58, 134].forEach(x => { c.beginPath(); if (m > .75) { c.arc(x, ey + 6, 14, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } else { c.ellipse(x, ey, 9, 12 * blink, 0, 0, 7); c.fill(); } });
    if (m < .5) { c.lineWidth = 6; c.beginPath(); c.moveTo(40, 30 + (1 - m) * 4); c.lineTo(72, 24 - (1 - m) * 6); c.moveTo(152, 30 + (1 - m) * 4); c.lineTo(120, 24 - (1 - m) * 6); c.stroke(); }   // worried brows
    c.lineWidth = 8; c.beginPath(); const my = 98, bend = lerp(-18, 20, m); c.moveTo(66, my - bend * .2); c.quadraticCurveTo(96, my + bend * 1.6, 126, my - bend * .2); c.stroke();
    if (m < .4) { c.shadowBlur = 0; c.fillStyle = 'rgba(160,210,255,.9)'; const k = (t * .6) % 1; c.beginPath(); c.ellipse(154, 70 + k * 30, 5, 8, 0, 0, 7); c.fill(); }   // tear
    c.shadowBlur = 0; faceTex.needsUpdate = true;
  }

  /* ---------- flash drive ---------- */
  function flash() {
    usb = new T.Group(); scene.add(usb);
    usbBody = mesh(new T.BoxGeometry(.2, .07, .045), new T.MeshStandardMaterial({ color: 0x2a74ff, roughness: .3, metalness: .4, emissive: 0x0a2a66, emissiveIntensity: .5 }), 0, 0, 0, usb);
    mesh(new T.BoxGeometry(.09, .045, .028), M({ color: 0xcfd6e4, metalness: .95, roughness: .2 }), .145, 0, 0, usb);
    mesh(new T.BoxGeometry(.02, .02, .03), M({ color: 0x111 }), .17, 0, 0, usb);
    usbLed = new T.Mesh(new T.SphereGeometry(.014, 12, 8), new T.MeshBasicMaterial({ color: 0x2ee6a6 })); usbLed.position.set(-.06, .037, 0); usb.add(usbLed);
    hitUsb = new T.Mesh(new T.SphereGeometry(.26, 10, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); usb.add(hitUsb);
    usb.scale.setScalar(1.6); usb.position.copy(startPos);
  }

  /* ---------- Questionnaire & Logbook items inside the navy cabin: orbit clock, sleeping bag, mood mirror, mini greenhouse, logbook tablet ---------- */
  const EMO = ['😢', '😟', '😐', '🙂', '😄'], MOODC = [0xffa95c, 0xffc27a, 0x9ad7c8, 0x8fe39a, 0x7af0b0];
  const colS = h => h >= 7 ? '#2ee6a6' : h >= 5 ? '#ffd23f' : '#ff4d5e', colR = v => v <= 4 ? '#2ee6a6' : v <= 7 ? '#ffd23f' : '#ff4d5e';
  function hitOf(g, r, kind, y) { const h = mesh(new T.SphereGeometry(r, 8, 6), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 0, y || 0, 0, g); h.userData.kind = kind; objHits.push(h); }
  function quizItems() {
    const bz = -3.6;
    // sleeping bag strapped to the wall + orbit clock (tap: +1 h of sleep)
    bagG = new T.Group(); bagG.position.set(-3.95, 1.55, bz + .3); scene.add(bagG);
    const bagMat = M({ map: ctex(256, 512, (c, w, h) => { c.fillStyle = '#8c7bc2'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; for (let y = 20; y < h; y += 56) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } for (let x = 0; x < w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } c.fillStyle = '#efe6d6'; c.fillRect(w / 2 - 3, 30, 6, h - 60); }), roughness: .9 });
    const bm = new T.Mesh(new T.CapsuleGeometry(.3, 1.15, 10, 24), bagMat); bm.scale.z = .55; bm.castShadow = true; bagG.add(bm);
    [-.45, .05, .55].forEach(y => { mesh(new T.BoxGeometry(.7, .06, .08), M({ color: 0xe8a15a, roughness: .6 }), 0, y, .17, bagG); mesh(new T.BoxGeometry(.09, .08, .03), M({ color: 0xc9d0dc, metalness: .9, roughness: .3 }), .12, y, .21, bagG); });
    const clk = new T.Group(); clk.position.set(-3.95, 3.15, bz + .06); scene.add(clk);
    mesh(new T.CylinderGeometry(.21, .21, .05, 40), M({ color: 0x8a5f3c, roughness: .55 }), 0, 0, 0, clk).rotation.x = Math.PI / 2;
    const cc = document.createElement('canvas'); cc.width = 256; cc.height = 256; clockCtx = cc.getContext('2d'); clockTex = new T.CanvasTexture(cc); clockTex.encoding = T.sRGBEncoding;
    const cf = new T.Mesh(new T.CircleGeometry(.185, 40), new T.MeshBasicMaterial({ map: clockTex, toneMapped: false })); cf.position.z = .03; clk.add(cf); hitOf(clk, .3, 'clock'); clk.userData.k = 'clock'; bump.clock = clk;
    // mood mirror with a mood-coloured LED ring + emoji display (tap: change mood)
    const mir = new T.Group(); mir.position.set(-.15, 2.28, bz + .03); scene.add(mir); bump.mood = mir;
    mesh(new T.TorusGeometry(.36, .03, 14, 48), M({ color: 0xc9a24a, metalness: .9, roughness: .3 }), 0, 0, .01, mir);
    moodRing = new T.MeshStandardMaterial({ color: 0x102018, emissive: 0x9ad7c8, emissiveIntensity: 1.4 }); mesh(new T.TorusGeometry(.325, .012, 10, 48), moodRing, 0, 0, .02, mir);
    const mt = ctex(256, 256, (c, w, h) => { const gr = c.createRadialGradient(100, 90, 10, 128, 128, 130); gr.addColorStop(0, '#f4f9ff'); gr.addColorStop(.5, '#b9cbe0'); gr.addColorStop(1, '#6f86a3'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(40, 220); c.lineTo(90, 30); c.lineTo(125, 30); c.lineTo(78, 220); c.fill(); });
    mesh(new T.CircleGeometry(.31, 48), new T.MeshStandardMaterial({ map: mt, metalness: .95, roughness: .06 }), 0, 0, .022, mir);
    const md = document.createElement('canvas'); md.width = 512; md.height = 160; moodCtx = md.getContext('2d'); moodTex = new T.CanvasTexture(md); moodTex.encoding = T.sRGBEncoding;
    mesh(new T.BoxGeometry(.78, .24, .03), M({ color: 0x2a2018, roughness: .5, metalness: .4 }), 0, -.62, 0, mir); const mdp = new T.Mesh(new T.PlaneGeometry(.74, .2), new T.MeshBasicMaterial({ map: moodTex, toneMapped: false })); mdp.position.set(0, -.62, .017); mir.add(mdp);
    hitOf(mir, .5, 'mood', -.2);
    // mini greenhouse on the bench (tap: -1 stress)
    const gh = new T.Group(); gh.position.set(1.15, 1.06, -3.05); scene.add(gh); bump.plant = gh;
    const fm = M({ color: 0xd7dce8, metalness: .9, roughness: .3 });
    mesh(new T.BoxGeometry(.4, .03, .3), fm, 0, .015, 0, gh); mesh(new T.BoxGeometry(.38, .09, .28), M({ color: 0x4a2f1c, roughness: 1 }), 0, .075, 0, gh);
    [[-.19, -.14], [.19, -.14], [-.19, .14], [.19, .14]].forEach(([x, z]) => mesh(new T.BoxGeometry(.02, .38, .02), fm, x, .2, z, gh)); mesh(new T.BoxGeometry(.4, .02, .3), fm, 0, .39, 0, gh);
    mesh(new T.BoxGeometry(.34, .014, .04), new T.MeshStandardMaterial({ color: 0x220033, emissive: 0xb066ff, emissiveIntensity: 1.6 }), 0, .375, .08, gh);
    const gl = new T.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: .16, roughness: .05, depthWrite: false });
    mesh(new T.BoxGeometry(.38, .34, .005), gl, 0, .2, .145, gh).castShadow = false; mesh(new T.BoxGeometry(.005, .34, .28), gl, -.195, .2, 0, gh).castShadow = false; mesh(new T.BoxGeometry(.005, .34, .28), gl, .195, .2, 0, gh).castShadow = false;
    plantG = new T.Group(); plantG.position.set(0, .12, 0); gh.add(plantG);
    mesh(new T.CylinderGeometry(.006, .01, .2, 8), M({ color: 0x3d8b3d, roughness: .8 }), 0, .1, 0, plantG);
    for (let i = 0; i < 7; i++) { const a = i * 2.4, y = .06 + i * .026, l = mesh(new T.SphereGeometry(.035, 12, 8), M({ color: i % 2 ? 0x4fbf5a : 0x2f9d4a, roughness: .7 }), Math.cos(a) * .045, y, Math.sin(a) * .045, plantG); l.scale.set(1.5, .25, .8); l.rotation.y = -a; l.rotation.z = .3; }
    mesh(new T.SphereGeometry(.016, 10, 8), new T.MeshStandardMaterial({ color: 0xff7ab8, emissive: 0xff3c8a, emissiveIntensity: .5 }), 0, .215, 0, plantG);
    hitOf(gh, .3, 'plant', .2);
    // logbook tablet on the bench (tap: change mood)
    const tb = new T.Group(); tb.position.set(3.05, 1.12, -2.85); tb.rotation.x = -.5; scene.add(tb); bump.tablet = tb;
    mesh(new T.BoxGeometry(.36, .25, .02), M({ color: 0x20242f, roughness: .4, metalness: .7 }), 0, 0, 0, tb);
    const tcv = document.createElement('canvas'); tcv.width = 512; tcv.height = 352; tabCtx = tcv.getContext('2d'); tabTex = new T.CanvasTexture(tcv); tabTex.encoding = T.sRGBEncoding;
    const tsc = new T.Mesh(new T.PlaneGeometry(.33, .227), new T.MeshBasicMaterial({ map: tabTex, toneMapped: false })); tsc.position.z = .0115; tb.add(tsc); hitOf(tb, .26, 'tablet');
  }
  function drawQuiz(d, t) {
    const v = { sleep: d.sleep == null ? 6 : d.sleep, stress: d.stress == null ? 5 : d.stress, iso: d.iso == null ? 5 : d.iso, mood: clamp(d.mood == null ? 3 : d.mood, 1, 5) };
    // orbit clock
    const c = clockCtx, a = (t / 9) * Math.PI * 2, day = (Math.sin(a) + 1) / 2; c.setTransform(1, 0, 0, 1, 0, 0);
    const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, `rgb(${Math.round(18 + 230 * day)},${Math.round(22 + 170 * day)},${Math.round(60 + 90 * day)})`); gr.addColorStop(1, `rgb(${Math.round(10 + 120 * day)},${Math.round(12 + 90 * day)},${Math.round(40 + 70 * day)})`); c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
    c.translate(128, 128); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 98, 0, 7); c.stroke(); c.fillStyle = '#ffd86b'; c.beginPath(); c.arc(Math.cos(a) * 98, -Math.sin(a) * 98, 15, 0, 7); c.fill(); c.fillStyle = '#e8eefc'; c.beginPath(); c.arc(-Math.cos(a) * 98, Math.sin(a) * 98, 11, 0, 7); c.fill();
    c.strokeStyle = colS(v.sleep); c.lineWidth = 12; c.beginPath(); c.arc(0, 0, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(v.sleep / 12, 0, 1)); c.stroke();
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#fff'; c.font = 'bold 46px Arial'; c.textAlign = 'center'; c.fillText(v.sleep + ' h', 128, 140); c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '20px Arial'; c.fillText('SLEEP', 128, 100); c.fillText('ORBIT CLOCK', 128, 172); c.font = '15px Arial'; c.fillText('tap: +1 h', 128, 192); c.textAlign = 'left'; clockTex.needsUpdate = true;
    // mood mirror display
    const m = moodCtx; m.fillStyle = '#1c1612'; m.fillRect(0, 0, 512, 160); m.fillStyle = '#e8dcc6'; m.font = '22px Arial'; m.fillText('How are you feeling?', 14, 30);
    EMO.forEach((e, i) => { const x = 62 + i * 96, on = i + 1 === v.mood; m.fillStyle = on ? 'rgba(255,217,160,.3)' : 'rgba(255,255,255,.05)'; m.beginPath(); m.arc(x, 98, 40, 0, 7); m.fill(); if (on) { m.strokeStyle = '#ffd9a0'; m.lineWidth = 4; m.stroke(); } m.font = on ? '58px Arial' : '42px Arial'; m.textAlign = 'center'; m.fillText(e, x, on ? 118 : 112); m.textAlign = 'left'; }); moodTex.needsUpdate = true;
    moodRing.emissive.setHex(MOODC[v.mood - 1]); moodRing.emissiveIntensity = 1.1 + .4 * Math.sin(t * 2);
    // logbook tablet
    const g = tabCtx, w = 512; g.fillStyle = '#06101f'; g.fillRect(0, 0, w, 352); g.fillStyle = '#4cc9f0'; g.font = 'bold 28px "Segoe UI",Arial'; g.fillText('LOGBOOK · Questionnaire', 18, 38);
    const row = (label, val, max, col, y, txt) => { g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(label, 18, y); g.fillStyle = '#16203a'; g.fillRect(18, y + 10, 476, 20); g.fillStyle = col; g.fillRect(18, y + 10, 476 * clamp(val / max, 0, 1), 20); g.fillStyle = '#fff'; g.font = 'bold 22px "Segoe UI",Arial'; g.textAlign = 'right'; g.fillText(txt, 494, y); g.textAlign = 'left'; };
    row('Sleep', v.sleep, 12, colS(v.sleep), 78, v.sleep + ' h'); row('Stress', v.stress, 10, colR(v.stress), 142, v.stress + '/10'); row('Isolation', v.iso, 10, colR(v.iso), 206, v.iso + '/10');
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText('Mood (tap to change)', 18, 270); EMO.forEach((e, i) => { const x = 60 + i * 90, on = i + 1 === v.mood; g.fillStyle = on ? 'rgba(255,210,63,.25)' : 'rgba(255,255,255,.05)'; g.beginPath(); g.arc(x, 312, 26, 0, 7); g.fill(); g.font = on ? '36px Arial' : '26px Arial'; g.textAlign = 'center'; g.fillText(e, x, on ? 324 : 320); g.textAlign = 'left'; }); tabTex.needsUpdate = true;
    // plant grows when stress is low; small bounce after a tap
    if (plantG) plantG.scale.setScalar(lerp(.8, 1.35, clamp(1 - (v.stress - 1) / 9, 0, 1)));
    Object.keys(bump).forEach(k => { const o = bump[k]; if (o.userData.b > 0) { o.userData.b = Math.max(0, o.userData.b - .04); o.scale.setScalar(1 + .12 * Math.sin(o.userData.b * Math.PI)); } else o.scale.setScalar(1); });
  }
  /* ---------- laptop screen ---------- */
  function drawLaptop(d, t) {
    const g = lapCtx, w = 768, h = 480; g.fillStyle = '#05080f'; g.fillRect(0, 0, w, h);
    if (!sess && !d.done) {
      g.fillStyle = '#9aa7c7'; g.font = 'bold 40px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText('Insert the flash drive →', w / 2 - 16 + Math.sin(t * 5) * 8, h / 2 + 12);
      g.font = '24px "Segoe UI",Arial'; g.fillStyle = '#4cc9f0'; g.fillText('SpaceDoc · therapy recorder · standby', w / 2, h / 2 + 62); g.textAlign = 'left';
    } else if (sess && !sess.finished) {
      const p = clamp(sess.t / sess.dur, 0, 1);
      g.fillStyle = '#0c1424'; g.fillRect(0, 0, w, 64); g.fillStyle = (Math.sin(t * 6) > 0) ? '#ff4d5e' : '#7a2030'; g.beginPath(); g.arc(40, 32, 11, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 28px "Segoe UI",Arial'; g.fillText('REC ●  Support call · Earth team', 66, 42);
      g.fillStyle = '#9aa7c7'; g.textAlign = 'right'; g.fillText(Math.max(0, Math.ceil(sess.dur - sess.t)) + ' s', w - 20, 42); g.textAlign = 'left';
      [[24, '#ffb3a0'], [270, '#9ad7c8'], [516, '#cdb4ff']].forEach(([x, cl], i) => { g.fillStyle = '#121b30'; g.fillRect(x, 84, 228, 190); g.fillStyle = cl; g.beginPath(); g.arc(x + 114, 150, 36, 0, 7); g.fill(); g.fillRect(x + 64, 190, 100, 84); g.fillStyle = '#10141f'; g.beginPath(); g.arc(x + 100, 146, 4, 0, 7); g.arc(x + 128, 146, 4, 0, 7); g.fill(); g.strokeStyle = '#10141f'; g.lineWidth = 3; g.beginPath(); g.arc(x + 114, 154, 11, .15, Math.PI - .15); g.stroke(); });
      g.fillStyle = '#4cc9f0'; for (let i = 0; i < 44; i++) { const a = (.25 + .75 * Math.abs(Math.sin(t * 7 + i * .55) * Math.cos(t * 3 + i * .21))) * 80; g.fillRect(24 + i * 16.5, 360 - a / 2, 10, a); }
      g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText('"You are not alone. We are with you."', 24, 318); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(24, 430, 720, 12); g.fillStyle = '#2ee6a6'; g.fillRect(24, 430, 720 * p, 12);
    } else {
      g.fillStyle = '#2ee6a6'; g.font = 'bold 54px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText('Therapy saved ✔', w / 2, h / 2 - 8); g.fillStyle = '#9aa7c7'; g.font = '26px "Segoe UI",Arial'; g.fillText('Stress and isolation improved', w / 2, h / 2 + 44); g.textAlign = 'left';
    }
    lapTex.needsUpdate = true;
  }

  /* ---------- actions ---------- */
  api.plug = function (dur) {
    if (plugAnim || sess) return;
    plugAnim = { t: 0, from: usb.position.clone(), dur: dur || 5 };
  };
  api.reset = function () { sess = null; plugAnim = null; dragging = null; warm = 0; usb.position.copy(startPos); usb.rotation.set(0, 0, 0); usb.visible = true; };

  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - (last || now)) / 1000); last = now; const d = getData() || {};
    // already done (coming back to the scene): the room is warm and the drive sits in the port
    if (d.done && !sess && !plugAnim) { sess = { t: 99, dur: 5, finished: true, doneT: t - 9 }; usb.position.copy(portPos).add(V(.2, 0, 0)); }
    // drive animation
    if (plugAnim) { plugAnim.t += dt; const k = ease(clamp(plugAnim.t / .6, 0, 1)); const tgt = portPos.clone().add(V(.3 - .1 * k, 0, 0)); usb.position.lerpVectors(plugAnim.from, tgt, k); usb.rotation.set(0, lerp(usb.rotation.y, 0, .2), 0); if (plugAnim.t >= .6) { usb.position.copy(portPos).add(V(.2, 0, 0)); sess = { t: 0, dur: plugAnim.dur, finished: false }; plugAnim = null; } }
    else if (!sess && !dragging) { usb.position.set(startPos.x + Math.sin(t * .7) * .06, startPos.y + Math.sin(t * 1.1) * .08, startPos.z + Math.cos(t * .6) * .05); usb.rotation.set(Math.sin(t * .8) * .35, Math.sin(t * .5) * .5, Math.cos(t * .9) * .4); }
    if (sess && !sess.finished) { sess.t += dt; if (sess.t >= sess.dur) { sess.finished = true; sess.doneT = t; } }
    const target = sess ? (sess.finished ? 1 : clamp(sess.t / sess.dur, 0, 1)) : 0; warm += (target - warm) * Math.min(1, dt * 3); const w = ease(clamp(warm, 0, 1));
    // lighting: cold isolation -> warm, welcoming
    hemi.color.copy(COLD).lerp(WARM, w); hemi.groundColor.copy(COLD2).lerp(WARM2, w); hemi.intensity = lerp(.5, .85, w);
    key.color.copy(new T.Color(0x9fb8ff)).lerp(new T.Color(0xffd9a8), w); key.intensity = lerp(1.0, 1.6, w);
    warmL.intensity = w * 2.4; photos.forEach(p => p.color.setRGB(lerp(.35, 1, w), lerp(.36, .96, w), lerp(.42, .88, w)));
    scene.background.setRGB(lerp(.01, .02, w), lerp(.016, .02, w), lerp(.05, .04, w));
    // emergency indicator: discreet blink on an Emergency match, calms down after the session
    const emer = d.g === 2, aK = emer ? 1 - w : 0, bl = (Math.sin(t * 4) > 0 ? 1 : .15) * aK; beacon.userData.lens.material.emissiveIntensity = bl * 2; alertL.intensity = bl * .9; beacon.visible = emer || w < .99 && false;
    // port outline: blinks cyan while waiting, steady cyan flash when connected
    portRing.material.opacity = sess || plugAnim ? Math.max(0, .9 - (sess ? sess.t : 0) * .6) : (Math.sin(t * 6) > 0 ? .95 : .2);
    // drive LED: green; blinks when the recording is saved
    usbLed.material.color.setHex(sess && sess.finished && ((t - sess.doneT) < 3) ? (Math.sin(t * 20) > 0 ? 0x2ee6a6 : 0x083020) : 0x2ee6a6);
    // astronaut mood: sad -> calm -> smiling; shoulders relax, posture straightens
    const mood = clamp(.05 + w * .95, 0, 1); moodK += (mood - moodK) * .1; drawFace(moodK, t);
    body.rotation.x = lerp(.16, 0, moodK); body.rotation.y = lerp(.55, .8, moodK) + Math.sin(t * .4) * .02;
    A.shL.rotation.set(lerp(.22, .02, moodK) + Math.sin(t * 1.0) * .02, 0, lerp(-.02, -.18, moodK)); A.shR.rotation.set(lerp(.22, .02, moodK) + Math.sin(t * 1.0 + 1) * .02, 0, lerp(.02, .18, moodK));
    A.elL.rotation.set(lerp(-.5, -.12, moodK), 0, 0); A.elR.rotation.set(lerp(-.5, -.12, moodK), 0, 0);
    body.position.y = 1.16 + Math.sin(t * 1.1) * .006;
    if (now - lastDraw > 66) { lastDraw = now; drawLaptop(d, t); drawQuiz(d, t); }
    earth.rotation.y = t * .01;
    cam.position.x = Math.sin(t * .2) * .2 + .5 + drag.yaw * .6; cam.position.y = camBase.y + Math.sin(t * .27) * .04; cam.lookAt(.5, 1.5, -2);
    R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 3.7, needW = clamp(a * 4.1, 4, 7.4);
    camBase.z = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)) + .5; cam.position.z = camBase.z; cam.updateProjectionMatrix();
  }

  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; getData = opts.getData || getData; onPlug = opts.onPlug || onPlug; onObj = opts.onObj || onObj;
    try {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab'; stage.insertBefore(canvas, stage.firstChild);
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02040c); cam = new T.PerspectiveCamera(38, 1, .1, 400); cam.position.set(.5, camBase.y, camBase.z);
      const envS = new T.Scene(); envS.background = new T.Color(0x0a1226);
      [[6, 3, 0, 6, 0, 0xffffff, 5], [4, 4, -7, 2, 2, 0xcfe6ff, 4], [4, 2, 6, 1, -4, 0xffd9a0, 2.5], [8, 3, 0, -6, 0, 0x4cc9f0, 1.2], [5, 5, 0, 2, -8, 0x2b6fd6, 1.5]].forEach(([w, h, x, y, z, c, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); });
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(envS, .02).texture; pm.dispose();
      hemi = new T.HemisphereLight(0x6f9cff, 0x2a3a66, .5); scene.add(hemi);
      key = new T.DirectionalLight(0x9fb8ff, 1.0); key.position.set(2.5, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const s = key.shadow.camera; s.left = -5; s.right = 5; s.top = 4; s.bottom = -2; s.near = 1; s.far = 22; key.shadow.bias = -.0004; key.target.position.set(.3, 1, -2); scene.add(key, key.target);
      const rim = new T.DirectionalLight(0x9fd0ff, .8); rim.position.set(-6, 3, -8); scene.add(rim);
      warmL = new T.PointLight(0xffb070, 0, 9); warmL.position.set(1.8, 2.6, -2.2); scene.add(warmL);
      room(); astronaut(); flash(); quizItems();
      const ray = new T.Raycaster(), mv = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 0, 1), 2.4); let downX = 0, moved = 0;
      const setRay = e => { const r = canvas.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); };
      const overUsb = e => { if (sess || plugAnim) return false; setRay(e); return ray.intersectObject(hitUsb, false).length > 0; };
      canvas.addEventListener('pointerdown', e => { downX = drag.x = e.clientX; moved = 0; if (overUsb(e)) { dragging = { id: e.pointerId }; plane.constant = -usb.position.z; setRay(e); const p = V(0, 0, 0); ray.ray.intersectPlane(plane, p); dragOff.copy(usb.position).sub(p); usb.rotation.set(0, 0, 0); } else drag.down = true; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => {
        if (dragging) { moved = Math.max(moved, Math.abs(e.clientX - downX)); setRay(e); const p = V(0, 0, 0); if (ray.ray.intersectPlane(plane, p)) { usb.position.copy(p).add(dragOff); usb.position.x = clamp(usb.position.x, -3, 3.6); usb.position.y = clamp(usb.position.y, .8, 3.4); canvas.style.cursor = 'grabbing'; } return; }
        if (!drag.down) { { const u = overUsb(e); setRay(e); canvas.style.cursor = (u || ray.intersectObjects(objHits, false).length > 0) ? 'pointer' : 'grab'; } return; }
        moved = Math.max(moved, Math.abs(e.clientX - downX)); drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .008, -1.3, 1.3); drag.x = e.clientX; canvas.style.cursor = 'grabbing';
      });
      const up = () => { if (dragging) { const near = usb.position.distanceTo(portPos.clone().add(V(.15, 0, 0))) < .7 || (moved < 6); dragging = null; if (near) onPlug(); } drag.down = false; canvas.style.cursor = 'grab'; };
      canvas.addEventListener('pointerup', e => { const wasUsb = !!dragging, wasPan = drag.down; up(); if (wasPan && !wasUsb && moved < 6) { setRay(e); const h = ray.intersectObjects(objHits, false)[0]; if (h) { const o = bump[h.object.userData.kind === 'plant' ? 'plant' : h.object.userData.kind === 'mood' ? 'mood' : h.object.userData.kind === 'clock' ? 'clock' : 'tablet']; if (o) o.userData.b = 1; onObj(h.object.userData.kind); } } }); canvas.addEventListener('pointercancel', () => { dragging = null; drag.down = false; });
      window.addEventListener('keydown', e => { if (!running || sess || plugAnim) return; if (e.key === 'u' || e.key === 'U' || e.key === 'Enter') { const t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA') return; onPlug(); } });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D therapy scene unavailable, using the 2D scene instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false; }
  };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
})();
