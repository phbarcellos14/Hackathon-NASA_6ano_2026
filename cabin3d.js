/* Advanced Space Life Supporter · 3D cabin (Three.js r149, classic build so it also works from file://)
   Public API: Cabin3D.init(stageEl, {getData, hotspots}) · setEnv(k) · setStatus({head,chest,belly,bones,rad}) · xray(on) · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE;
  const api = { ready: false, failed: false };
  window.Cabin3D = api;
  if (!T) { api.failed = true; return; }

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function ctex(w, h, fn, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  const LVC = ['#2ee6a6', '#ffd23f', '#ff4d5e'];
  const colorFor = l => (l == null || l < 0) ? 0x6f7c99 : [0x2ee6a6, 0xffd23f, 0xff4d5e][l];

  let R, scene, cam, stage, canvas, hs = [], getData = () => ({});
  let running = false, raf = 0, t0 = performance.now(), lastPanel = 0, W = 1, H = 1;
  let envKey = 'nave', xrayOn = false, status = {}, drag = { yaw: 0, pitch: 0, down: false, x: 0, y: 0 };
  let body, skel, shoulderL, shoulderR, elbowL, elbowR, hipL, hipR, kneeL, kneeR, torsoM, chestLed, shipG, earthG, moonG, marsG, sunDisk, starPts, alarm, lamp, screenLight;
  const statMat = {}, suitMats = [], anchors = {}, outside = {};
  let pg, ptex;

  /* ---------- textures ---------- */
  function wallTexture() {
    return ctex(512, 512, (g, w, h) => {
      g.fillStyle = '#1b2640'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const x = i * 128, y = j * 128;
        g.fillStyle = (i + j) % 2 ? '#27355a' : '#202c4d'; g.fillRect(x + 3, y + 3, 122, 122);
        g.strokeStyle = '#0a1020'; g.lineWidth = 3; g.strokeRect(x + 3, y + 3, 122, 122);
        g.fillStyle = '#4a5c8a'; [[10, 10], [118, 10], [10, 118], [118, 118]].forEach(p => { g.beginPath(); g.arc(x + p[0], y + p[1], 3.2, 0, 7); g.fill(); });
        if ((i * 3 + j) % 5 === 0) { g.fillStyle = '#0c1326'; g.fillRect(x + 30, y + 52, 68, 22); g.fillStyle = '#4cc9f0'; g.fillRect(x + 36, y + 58, 14, 10); }
      }
    });
  }
  function floorTexture() {
    return ctex(256, 256, (g, w, h) => {
      g.fillStyle = '#10172a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#070b16'; g.lineWidth = 4;
      for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
      g.fillStyle = '#ffd23f'; g.fillRect(0, 124, w, 8);
    }, [4, 8]);
  }
  function earthTexture() {
    return ctex(1024, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a6fd0'); gr.addColorStop(.5, '#1d5fc4'); gr.addColorStop(1, '#2a6fd0'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 40; k++) {
        const cx = Math.random() * w, cy = h * .2 + Math.random() * h * .6, r = 20 + Math.random() * 70;
        g.fillStyle = Math.random() < .25 ? '#b98f55' : '#3f9d4d';
        for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(cx + rnd(-r, r) * .7, cy + rnd(-r, r) * .5, r * rnd(.3, .7), r * rnd(.2, .5), rnd(0, 3), 0, 7); g.fill(); }
      }
      g.fillStyle = '#eef6ff'; g.fillRect(0, 0, w, 18); g.fillRect(0, h - 22, w, 22);
      for (let k = 0; k < 90; k++) { g.fillStyle = 'rgba(255,255,255,' + rnd(.15, .45) + ')'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rnd(30, 110), rnd(6, 20), rnd(-.3, .3), 0, 7); g.fill(); }
    });
  }
  function groundTexture(base, dark, light) {
    return ctex(512, 512, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2200; i++) { g.fillStyle = Math.random() < .5 ? dark : light; g.globalAlpha = rnd(.05, .22); g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rnd(1, 9), 0, 7); g.fill(); }
      g.globalAlpha = 1;
      for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = Math.random() * h, r = rnd(10, 46); const gr = g.createRadialGradient(x, y, r * .2, x, y, r); gr.addColorStop(0, dark); gr.addColorStop(.8, 'rgba(0,0,0,0)'); gr.addColorStop(1, light); g.globalAlpha = .35; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.globalAlpha = 1;
    }, [14, 14]);
  }
  function solarTexture() {
    return ctex(256, 128, (g, w, h) => {
      g.fillStyle = '#0d2a63'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3d6fc4'; g.lineWidth = 2;
      for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); }
      for (let j = 0; j <= 4; j++) { g.beginPath(); g.moveTo(0, j * 32); g.lineTo(w, j * 32); g.stroke(); }
    });
  }
  function flagTexture() {
    return ctex(128, 80, (g, w, h) => { g.fillStyle = '#1f9d4a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(64, 8); g.lineTo(118, 40); g.lineTo(64, 72); g.lineTo(10, 40); g.fill(); g.fillStyle = '#1d4ed8'; g.beginPath(); g.arc(64, 40, 20, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(64, 40, 16, 3.5, 5.7); g.stroke(); });
  }
  function patchTexture() {
    return ctex(128, 128, (g, w, h) => { g.fillStyle = '#0a1a45'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.strokeStyle = '#ffd23f'; g.lineWidth = 6; g.stroke(); g.fillStyle = '#ff4d5e'; g.beginPath(); g.arc(64, 64, 20, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(56, 50, 16, 28); g.fillRect(50, 57, 28, 14); g.font = 'bold 12px Arial'; g.textAlign = 'center'; g.fillStyle = '#ffd23f'; g.fillText('ASLS', 64, 24); g.fillText('SPACE APPS', 64, 112); });
  }

  /* ---------- helpers ---------- */
  const M = o => new T.MeshStandardMaterial(o);
  function mesh(geo, mat, x, y, z, parent) { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m; }
  function suit(o) { const m = M(o); suitMats.push(m); return m; }

  /* ---------- build the room ---------- */
  function buildRoom() {
    const wallTex = wallTexture(), floorTex = floorTexture();
    const wallMat = (w, h) => { const t = wallTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(w / 3, h / 3); return M({ map: t, roughness: .7, metalness: .25 }); };
    const plane = (w, h, x, y, z, rx, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), wallMat(w, h)); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); m.receiveShadow = true; scene.add(m); return m; };
    const D = 26, CZ = 9.4;
    const fl = new T.Mesh(new T.PlaneGeometry(9, D), M({ map: floorTex, roughness: .45, metalness: .5 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, CZ); fl.receiveShadow = true; scene.add(fl);
    const ce = plane(9, D, 0, 5, CZ, Math.PI / 2, 0);
    plane(D, 5, -4.5, 2.5, CZ, 0, Math.PI / 2); plane(D, 5, 4.5, 2.5, CZ, 0, -Math.PI / 2);
    const bz = -3.6;
    plane(1.1, 5, -3.95, 2.5, bz); plane(5.3, 5, 1.85, 2.5, bz); plane(2.6, 1.7, -2.1, 4.15, bz); plane(2.6, .9, -2.1, .45, bz);
    // window frame + glass
    const fm = M({ color: 0x222838, roughness: .4, metalness: .8 });
    const fb = (w, h, x, y) => mesh(new T.BoxGeometry(w, h, .22), fm, x, y, bz - .02, scene);
    fb(2.8, .12, -2.1, 3.3); fb(2.8, .12, -2.1, .9); fb(.12, 2.52, -3.4, 2.1); fb(.12, 2.52, -.8, 2.1);
    const gl = new T.Mesh(new T.PlaneGeometry(2.6, 2.4), new T.MeshBasicMaterial({ color: 0x9fd6ff, transparent: true, opacity: .06, depthWrite: false })); gl.position.set(-2.1, 2.1, bz - .08); scene.add(gl);
    // ceiling light strips
    const ls = new T.MeshBasicMaterial({ color: 0xffffff });
    [-2, 2].forEach(x => mesh(new T.BoxGeometry(.5, .06, 14), ls, x, 4.94, 2, scene));
    // handrails
    const rail = M({ color: 0xc0c7d6, metalness: .9, roughness: .25 });
    [-4.35, 4.35].forEach(x => { const c = mesh(new T.CylinderGeometry(.035, .035, 12, 12), rail, x, 1.4, 2, scene); c.rotation.x = Math.PI / 2; });
    // console + vital signs screen
    mesh(new T.BoxGeometry(3.5, 2.3, .14), M({ color: 0x151a28, roughness: .4, metalness: .8 }), 2.35, 2.55, bz + .05, scene);
    const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 640; pg = pc.getContext('2d');
    ptex = new T.CanvasTexture(pc); ptex.encoding = T.sRGBEncoding; ptex.anisotropy = 4;
    const sc = new T.Mesh(new T.PlaneGeometry(3.2, 2.0), new T.MeshBasicMaterial({ map: ptex, toneMapped: false })); sc.position.set(2.35, 2.55, bz + .13); scene.add(sc);
    lamp = new T.Mesh(new T.BoxGeometry(3.2, .08, .06), new T.MeshBasicMaterial({ color: 0x6f7c99 })); lamp.position.set(2.35, 3.82, bz + .12); scene.add(lamp);
    const desk = mesh(new T.BoxGeometry(3.7, .95, .85), M({ color: 0x2a3042, roughness: .5, metalness: .6 }), 2.35, .475, bz + .6, scene);
    mesh(new T.BoxGeometry(3.8, .06, .95), M({ color: 0x5a6378, roughness: .35, metalness: .7 }), 2.35, .98, bz + .6, scene);
    for (let i = 0; i < 12; i++) { const c = [0x2ee6a6, 0x4cc9f0, 0xffd23f, 0xff4d5e][i % 4]; mesh(new T.BoxGeometry(.18, .05, .14), new T.MeshStandardMaterial({ color: 0x111, emissive: c, emissiveIntensity: .9 }), 1.0 + (i % 6) * .27, 1.03, bz + .35 + Math.floor(i / 6) * .24, scene); }
    // pipes on ceiling
    [-3.6, 3.6].forEach(x => { const p = mesh(new T.CylinderGeometry(.09, .09, 20, 16), M({ color: 0x34436a, metalness: .6, roughness: .45 }), x, 4.7, 4, scene); p.rotation.x = Math.PI / 2; });
  }

  /* ---------- outside: space, Earth, surfaces, spaceship ---------- */
  function buildOutside() {
    const sg = new T.BufferGeometry(), n = 1800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = Math.random() * 6.283, ph = Math.acos(Math.random() * 2 - 1), r = 160; pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.cos(ph); pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th); }
    sg.setAttribute('position', new T.BufferAttribute(pos, 3));
    starPts = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })); scene.add(starPts);
    // Earth (spaceship / orbit view)
    earthG = new T.Group();
    const earth = new T.Mesh(new T.SphereGeometry(12, 64, 48), new T.MeshStandardMaterial({ map: earthTexture(), roughness: .9, metalness: 0, emissive: 0x0a2a60, emissiveIntensity: .35 }));
    const atm = new T.Mesh(new T.SphereGeometry(12.5, 48, 32), new T.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: .28, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false }));
    earthG.add(earth, atm); earthG.position.set(-14, -9, -40); scene.add(earthG); outside.earth = earth;
    // far Earth for Moon / Mars
    outside.farEarth = new T.Mesh(new T.SphereGeometry(1.5, 32, 24), new T.MeshStandardMaterial({ map: earthTexture(), emissive: 0x0a2a60, emissiveIntensity: .5 })); outside.farEarth.position.set(-9, 8.5, -48); scene.add(outside.farEarth);
    // ground discs
    const mk = (tex, col) => { const m = new T.Mesh(new T.CircleGeometry(160, 48), M({ map: tex, color: col, roughness: 1, metalness: 0 })); m.rotation.x = -Math.PI / 2; m.position.set(0, .7, -75); return m; };
    moonG = new T.Group(); moonG.add(mk(groundTexture('#8c8c88', '#4c4c4a', '#c9c9c4'), 0x8a8a8a));
    marsG = new T.Group(); marsG.add(mk(groundTexture('#a8573a', '#5e2a1a', '#d98a5f'), 0xb0b0b0));
    const rockMat = M({ color: 0x777670, roughness: 1 }), rockMat2 = M({ color: 0x8a4a30, roughness: 1 });
    for (let i = 0; i < 26; i++) { const z = -5 - Math.random() * 40, x = rnd(-14, 6), s = rnd(.12, .7); [[moonG, rockMat], [marsG, rockMat2]].forEach(([g, mt]) => { const r = new T.Mesh(new T.DodecahedronGeometry(s, 0), mt); r.position.set(x, .7 + s * .3, z); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); r.scale.y = .6; g.add(r); }); }
    scene.add(moonG, marsG);
    sunDisk = new T.Mesh(new T.SphereGeometry(1.2, 24, 16), new T.MeshBasicMaterial({ color: 0xfff1c9 })); sunDisk.position.set(-3, 7.5, -60); scene.add(sunDisk);
    // spaceship (Orion-like capsule + service module + solar arrays)
    shipG = new T.Group();
    const white = M({ color: 0xf1f3f8, roughness: .45, metalness: .35 }), foil = M({ color: 0xd9a43a, roughness: .3, metalness: .9 }), metal = M({ color: 0xaab2c4, roughness: .3, metalness: .85 }), dark = M({ color: 0x20242f, roughness: .6 });
    const capsule = mesh(new T.CylinderGeometry(.2, .75, .95, 32), white, 0, 0, 0, shipG); capsule.rotation.z = -Math.PI / 2; capsule.position.x = 1.35;
    const shield = mesh(new T.CylinderGeometry(.75, .75, .08, 32), dark, 0, 0, 0, shipG); shield.rotation.z = -Math.PI / 2; shield.position.x = .85;
    const sm = mesh(new T.CylinderGeometry(.74, .74, 1.4, 32), metal, 0, 0, 0, shipG); sm.rotation.z = Math.PI / 2; sm.position.x = .1;
    const band = mesh(new T.CylinderGeometry(.76, .76, .38, 32), foil, 0, 0, 0, shipG); band.rotation.z = Math.PI / 2; band.position.x = .1;
    const bell = mesh(new T.ConeGeometry(.42, .7, 24, 1, true), M({ color: 0x555b6a, metalness: .9, roughness: .3, side: T.DoubleSide }), -.95, 0, 0, shipG); bell.rotation.z = Math.PI / 2;
    const glow = mesh(new T.SphereGeometry(.22, 16, 12), new T.MeshBasicMaterial({ color: 0x7fd0ff }), -1.25, 0, 0, shipG); glow.castShadow = false; outside.glow = glow;
    const sol = solarTexture(); sol.wrapS = sol.wrapT = T.RepeatWrapping;
    [[.3, 0], [.3, Math.PI / 2], [.3, Math.PI], [.3, -Math.PI / 2]].forEach(([x, a]) => {
      const arm = new T.Group(); arm.rotation.x = a; shipG.add(arm);
      mesh(new T.CylinderGeometry(.04, .04, 1.1, 8), metal, x, .95, 0, arm);
      const p = mesh(new T.BoxGeometry(.7, 2.0, .03), new T.MeshStandardMaterial({ map: sol, roughness: .35, metalness: .6, emissive: 0x0a1e4a, emissiveIntensity: .4 }), x, 2.0, 0, arm);
    });
    const lr = new T.Mesh(new T.SphereGeometry(.06, 8, 6), new T.MeshBasicMaterial({ color: 0xff3040 })); lr.position.set(.1, .8, 0); shipG.add(lr); outside.lr = lr;
    shipG.scale.setScalar(1.35); shipG.position.set(-3.1, 3.0, -15); shipG.rotation.set(.1, .55, .12); scene.add(shipG);
  }

  /* ---------- the astronaut ---------- */
  function buildAstronaut() {
    body = new T.Group(); scene.add(body);
    const sw = suit({ color: 0xeef1f7, roughness: .78, metalness: .02 }), sw2 = suit({ color: 0xd3d9e6, roughness: .72, metalness: .05 });
    const grey = suit({ color: 0x8a92a4, roughness: .45, metalness: .5 }), dark = suit({ color: 0x2a2f3d, roughness: .6, metalness: .3 });
    const glove = suit({ color: 0x4b5368, roughness: .9 }), gold = suit({ color: 0xe0a93b, roughness: .05, metalness: 1 }), orange = suit({ color: 0xff7a1a, roughness: .6 });
    const bone = new T.MeshStandardMaterial({ color: 0xf1ead2, emissive: 0xf1ead2, emissiveIntensity: .55, roughness: .6 });
    ['head', 'chest', 'belly', 'bones', 'rad'].forEach(k => { statMat[k] = new T.MeshStandardMaterial({ color: 0x6f7c99, emissive: 0x6f7c99, emissiveIntensity: .2, roughness: .4 }); });
    // hips + torso
    const hips = mesh(new T.SphereGeometry(.27, 24, 16), sw2, 0, .98, 0, body); hips.scale.set(1, .62, .8);
    torsoM = mesh(new T.CapsuleGeometry(.27, .22, 8, 24), sw, 0, 1.28, 0, body); torsoM.scale.set(1, 1, .78);
    const belt = mesh(new T.TorusGeometry(.27, .035, 10, 32), statMat.belly, 0, 1.03, 0, body); belt.rotation.x = Math.PI / 2; belt.scale.set(1, .8, 1);
    // chest control unit
    const dcm = mesh(new T.BoxGeometry(.34, .24, .12), grey, 0, 1.36, .23, body);
    chestLed = mesh(new T.BoxGeometry(.3, .035, .02), statMat.chest, 0, 1.5, .29, body);
    const scr = ctex(128, 64, (g, w, h) => { g.fillStyle = '#04101e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2ee6a6'; g.lineWidth = 3; g.beginPath(); g.moveTo(4, 34); g.lineTo(34, 34); g.lineTo(42, 12); g.lineTo(52, 54); g.lineTo(62, 34); g.lineTo(124, 34); g.stroke(); });
    const sp = new T.Mesh(new T.PlaneGeometry(.22, .1), new T.MeshBasicMaterial({ map: scr, toneMapped: false })); sp.position.set(0, 1.38, .292); body.add(sp);
    [[-.1, 0xff4d5e], [0, 0xffd23f], [.1, 0x4cc9f0]].forEach(([x, c]) => mesh(new T.CylinderGeometry(.022, .022, .03, 12), new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .8 }), x, 1.29, .3, body).rotation.x = Math.PI / 2);
    const pt = new T.Mesh(new T.CircleGeometry(.055, 24), new T.MeshBasicMaterial({ map: patchTexture(), toneMapped: false, transparent: true })); pt.position.set(-.2, 1.5, .3); pt.rotation.y = -.15; body.add(pt);
    // backpack
    mesh(new T.BoxGeometry(.56, .72, .3), grey, 0, 1.3, -.32, body); mesh(new T.BoxGeometry(.5, .1, .26), dark, 0, 1.69, -.32, body);
    [-.16, .16].forEach(x => { mesh(new T.CylinderGeometry(.08, .08, .5, 16), sw2, x, 1.3, -.52, body); });
    const hose = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.2, 1.42, .22), new T.Vector3(-.36, 1.3, .12), new T.Vector3(-.34, 1.12, -.05), new T.Vector3(-.2, 1.02, -.28)]), 24, .022, 8), orange); hose.castShadow = true; body.add(hose);
    // neck ring + helmet
    const neck = mesh(new T.TorusGeometry(.2, .04, 12, 32), statMat.head, 0, 1.64, 0, body); neck.rotation.x = Math.PI / 2;
    mesh(new T.SphereGeometry(.285, 40, 28), sw, 0, 1.84, 0, body);
    const vis = mesh(new T.SphereGeometry(.297, 40, 28, -Math.PI * .62, Math.PI * 1.24, Math.PI * .22, Math.PI * .5), gold, 0, 1.845, .01, body); vis.castShadow = false;
    const hl = mesh(new T.BoxGeometry(.08, .04, .05), new T.MeshBasicMaterial({ color: 0xffffff }), 0, 2.12, .1, body); [-.17, .17].forEach(x => mesh(new T.BoxGeometry(.06, .05, .06), new T.MeshBasicMaterial({ color: 0xfff6d0 }), x, 2.04, .17, body));
    mesh(new T.BoxGeometry(.07, .06, .08), dark, .3, 1.88, .02, body); mesh(new T.CylinderGeometry(.008, .008, .26, 6), dark, -.2, 2.08, -.12, body);
    // arms
    function arm(side) {
      const sh = new T.Group(); sh.position.set(side * .37, 1.5, 0); body.add(sh);
      mesh(new T.SphereGeometry(.13, 18, 14), sw2, 0, 0, 0, sh);
      mesh(new T.CapsuleGeometry(.095, .24, 6, 16), sw, 0, -.22, 0, sh);
      const el = new T.Group(); el.position.set(0, -.46, 0); sh.add(el);
      mesh(new T.SphereGeometry(.1, 16, 12), sw2, 0, 0, 0, el);
      mesh(new T.CapsuleGeometry(.085, .22, 6, 16), sw, 0, -.2, 0, el);
      const wr = mesh(new T.TorusGeometry(.085, .022, 8, 20), grey, 0, -.37, 0, el); wr.rotation.x = Math.PI / 2;
      mesh(new T.SphereGeometry(.105, 16, 12), glove, 0, -.46, 0, el).scale.set(1, 1.15, .85);
      mesh(new T.BoxGeometry(.13, .08, .06), glove, 0, -.55, .03, el);
      return { sh, el };
    }
    const aL = arm(-1), aR = arm(1); shoulderL = aL.sh; elbowL = aL.el; shoulderR = aR.sh; elbowR = aR.el;
    const flag = new T.Mesh(new T.PlaneGeometry(.12, .075), new T.MeshBasicMaterial({ map: flagTexture(), toneMapped: false })); flag.position.set(.095, -.2, .02); flag.rotation.y = 1.4; shoulderR.add(flag);
    const badge = mesh(new T.BoxGeometry(.1, .13, .045), statMat.rad, -.02, -.2, .08, elbowL); badge.castShadow = false;
    // legs
    function leg(side) {
      const hp = new T.Group(); hp.position.set(side * .14, .95, 0); body.add(hp);
      mesh(new T.CapsuleGeometry(.12, .26, 6, 16), sw, 0, -.25, 0, hp);
      const b1 = mesh(new T.TorusGeometry(.125, .016, 8, 24), statMat.bones, 0, -.2, 0, hp); b1.rotation.x = Math.PI / 2;
      const kn = new T.Group(); kn.position.set(0, -.5, 0); hp.add(kn);
      mesh(new T.SphereGeometry(.115, 16, 12), sw2, 0, 0, 0, kn);
      mesh(new T.CapsuleGeometry(.1, .24, 6, 16), sw, 0, -.22, 0, kn);
      const b2 = mesh(new T.TorusGeometry(.105, .016, 8, 24), statMat.bones, 0, -.2, 0, kn); b2.rotation.x = Math.PI / 2;
      const bt = mesh(new T.BoxGeometry(.2, .14, .34), dark, 0, -.5, .06, kn); bt.geometry.translate(0, 0, 0);
      mesh(new T.BoxGeometry(.21, .05, .36), grey, 0, -.56, .06, kn);
      return { hp, kn };
    }
    const lL = leg(-1), lR = leg(1); hipL = lL.hp; kneeL = lL.kn; hipR = lR.hp; kneeR = lR.kn;
    // anchors for hotspots
    const anc = (k, p, par) => { const o = new T.Object3D(); o.position.set(p[0], p[1], p[2]); (par || body).add(o); anchors[k] = o; };
    anc('head', [0, 1.9, .05]); anc('chest', [0, 1.42, .32]); anc('belly', [0, 1.1, .26]); anc('bones', [0, -.3, .18], hipR); anc('rad', [0, -.2, .16], elbowL);
    // skeleton for X-ray
    skel = new T.Group(); skel.visible = false; body.add(skel);
    const sk = (g, mt, x, y, z, par) => mesh(g, mt, x, y, z, par || skel);
    sk(new T.SphereGeometry(.17, 20, 16), bone, 0, 1.84, 0);
    for (let i = 0; i < 7; i++) sk(new T.CylinderGeometry(.035, .04, .1, 8), bone, 0, 1.6 - i * .08, -.03);
    for (let i = 0; i < 5; i++) { const r = sk(new T.TorusGeometry(.19 - i * .012, .012, 6, 20, Math.PI * 1.5), bone, 0, 1.52 - i * .065, -.01); r.rotation.set(Math.PI / 2, 0, -Math.PI * .75); r.scale.z = .75; }
    const pel = sk(new T.TorusGeometry(.16, .035, 8, 20), bone, 0, 1.0, 0); pel.rotation.x = Math.PI / 2;
    [hipL, hipR].forEach(h => sk(new T.CylinderGeometry(.032, .028, .5, 8), bone, 0, -.25, 0, h)); [kneeL, kneeR].forEach(k => sk(new T.CylinderGeometry(.028, .022, .44, 8), bone, 0, -.22, 0, k));
    [shoulderL, shoulderR].forEach(s => sk(new T.CylinderGeometry(.026, .022, .42, 8), bone, 0, -.22, 0, s)); [elbowL, elbowR].forEach(e => sk(new T.CylinderGeometry(.02, .016, .38, 8), bone, 0, -.2, 0, e));
    body.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  }

  /* ---------- vital-signs panel texture ---------- */
  function drawPanel(t) {
    const d = getData() || {}, w = 1024, h = 640, g = pg, hr = d.hrReal || 72, gl = d.g == null ? -1 : d.g;
    g.fillStyle = '#04091a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(76,201,240,.10)'; g.lineWidth = 1; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#4cc9f0'; g.font = 'bold 34px "Segoe UI",Arial'; g.fillText('VITAL SIGNS · ASLS', 28, 50);
    const sc = gl < 0 ? '#7f8fb0' : LVC[gl], st = gl < 0 ? 'NO DATA' : ['STABLE', 'ATTENTION', 'EMERGENCY'][gl];
    g.fillStyle = sc; g.beginPath(); g.roundRect ? g.roundRect(700, 14, 296, 48, 24) : g.rect(700, 14, 296, 48); g.fill(); g.fillStyle = '#04091a'; g.font = 'bold 26px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(st, 848, 48); g.textAlign = 'left';
    // ECG
    const ex = 28, ey = 86, ew = 640, eh = 300; g.fillStyle = '#020611'; g.fillRect(ex, ey, ew, eh); g.strokeStyle = 'rgba(46,230,166,.15)'; for (let x = ex; x <= ex + ew; x += 40) { g.beginPath(); g.moveTo(x, ey); g.lineTo(x, ey + eh); g.stroke(); } for (let y = ey; y <= ey + eh; y += 40) { g.beginPath(); g.moveTo(ex, y); g.lineTo(ex + ew, y); g.stroke(); }
    const arr = !!d.arr, gg = (p, m, s) => Math.exp(-((p - m) ** 2) / (2 * s * s)); g.strokeStyle = sc === '#7f8fb0' ? '#2ee6a6' : sc; g.lineWidth = 4; g.shadowColor = g.strokeStyle; g.shadowBlur = 12; g.beginPath();
    for (let px = 0; px < ew; px += 3) { let tt = t - (ew - px) / ew * 3; if (arr) tt += .22 * Math.sin(tt * 2.3) + .15 * Math.sin(tt * 5.1); const p = ((tt * hr / 60) % 1 + 1) % 1, y = (arr ? .04 * Math.sin(px / 6 + t * 9) : .1 * gg(p, .12, .03)) - .12 * gg(p, .205, .01) + gg(p, .235, .012) - .25 * gg(p, .265, .012) + .2 * gg(p, .45, .04); const yy = ey + eh * .68 - y * eh * .55; px ? g.lineTo(ex + px, yy) : g.moveTo(ex + px, yy); }
    g.stroke(); g.shadowBlur = 0;
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(arr ? 'ECG · irregular rhythm' : 'ECG · regular rhythm', ex + 10, ey + eh - 12);
    // numbers
    const big = (label, val, unit, x, y, col) => { g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(label, x, y); g.fillStyle = col || '#fff'; g.font = 'bold 64px "Segoe UI",Arial'; g.fillText(val, x, y + 62); const wv = g.measureText(val).width; g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(unit, x + wv + 8, y + 62); };
    big('HEART RATE', d.hr == null ? '--' : String(d.hr), 'bpm', 700, 112, '#ff7a8a'); big('BLOOD PRESSURE', d.sys == null ? '--' : d.sys + '/' + d.dia, 'mmHg', 700, 230, '#ffd23f');
    big('SpO₂', d.spo2 == null ? '--' : String(d.spo2), '%', 700, 348, '#4cc9f0');
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText('GLUCOSE', 28, 430); g.fillText('STRESS', 250, 430); g.fillText('HEALTH', 470, 430);
    g.fillStyle = '#fff'; g.font = 'bold 44px "Segoe UI",Arial'; g.fillText(d.glu == null ? '--' : d.glu + ' mg/dL', 28, 478); g.fillText(d.stress == null ? '--' : d.stress + '/10', 250, 478); g.fillStyle = sc; g.fillText(d.score == null ? '--' : d.score + '/10', 470, 478);
    g.fillStyle = '#16203a'; g.fillRect(28, 520, 968, 26); g.fillStyle = sc; g.fillRect(28, 520, 968 * clamp((d.score == null ? 0 : d.score) / 10, 0, 1), 26);
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText((d.env || '') + ' · Day ' + (d.day || ''), 28, 592); g.textAlign = 'right'; g.fillText('● LIVE', 996, 592); g.textAlign = 'left';
    ptex.needsUpdate = true;
  }

  /* ---------- environment switching ---------- */
  function applyEnv() {
    const k = envKey, surf = k !== 'nave';
    earthG.visible = !surf; outside.farEarth.visible = k === 'lua'; moonG.visible = k === 'lua'; marsG.visible = k === 'marte'; sunDisk.visible = k === 'marte';
    starPts.visible = k !== 'marte';
    scene.background = new T.Color(k === 'marte' ? 0xc98f66 : 0x02040c);
    outside.glow.visible = true;
  }

  /* ---------- main loop ---------- */
  const v3 = new T.Vector3();
  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) return;
    const t = (now - t0) / 1000;
    const hr = (getData() || {}).hrReal || 72;
    // astronaut motion: floating in microgravity, hopping on the Moon / Mars
    const surf = envKey !== 'nave', foot = .11;
    let y, rz = 0, rx = 0, ry = Math.sin(t * .35) * .3 + drag.yaw;
    if (!surf) { y = foot + .85 + Math.sin(t * .8) * .08; rz = Math.sin(t * .5) * .05; rx = Math.sin(t * .6) * .035 - .04; }
    else { const Tp = envKey === 'lua' ? 2.9 : 1.8, hh = envKey === 'lua' ? .55 : .24, ph = (t % Tp) / Tp; y = foot + 4 * hh * ph * (1 - ph); ry = Math.sin(t * .3) * .25 + drag.yaw; }
    body.position.set(0, y, 0); body.rotation.set(rx + drag.pitch, ry, rz);
    const f = !surf;
    shoulderL.rotation.set(Math.sin(t * .9) * .1 - (f ? .25 : 0), 0, -(f ? .55 : .18) - Math.sin(t * .8) * .08);
    shoulderR.rotation.set(Math.sin(t * .9 + 1) * .1 - (f ? .25 : 0), 0, (f ? .55 : .18) + Math.sin(t * .8 + 1) * .08);
    elbowL.rotation.x = -(f ? .75 : .3) - Math.sin(t * 1.1) * .08; elbowR.rotation.x = -(f ? .75 : .3) - Math.sin(t * 1.1 + 1) * .08;
    hipL.rotation.set(f ? -.3 + Math.sin(t * .7) * .1 : Math.sin(t * 2) * .05, 0, f ? -.1 : 0); hipR.rotation.set(f ? -.2 + Math.sin(t * .7 + 1) * .1 : -Math.sin(t * 2) * .05, 0, f ? .1 : 0);
    kneeL.rotation.x = f ? .55 + Math.sin(t * .7) * .1 : 0; kneeR.rotation.x = f ? .45 + Math.sin(t * .7 + 1) * .1 : 0;
    torsoM.scale.set(1 + Math.sin(t * 1.4) * .012, 1 + Math.sin(t * 1.4) * .012, .78);
    const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * hr / 60)), 6);
    statMat.chest.emissiveIntensity = (status.chest == null || status.chest < 0 ? .25 : 1.0) + beat * .9;
    // outside motion
    earthG.rotation.y = t * .01; outside.farEarth.rotation.y = t * .02;
    shipG.position.set(-4.3 + Math.sin(t * .12) * .5, 2.5 + Math.sin(t * .2) * .15, -15 - Math.sin(t * .09) * 1.2); shipG.rotation.y = .55 + Math.sin(t * .1) * .25; shipG.rotation.x = .1 + Math.sin(t * .15) * .06;
    outside.lr.visible = (Math.floor(t * 1.4) % 2) === 0;
    // camera parallax
    cam.position.x = Math.sin(t * .2) * .3 + drag.yaw * .45; cam.position.y = camBase.y + Math.sin(t * .27) * .05; cam.lookAt(0, 1.65, 0);
    // alarm light + status lamp
    const gl = (getData() || {}).g; alarm.intensity = gl === 2 ? 1.4 + 1.4 * Math.sin(t * 6) : 0;
    lamp.material.color.set(gl == null || gl < 0 ? 0x6f7c99 : colorFor(gl));
    if (now - lastPanel > 90) { lastPanel = now; drawPanel(t); }
    R.render(scene, cam);
    // hotspots follow 3D anchors
    hs.forEach(h => { const a = anchors[h.part]; if (!a) return; a.getWorldPosition(v3); v3.project(cam); const vis = v3.z < 1; h.el.style.display = vis ? '' : 'none'; h.el.style.transform = `translate(${((v3.x * .5 + .5) * W).toFixed(1)}px,${((-v3.y * .5 + .5) * H).toFixed(1)}px) translate(-50%,-50%)`; });
  }
  const camBase = { y: 1.9, z: 8 };
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight);
    R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 3.7, needW = clamp(a * 5.0, 3.6, 7.4);
    const d = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a));
    camBase.z = d; cam.position.z = d; cam.updateProjectionMatrix();
  }

  /* ---------- public API ---------- */
  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; getData = opts.getData || getData;
    try {
      canvas = document.createElement('canvas'); canvas.id = 'cab3d'; canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
      stage.insertBefore(canvas, stage.firstChild);
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02040c); cam = new T.PerspectiveCamera(38, 1, .1, 400); cam.position.set(0, camBase.y, camBase.z);
      // reflections environment (gives the gold visor and metals something to mirror)
      const envS = new T.Scene(); envS.background = new T.Color(0x0a1226);
      [[6, 3, 0, 6, 0, 0xffffff, 6], [4, 4, -7, 2, 2, 0xcfe6ff, 4], [4, 2, 6, 1, -4, 0xffd9a0, 3], [8, 3, 0, -6, 0, 0x4cc9f0, 1.2], [5, 5, 0, 2, -8, 0x2b6fd6, 1.5]].forEach(([w, h, x, y, z, c, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); });
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(envS, .02).texture; pm.dispose();
      scene.add(new T.HemisphereLight(0xbfd8ff, 0x2a2f44, .5));
      const key = new T.DirectionalLight(0xfff2e0, 1.5); key.position.set(3.5, 6, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const s = key.shadow.camera; s.left = -3; s.right = 3; s.top = 4; s.bottom = -2; s.near = 1; s.far = 20; key.shadow.bias = -.0004; key.target.position.set(0, 1, 0); scene.add(key, key.target);
      const sun = new T.DirectionalLight(0xffffff, 1.2); sun.position.set(-8, 4, -10); scene.add(sun);
      screenLight = new T.PointLight(0x4cc9f0, 1.4, 9); screenLight.position.set(2.3, 2.4, -2.2); scene.add(screenLight);
      alarm = new T.PointLight(0xff2040, 0, 10); alarm.position.set(0, 4, 1); scene.add(alarm);
      buildRoom(); buildOutside(); buildAstronaut(); applyEnv();
      (opts.hotspots || []).forEach(el => hs.push({ el, part: el.dataset.part }));
      // drag to rotate the astronaut a little
      canvas.addEventListener('pointerdown', e => { drag.down = true; drag.x = e.clientX; drag.y = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
      canvas.addEventListener('pointermove', e => { if (!drag.down) return; drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .01, -1.3, 1.3); drag.pitch = clamp(drag.pitch + (e.clientY - drag.y) * .004, -.25, .25); drag.x = e.clientX; drag.y = e.clientY; });
      const up = () => { drag.down = false; canvas.style.cursor = 'grab'; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true;
      return true;
    } catch (e) {
      console.warn('3D cabin unavailable, using the 2D astronaut instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false;
    }
  };
  api.kit = { ctex, wallTexture, floorTexture, earthTexture, solarTexture, flagTexture, patchTexture, M, mesh, colorFor, LVC, clamp, rnd };
  api.debug = function () { const p = shipG.position.clone().project(cam); return { ship: shipG.position.toArray(), ndc: [p.x, p.y, p.z], vis: shipG.visible, cam: cam.position.toArray(), W, H }; };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
  api.setEnv = function (k) { envKey = k; if (api.ready) applyEnv(); };
  api.setStatus = function (st) { status = st || {}; if (!api.ready) return; ['head', 'chest', 'belly', 'bones', 'rad'].forEach(k => { const l = status[k], c = new T.Color(colorFor(l)); statMat[k].color.copy(c); statMat[k].emissive.copy(c); statMat[k].emissiveIntensity = (l == null || l < 0) ? .2 : 1.3; }); };
  api.xray = function (on) { xrayOn = !!on; if (!api.ready) return; skel.visible = xrayOn; suitMats.forEach(m => { m.transparent = xrayOn; m.opacity = xrayOn ? .16 : 1; m.depthWrite = !xrayOn; m.needsUpdate = true; }); };
})();
