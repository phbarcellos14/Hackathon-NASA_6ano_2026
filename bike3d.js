/* SpaceFit · CEVIS bike in 3D (Three.js r149). Needs cabin3d.js (shared textures/helpers).
   API: Bike3D.init(stageEl,{getData}) · pedal() · reset() · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D;
  const api = { ready: false, failed: false };
  window.Bike3D = api;
  if (!T || !C || !C.kit) { api.failed = true; return; }
  const K = C.kit, M = K.M, ctex = K.ctex, clamp = K.clamp, mesh = K.mesh;

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, getData = () => ({});
  let t0 = performance.now(), last = 0, lastPanel = 0;
  let onAstro = null, crankA = 0, crankT = 0, flyA = 0, rpm = 0, hrShown = 72, kcal = 0, kj = 0;
  const strokes = [], cadHist = [];
  let rig, rider, crank, flyG, pedalR, pedalL, ankleR, ankleL, hipL, hipR, kneeL, kneeR, shL, shR, elL, elR, torso, pg, ptex, cg, ctexC, lamp, drag = { yaw: 0, down: false, x: 0 };
  const camBase = { y: 1.55, z: 7 };
  const A = { y: .52, z: .28, r: .17 };           // crank axle (bike frame, +z = forward)
  const HIP = { y: 1.08, z: -.3 }, LEAN = .42;    // rider hip pivot + forward lean
  const GRIP = { y: 1.29, z: .56 };

  function tube(a, b, r, mat, parent) {
    const p = new T.Vector3(...a), q = new T.Vector3(...b), d = q.clone().sub(p), len = d.length();
    const m = new T.Mesh(new T.CylinderGeometry(r, r, len, 18), mat); m.position.copy(p).addScaledVector(d, .5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }
  function plateTexture() {
    return ctex(256, 512, (g, w, h) => {
      g.fillStyle = '#2a2f3b'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd23f'; for (let i = -h; i < h * 2; i += 44) { g.save(); g.translate(0, i); g.transform(1, 0, 0, 1, 0, 0); g.beginPath(); g.moveTo(0, 0); g.lineTo(w, -30); g.lineTo(w, -10); g.lineTo(0, 20); g.fill(); g.restore(); }
      g.fillStyle = '#181c26'; g.fillRect(26, 26, w - 52, h - 52);
      g.strokeStyle = '#3a4156'; g.lineWidth = 2; for (let y = 40; y < h - 40; y += 20) { g.beginPath(); g.moveTo(34, y); g.lineTo(w - 34, y); g.stroke(); }
    });
  }
  function labelTexture(txt, w, h, bg, fg) {
    return ctex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = 'bold ' + Math.floor(h * .5) + 'px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2); });
  }
  function spokesTexture() {
    return ctex(512, 512, (g, w, h) => {
      g.fillStyle = '#1b2030'; g.fillRect(0, 0, w, h); g.translate(w / 2, h / 2);
      for (let i = 0; i < 18; i++) { g.rotate(Math.PI * 2 / 18); g.fillStyle = i % 2 ? '#2b3348' : '#394463'; g.beginPath(); g.moveTo(40, -10); g.lineTo(240, -34); g.lineTo(240, 34); g.lineTo(40, 10); g.fill(); }
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#4cc9f0'; g.beginPath(); g.arc(w / 2, h / 2, 46, 0, 7); g.fill(); g.fillStyle = '#04101e'; g.beginPath(); g.arc(w / 2, h / 2, 34, 0, 7); g.fill();
      g.fillStyle = '#ffd23f'; g.fillRect(w / 2 - 6, h / 2 - 28, 12, 22);
    });
  }

  /* ---------- the CEVIS bike ---------- */
  function buildBike(parent) {
    const alu = M({ color: 0xd7dce8, metalness: .9, roughness: .26 }), dark = M({ color: 0x1d212c, metalness: .55, roughness: .45 }), rubber = M({ color: 0x101216, roughness: .9 });
    const orange = M({ color: 0xff7a1a, roughness: .55 }), steel = M({ color: 0x8d96a8, metalness: .95, roughness: .32 }), leather = M({ color: 0x16181f, roughness: .65 });
    const bike = new T.Group(); parent.add(bike);
    // floor mounting plate bolted to the station floor
    mesh(new T.BoxGeometry(.8, .06, 1.8), M({ map: plateTexture(), metalness: .6, roughness: .45 }), 0, .03, .05, bike);
    [[-.33, -.8], [.33, -.8], [-.33, .9], [.33, .9]].forEach(([x, z]) => { const b = mesh(new T.CylinderGeometry(.045, .045, .05, 6), steel, x, .085, z, bike); mesh(new T.CylinderGeometry(.02, .02, .056, 6), dark, x, .09, z, bike); });
    [-.45, .65].forEach(z => mesh(new T.BoxGeometry(.86, .014, .08), orange, 0, .068, z, bike));   // floor straps
    // vibration-isolation mounts (springs)
    [[-.22, -.5], [.22, -.5], [-.22, .62], [.22, .62]].forEach(([x, z]) => {
      mesh(new T.CylinderGeometry(.055, .055, .02, 18), steel, x, .07, z, bike);
      for (let i = 0; i < 6; i++) { const t = mesh(new T.TorusGeometry(.04, .008, 6, 18), steel, x, .095 + i * .015, z, bike); t.rotation.x = Math.PI / 2; }
      mesh(new T.CylinderGeometry(.055, .055, .02, 18), steel, x, .205, z, bike);
    });
    [-.22, .22].forEach(x => tube([x, .22, -.5], [x, .22, .62], .025, alu, bike));
    tube([-.22, .22, -.5], [.22, .22, -.5], .02, alu, bike); tube([-.22, .22, .62], [.22, .22, .62], .02, alu, bike);
    // frame
    const AY = A.y, AZ = A.z;
    tube([0, .22, -.5], [0, 1.0, -.34], .03, alu, bike);          // rear stay to seat
    tube([0, AY, AZ], [0, 1.0, -.34], .034, alu, bike);           // seat tube
    tube([0, .22, .62], [0, 1.2, .62], .04, alu, bike);           // front mast
    tube([0, AY, AZ], [0, 1.0, .62], .03, alu, bike);             // down tube
    tube([0, .22, AZ], [0, AY, AZ], .035, alu, bike);
    mesh(new T.CylinderGeometry(.045, .045, .09, 18), orange, 0, 1.2, .62, bike);
    // flywheel housing at the crank
    const hous = new T.Group(); hous.position.set(0, AY, AZ); bike.add(hous);
    const hd = mesh(new T.CylinderGeometry(.31, .31, .16, 56), dark, 0, 0, 0, hous); hd.rotation.z = Math.PI / 2;
    [-.082, .082].forEach(x => { const r = mesh(new T.TorusGeometry(.305, .014, 8, 64), new T.MeshStandardMaterial({ color: 0x103048, emissive: 0x4cc9f0, emissiveIntensity: 1.1 }), x, 0, 0, hous); r.rotation.y = Math.PI / 2; });
    flyG = new T.Group(); flyG.position.set(.083, 0, 0); hous.add(flyG);
    const fd = new T.Mesh(new T.CircleGeometry(.285, 56), new T.MeshStandardMaterial({ map: spokesTexture(), roughness: .5, metalness: .6 })); fd.rotation.y = Math.PI / 2; flyG.add(fd);
    const fd2 = new T.Mesh(new T.CircleGeometry(.285, 56), new T.MeshStandardMaterial({ map: spokesTexture(), roughness: .5, metalness: .6 })); fd2.rotation.y = -Math.PI / 2; fd2.position.set(-.166, 0, 0); hous.add(fd2);
    const lab = new T.Mesh(new T.PlaneGeometry(.34, .09), new T.MeshStandardMaterial({ map: labelTexture('CEVIS', 256, 68, '#0a1428', '#4cc9f0'), roughness: .5 })); lab.position.set(.0835, -.2, 0); lab.rotation.y = Math.PI / 2; hous.add(lab);
    // crank + pedals (pedals stay level)
    mesh(new T.CylinderGeometry(.022, .022, .6, 14), steel, 0, AY, AZ, bike).rotation.z = Math.PI / 2;
    crank = new T.Group(); crank.position.set(0, AY, AZ); bike.add(crank);
    mesh(new T.BoxGeometry(.035, A.r + .04, .032), alu, .14, A.r / 2, 0, crank); mesh(new T.BoxGeometry(.035, A.r + .04, .032), alu, -.14, -A.r / 2, 0, crank);
    function pedal(side) {
      const g = new T.Group(); g.position.set(side * .19, side * A.r, 0); crank.add(g);
      mesh(new T.BoxGeometry(.1, .026, .17), dark, 0, 0, 0, g); mesh(new T.BoxGeometry(.1, .008, .17), M({ color: 0xffd23f, roughness: .5 }), 0, .016, 0, g);
      const cage = mesh(new T.TorusGeometry(.055, .012, 6, 14, Math.PI), orange, 0, .02, .08, g); cage.rotation.y = Math.PI / 2; cage.rotation.z = 0;
      mesh(new T.BoxGeometry(.1, .012, .07), orange, 0, .06, .02, g);
      return g;
    }
    pedalR = pedal(1); pedalL = pedal(-1);
    // saddle
    const sd = mesh(new T.CapsuleGeometry(.085, .2, 8, 20), leather, 0, 1.03, -.34, bike); sd.rotation.x = Math.PI / 2; sd.scale.set(1.9, 1, .95);
    mesh(new T.CylinderGeometry(.03, .03, .1, 12), steel, 0, .95, -.34, bike);
    const st = mesh(new T.TorusGeometry(.12, .004, 4, 24), new T.MeshBasicMaterial({ color: 0xff4d5e }), 0, 1.07, -.34, bike); st.rotation.x = Math.PI / 2; st.scale.set(1, 2.2, 1);
    // handlebars + console
    tube([0, 1.2, .62], [0, 1.29, .56], .028, alu, bike);
    const bar = mesh(new T.CylinderGeometry(.019, .019, .64, 14), alu, 0, GRIP.y, GRIP.z, bike); bar.rotation.z = Math.PI / 2;
    [-.29, .29].forEach(x => { const g = mesh(new T.CylinderGeometry(.027, .027, .14, 14), rubber, x, GRIP.y, GRIP.z, bike); g.rotation.z = Math.PI / 2; });
    const con = mesh(new T.BoxGeometry(.26, .16, .05), dark, 0, 1.4, .6, bike); con.rotation.x = -.5;
    const cc = document.createElement('canvas'); cc.width = 256; cc.height = 160; cg = cc.getContext('2d'); ctexC = new T.CanvasTexture(cc); ctexC.encoding = T.sRGBEncoding;
    const cs = new T.Mesh(new T.PlaneGeometry(.23, .13), new T.MeshBasicMaterial({ map: ctexC, toneMapped: false })); cs.position.set(0, 1.4 + .004, .6 + .027); cs.rotation.x = -.5; cs.position.y += .012; bike.add(cs);
    // label on the seat tube
    const l2 = new T.Mesh(new T.PlaneGeometry(.16, .045), new T.MeshStandardMaterial({ map: labelTexture('CEVIS', 256, 72, '#ff7a1a', '#101216'), roughness: .5 })); l2.position.set(.036, .62, -.07); l2.rotation.y = Math.PI / 2; l2.rotation.z = -.55; bike.add(l2);
    return bike;
  }

  /* ---------- the astronaut (origin = hips; faces +z) ---------- */
  function buildAstronaut(parent) {
    const body = new T.Group(); parent.add(body);
    const sw = M({ color: 0xeef1f7, roughness: .78, metalness: .02 }), sw2 = M({ color: 0xd3d9e6, roughness: .72, metalness: .05 }), grey = M({ color: 0x8a92a4, roughness: .45, metalness: .5 });
    const dark = M({ color: 0x2a2f3d, roughness: .6, metalness: .3 }), glove = M({ color: 0x4b5368, roughness: .9 }), gold = M({ color: 0xe0a93b, roughness: .05, metalness: 1 }), orange = M({ color: 0xff7a1a, roughness: .6 });
    const green = new T.MeshStandardMaterial({ color: 0x2ee6a6, emissive: 0x2ee6a6, emissiveIntensity: 1.2 });
    const hips = mesh(new T.SphereGeometry(.27, 24, 16), sw2, 0, .03, 0, body); hips.scale.set(1, .62, .8);
    torso = mesh(new T.CapsuleGeometry(.27, .22, 8, 24), sw, 0, .33, 0, body); torso.scale.set(1, 1, .78);
    const belt = mesh(new T.TorusGeometry(.27, .035, 10, 32), green, 0, .08, 0, body); belt.rotation.x = Math.PI / 2; belt.scale.set(1, .8, 1);
    mesh(new T.BoxGeometry(.34, .24, .12), grey, 0, .41, .23, body); mesh(new T.BoxGeometry(.3, .035, .02), green, 0, .55, .29, body);
    const scr = ctex(128, 64, (g, w, h) => { g.fillStyle = '#04101e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2ee6a6'; g.lineWidth = 3; g.beginPath(); g.moveTo(4, 34); g.lineTo(34, 34); g.lineTo(42, 12); g.lineTo(52, 54); g.lineTo(62, 34); g.lineTo(124, 34); g.stroke(); });
    const sp = new T.Mesh(new T.PlaneGeometry(.22, .1), new T.MeshBasicMaterial({ map: scr, toneMapped: false })); sp.position.set(0, .43, .292); body.add(sp);
    const pt = new T.Mesh(new T.CircleGeometry(.055, 24), new T.MeshBasicMaterial({ map: K.patchTexture(), toneMapped: false, transparent: true })); pt.position.set(-.2, .55, .3); body.add(pt);
    mesh(new T.BoxGeometry(.56, .72, .3), grey, 0, .35, -.32, body); mesh(new T.BoxGeometry(.5, .1, .26), dark, 0, .74, -.32, body);
    [-.16, .16].forEach(x => mesh(new T.CylinderGeometry(.08, .08, .5, 16), sw2, x, .35, -.52, body));
    const hose = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.2, .47, .22), new T.Vector3(-.36, .35, .12), new T.Vector3(-.34, .17, -.05), new T.Vector3(-.2, .07, -.28)]), 24, .022, 8), orange); hose.castShadow = true; body.add(hose);
    const neck = mesh(new T.TorusGeometry(.2, .04, 12, 32), green, 0, .69, 0, body); neck.rotation.x = Math.PI / 2;
    mesh(new T.SphereGeometry(.285, 40, 28), sw, 0, .89, 0, body);
    mesh(new T.SphereGeometry(.297, 40, 28, -Math.PI * .62, Math.PI * 1.24, Math.PI * .22, Math.PI * .5), gold, 0, .895, .01, body).castShadow = false;
    [-.17, .17].forEach(x => mesh(new T.BoxGeometry(.06, .05, .06), new T.MeshBasicMaterial({ color: 0xfff6d0 }), x, 1.09, .17, body)); mesh(new T.BoxGeometry(.07, .06, .08), dark, .3, .93, .02, body);
    function arm(side) {
      const sh = new T.Group(); sh.position.set(side * .37, .55, 0); body.add(sh);
      mesh(new T.SphereGeometry(.13, 18, 14), sw2, 0, 0, 0, sh); mesh(new T.CapsuleGeometry(.095, .24, 6, 16), sw, 0, -.23, 0, sh);
      const el = new T.Group(); el.position.set(0, -.46, 0); sh.add(el);
      mesh(new T.SphereGeometry(.1, 16, 12), sw2, 0, 0, 0, el); mesh(new T.CapsuleGeometry(.085, .22, 6, 16), sw, 0, -.2, 0, el);
      mesh(new T.TorusGeometry(.085, .022, 8, 20), grey, 0, -.37, 0, el).rotation.x = Math.PI / 2;
      mesh(new T.SphereGeometry(.105, 16, 12), glove, 0, -.46, 0, el).scale.set(1.1, 1.1, .95);
      return { sh, el };
    }
    const aL = arm(-1), aR = arm(1); shL = aL.sh; elL = aL.el; shR = aR.sh; elR = aR.el;
    function leg(side) {
      const hp = new T.Group(); hp.position.set(side * .14, 0, 0); body.add(hp);
      mesh(new T.CapsuleGeometry(.12, .26, 6, 16), sw, 0, -.25, 0, hp);
      const kn = new T.Group(); kn.position.set(0, -.5, 0); hp.add(kn);
      mesh(new T.SphereGeometry(.115, 16, 12), sw2, 0, 0, 0, kn); mesh(new T.CapsuleGeometry(.1, .26, 6, 16), sw, 0, -.24, 0, kn);
      const an = new T.Group(); an.position.set(0, -.5, 0); kn.add(an);
      mesh(new T.BoxGeometry(.2, .14, .34), dark, 0, 0, .07, an); mesh(new T.BoxGeometry(.21, .05, .36), grey, 0, -.07, .07, an);
      return { hp, kn, an };
    }
    const lL = leg(-1), lR = leg(1); hipL = lL.hp; kneeL = lL.kn; ankleL = lL.an; hipR = lR.hp; kneeR = lR.kn; ankleR = lR.an;
    body.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return body;
  }

  /* ---------- two-link inverse kinematics in the (y,z) plane ---------- */
  function ik(Hy, Hz, Ty, Tz, L1, L2) {
    const dy = Ty - Hy, dz = Tz - Hz; let d = Math.hypot(dy, dz); d = clamp(d, .25, L1 + L2 - .004);
    const th0 = Math.atan2(dz, -dy), g = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), psi = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    return { th0, g, flex: Math.PI - psi };
  }

  /* ---------- room ---------- */
  function buildRoom() {
    const wt = K.wallTexture(), ft = K.floorTexture();
    const wm = (w, h) => { const t = wt.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(w / 3, h / 3); return M({ map: t, roughness: .7, metalness: .25 }); };
    const plane = (w, h, x, y, z, rx, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), wm(w, h)); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); m.receiveShadow = true; scene.add(m); };
    const D = 26, CZ = 9.4, bz = -3.6;
    const fl = new T.Mesh(new T.PlaneGeometry(9, D), M({ map: ft, roughness: .45, metalness: .5 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, CZ); fl.receiveShadow = true; scene.add(fl);
    plane(9, D, 0, 5, CZ, Math.PI / 2, 0); plane(D, 5, -4.5, 2.5, CZ, 0, Math.PI / 2); plane(D, 5, 4.5, 2.5, CZ, 0, -Math.PI / 2);
    plane(1.1, 5, -3.95, 2.5, bz); plane(5.3, 5, 1.85, 2.5, bz); plane(2.6, 1.7, -2.1, 4.15, bz); plane(2.6, .9, -2.1, .45, bz);
    const fm = M({ color: 0x222838, roughness: .4, metalness: .8 }), fb = (w, h, x, y) => mesh(new T.BoxGeometry(w, h, .22), fm, x, y, bz - .02, scene);
    fb(2.8, .12, -2.1, 3.3); fb(2.8, .12, -2.1, .9); fb(.12, 2.52, -3.4, 2.1); fb(.12, 2.52, -.8, 2.1);
    // outside: stars + Earth
    const sg = new T.BufferGeometry(), n = 1200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = Math.random() * 6.283, ph = Math.acos(Math.random() * 2 - 1); pos[i * 3] = 160 * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = 160 * Math.cos(ph); pos[i * 3 + 2] = 160 * Math.sin(ph) * Math.sin(th); }
    sg.setAttribute('position', new T.BufferAttribute(pos, 3)); scene.add(new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
    const eg = new T.Group(); eg.add(new T.Mesh(new T.SphereGeometry(12, 56, 40), new T.MeshStandardMaterial({ map: K.earthTexture(), roughness: .9, emissive: 0x0a2a60, emissiveIntensity: .35 })), new T.Mesh(new T.SphereGeometry(12.5, 40, 28), new T.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: .28, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false })));
    eg.position.set(-14, -9, -40); scene.add(eg); api._earth = eg;
    // handrails + ceiling lights
    const rail = M({ color: 0xc0c7d6, metalness: .9, roughness: .25 }); [-4.35, 4.35].forEach(x => { mesh(new T.CylinderGeometry(.035, .035, 12, 12), rail, x, 1.4, 2, scene).rotation.x = Math.PI / 2; });
    [-2, 2].forEach(x => mesh(new T.BoxGeometry(.5, .06, 14), new T.MeshBasicMaterial({ color: 0xffffff }), x, 4.94, 2, scene));
    // CEVIS data panel (behind the bike)
    mesh(new T.BoxGeometry(3.9, 2.45, .14), M({ color: 0x151a28, roughness: .4, metalness: .8 }), 2.2, 2.45, bz + .05, scene);
    const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 640; pg = pc.getContext('2d'); ptex = new T.CanvasTexture(pc); ptex.encoding = T.sRGBEncoding; ptex.anisotropy = 4;
    const sc = new T.Mesh(new T.PlaneGeometry(3.6, 2.25), new T.MeshBasicMaterial({ map: ptex, toneMapped: false })); sc.position.set(2.2, 2.45, bz + .13); scene.add(sc);
    lamp = new T.Mesh(new T.BoxGeometry(3.6, .08, .06), new T.MeshBasicMaterial({ color: 0x6f7c99 })); lamp.position.set(2.2, 3.8, bz + .12); scene.add(lamp);
    mesh(new T.BoxGeometry(3.9, .9, .6), M({ color: 0x2a3042, roughness: .5, metalness: .6 }), 2.2, .45, bz + .45, scene);
  }

  /* ---------- panel with bike data ---------- */
  function drawPanel(t) {
    const d = getData() || {}, g = pg, w = 1024, h = 640, goal = d.goal || 21, n = d.n || 0, on = !!d.on, done = !!d.done;
    const power = Math.round(rpm > 1 ? 22 + rpm * 1.15 : 0), col = on ? '#2ee6a6' : done ? '#ffd23f' : '#7f8fb0';
    g.fillStyle = '#04091a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(76,201,240,.10)'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#4cc9f0'; g.font = 'bold 34px "Segoe UI",Arial'; g.fillText('SPACEFIT · CEVIS BIKE DATA', 28, 50);
    g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(716, 14, 280, 48, 24) : g.rect(716, 14, 280, 48); g.fill(); g.fillStyle = '#04091a'; g.font = 'bold 26px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(on ? 'EXERCISING' : done ? 'SESSION DONE' : 'READY', 856, 48); g.textAlign = 'left';
    // cadence gauge
    const cx = 220, cy = 270, r = 150; g.lineWidth = 26; g.lineCap = 'round';
    g.strokeStyle = '#16203a'; g.beginPath(); g.arc(cx, cy, r, Math.PI * .8, Math.PI * 2.2); g.stroke();
    const f = clamp(rpm / 120, 0, 1); g.strokeStyle = f > .75 ? '#ff7a8a' : '#2ee6a6'; g.beginPath(); g.arc(cx, cy, r, Math.PI * .8, Math.PI * (.8 + 1.4 * f)); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 96px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(String(Math.round(rpm)), cx, cy + 28); g.fillStyle = '#9aa7c7'; g.font = '26px "Segoe UI",Arial'; g.fillText('CADENCE · rpm', cx, cy + 74); g.textAlign = 'left';
    const stat = (label, val, unit, x, y, c) => { g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(label, x, y); g.fillStyle = c || '#fff'; g.font = 'bold 54px "Segoe UI",Arial'; g.fillText(val, x, y + 52); const wv = g.measureText(val).width; g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(unit, x + wv + 8, y + 52); };
    stat('POWER', String(power), 'W', 460, 100, '#ffd23f'); stat('HEART RATE', String(Math.round(hrShown)), 'bpm', 720, 100, '#ff7a8a');
    stat('TIME LEFT', on ? String(d.t != null ? d.t : 10) : '10', 's', 460, 214); stat('PEDAL STROKES', n + '/' + goal, '', 720, 214, n >= goal ? '#2ee6a6' : '#fff');
    stat('RESISTANCE', 'LEVEL 6', '', 460, 328, '#4cc9f0'); stat('ENERGY', kcal.toFixed(1), 'kcal', 720, 328);
    // progress + sparkline
    g.fillStyle = '#16203a'; g.fillRect(28, 470, 968, 22); g.fillStyle = col; g.fillRect(28, 470, 968 * clamp(n / goal, 0, 1), 22);
    g.fillStyle = '#020611'; g.fillRect(28, 420 - 0, 400, 38); g.strokeStyle = '#2ee6a6'; g.lineWidth = 3; g.beginPath(); cadHist.forEach((v, i) => { const x = 28 + i / 120 * 400, y = 458 - clamp(v / 120, 0, 1) * 34; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    // equipment status
    const dot = (txt, x, y, ok) => { g.fillStyle = ok ? '#2ee6a6' : '#ff4d5e'; g.beginPath(); g.arc(x, y - 8, 9, 0, 7); g.fill(); g.fillStyle = '#d6def5'; g.font = '24px "Segoe UI",Arial'; g.fillText(txt, x + 20, y); };
    dot('Floor mount: LOCKED', 40, 540, true); dot('Vibration isolation: ACTIVE', 360, 540, true); dot('Harness: SECURED', 720, 540, true);
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText('Bone & muscle loading · ' + (d.env || 'ISS'), 28, 600); g.textAlign = 'right'; g.fillText('● LIVE', 996, 600); g.textAlign = 'left';
    ptex.needsUpdate = true;
    // handlebar console
    const c = cg; c.fillStyle = '#04101e'; c.fillRect(0, 0, 256, 160); c.fillStyle = '#4cc9f0'; c.font = 'bold 22px Arial'; c.fillText('CEVIS', 12, 28); c.fillStyle = '#fff'; c.font = 'bold 64px Arial'; c.fillText(String(Math.round(rpm)), 12, 96); c.fillStyle = '#9aa7c7'; c.font = '20px Arial'; c.fillText('rpm', 150, 96);
    c.fillStyle = '#ffd23f'; c.font = 'bold 30px Arial'; c.fillText(power + ' W', 12, 140); c.fillStyle = '#ff7a8a'; c.fillText(Math.round(hrShown) + ' bpm', 130, 140); ctexC.needsUpdate = true;
  }

  /* ---------- loop ---------- */
  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    const cutoff = performance.now() - 3000; while (strokes.length && strokes[0] < cutoff) strokes.shift();
    const target = strokes.length / 3 * 60 / 2; rpm += (target - rpm) * Math.min(1, dt * 4);
    crankA += (crankT - crankA) * Math.min(1, dt * 10); flyA += (rpm / 60) * Math.PI * 2 * 2.2 * dt;
    const pw = rpm > 1 ? 22 + rpm * 1.15 : 0; kj += pw * dt / 1000; kcal = kj / 4.184;
    const baseHr = (getData() || {}).hr || 72; hrShown += ((baseHr + rpm * .5) - hrShown) * Math.min(1, dt * .8);
    if (now - lastPanel > 90) { lastPanel = now; cadHist.push(rpm); if (cadHist.length > 120) cadHist.shift(); drawPanel(t); }
    // animate the bike
    crank.rotation.x = crankA; pedalR.rotation.x = -crankA; pedalL.rotation.x = -crankA; flyG.rotation.x = flyA;
    // rider pose through IK
    const a = crankA, pR = { y: A.y + A.r * Math.cos(a), z: A.z + A.r * Math.sin(a) }, pL = { y: A.y - A.r * Math.cos(a), z: A.z - A.r * Math.sin(a) };
    const lean = LEAN + Math.sin(t * 1.3) * .012; rider.rotation.x = lean; rider.position.set(0, HIP.y + Math.sin(a * 2) * .008, HIP.z);
    [[hipR, kneeR, ankleR, pR], [hipL, kneeL, ankleL, pL]].forEach(([hp, kn, an, p]) => {
      const k = ik(HIP.y, HIP.z, p.y + .13, p.z, .5, .5), at = k.th0 + k.g; hp.rotation.x = -at - lean; kn.rotation.x = k.flex; an.rotation.x = at - k.flex;
    });
    const Sy = HIP.y + .55 * Math.cos(lean), Sz = HIP.z + .55 * Math.sin(lean);
    [[shL, elL], [shR, elR]].forEach(([sh, el]) => { const k = ik(Sy, Sz, GRIP.y, GRIP.z, .46, .46), au = k.th0 - k.g; sh.rotation.x = -au - lean; el.rotation.x = -k.flex; });
    shL.rotation.z = -.1; shR.rotation.z = .1;
    lamp.material.color.set((getData() || {}).on ? 0x2ee6a6 : 0x6f7c99);
    api._earth.rotation.y = t * .01;
    cam.position.x = Math.sin(t * .2) * .25 - .8 + drag.yaw * .6; cam.position.y = camBase.y + Math.sin(t * .27) * .04; cam.lookAt(.1, 1.0, 0);
    R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 3.9, needW = clamp(a * 4.2, 3.4, 6.2);
    cam.position.z = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)); cam.updateProjectionMatrix();
  }

  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; getData = opts.getData || getData;
    try {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
      stage.insertBefore(canvas, stage.firstChild);
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02040c); cam = new T.PerspectiveCamera(38, 1, .1, 400); cam.position.set(-.8, camBase.y, camBase.z);
      const envS = new T.Scene(); envS.background = new T.Color(0x0a1226);
      [[6, 3, 0, 6, 0, 0xffffff, 6], [4, 4, -7, 2, 2, 0xcfe6ff, 4], [4, 2, 6, 1, -4, 0xffd9a0, 3], [8, 3, 0, -6, 0, 0x4cc9f0, 1.2], [5, 5, 0, 2, -8, 0x2b6fd6, 1.5]].forEach(([w, h, x, y, z, c, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); });
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(envS, .02).texture; pm.dispose();
      scene.add(new T.HemisphereLight(0xbfd8ff, 0x2a2f44, .55));
      const key = new T.DirectionalLight(0xfff2e0, 1.6); key.position.set(3, 6, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const s = key.shadow.camera; s.left = -3; s.right = 3; s.top = 4; s.bottom = -1.5; s.near = 1; s.far = 20; key.shadow.bias = -.0004; key.target.position.set(0, 1, 0); scene.add(key, key.target);
      const rim = new T.DirectionalLight(0x9fd0ff, 1.0); rim.position.set(-6, 3, -8); scene.add(rim);
      const sl = new T.PointLight(0x4cc9f0, 1.2, 9); sl.position.set(2.2, 2.4, -2.2); scene.add(sl);
      buildRoom();
      rig = new T.Group(); rig.position.set(-.2, 0, .5); rig.rotation.y = 1.15; scene.add(rig);
      const bike = buildBike(rig);
      rider = new T.Group(); rider.position.set(0, HIP.y, HIP.z); bike.add(rider); buildAstronaut(rider);
      const ray = new T.Raycaster(), mv = new T.Vector2();
      const hitAstro = e => { const r = canvas.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); return ray.intersectObject(rider, true).length > 0; };
      let downX = 0, moved = 0; onAstro = opts.onAstronautClick || null;
      canvas.addEventListener('pointerdown', e => { drag.down = true; drag.x = downX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag.down) { canvas.style.cursor = hitAstro(e) ? 'pointer' : 'grab'; return; } moved = Math.max(moved, Math.abs(e.clientX - downX)); canvas.style.cursor = 'grabbing'; drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .008, -1.4, 1.4); drag.x = e.clientX; });
      canvas.addEventListener('pointerup', e => { const was = drag.down; drag.down = false; canvas.style.cursor = 'grab'; if (was && moved < 6 && onAstro && hitAstro(e)) onAstro(); });
      canvas.addEventListener('pointercancel', () => { drag.down = false; canvas.style.cursor = 'grab'; });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D bike unavailable, using the 2D drawing instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false; }
  };
  /* reusable astronaut (origin = hips) for other scenes; keeps this scene's own joints untouched */
  api.makeAstronaut = function (parent, opts) {
    const sv = { shL, shR, elL, elR, hipL, hipR, kneeL, kneeR, ankleL, ankleR, torso };
    const body = buildAstronaut(parent), out = { body, shL, shR, elL, elR, hipL, hipR, kneeL, kneeR, ankleL, ankleR, torso };
    out.shell = body.children.find(o => o.isMesh && o.geometry.type === 'SphereGeometry' && Math.abs(o.geometry.parameters.radius - .285) < 1e-3);
    out.visor = body.children.find(o => o.isMesh && o.geometry.type === 'SphereGeometry' && Math.abs(o.geometry.parameters.radius - .297) < 1e-3);
    if (opts && opts.noChest) {   // keep the backpack, only free the chest for the stethoscope
      body.children.filter(o => o.isMesh && o.position.z > .2 && o.position.y > .35 && o.position.y < .6 && Math.abs(o.position.x) < .25).forEach(o => body.remove(o));
    }
    if (opts && opts.bare) {   // patient on a stretcher: no backpack, hose or chest unit (chest stays free for electrodes)
      body.children.filter(o => o.isMesh && (o.position.z < -.3 || (o.geometry && o.geometry.type === 'TubeGeometry') || (o.position.z > .2 && o.position.y > .35 && o.position.y < .6 && Math.abs(o.position.x) < .25))).forEach(o => body.remove(o));
    }
    ({ shL, shR, elL, elR, hipL, hipR, kneeL, kneeR, ankleL, ankleR, torso } = sv);
    return out;
  };
  api.pedal = function () { strokes.push(performance.now()); crankT += Math.PI; };
  api.reset = function () { strokes.length = 0; cadHist.length = 0; rpm = 0; kj = 0; kcal = 0; };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
})();
