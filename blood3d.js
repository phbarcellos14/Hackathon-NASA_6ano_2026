/* Blood test (Microflow) in 3D (Three.js r149): a seated astronaut strapped to a floor-mounted chair, a tourniquet and a syringe on the arm,
   the blood travels through a transfer tube to a Microflow analyzer on the ship's lab bench and the results appear on the cabin panel.
   Needs cabin3d.js + bike3d.js.  API: Blood3d.init(stage,{getData,level,onPhase,onDone,onTap}) · measure(glu,spo2) · show(glu,spo2) · reset() · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D, B = window.Bike3D;
  const api = { ready: false, failed: false };
  window.Blood3d = api;
  if (!T || !C || !C.kit || !B || !B.makeAstronaut) { api.failed = true; return; }
  const K = C.kit, M = K.M, ctex = K.ctex, clamp = K.clamp, mesh = K.mesh;
  const V = (x, y, z) => new T.Vector3(x, y, z), Y = V(0, 1, 0);

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, getData = () => ({}), level = () => 0, onPhase = () => {}, onDone = () => {};
  let t0 = performance.now(), lastPanel = 0, pg, ptex, lamp, drag = { yaw: 0, down: false, x: 0 }, onTap = null;
  let A, band, vein, syr, syrFill, syrPlunger, beads = [], rotor, ledBar, azg, aztex, flowCurve, hitG, ring, portPos, trayPos, trayQuat, camBase = { y: 1.9, z: 7 };
  let camTip = null, curPos = null, curLook = null;
  let seq = null, res = { glu: null, spo2: null }, lastPhase = -1;
  const DUR = [1.0, 1.0, 2.6, .8, 2.2, 3.4], PH = ['tq', 'insert', 'draw', 'withdraw', 'transfer', 'analyze'];
  const TIP = V(0, -.03, .1), DIR = V(0, -Math.cos(.35), Math.sin(.35)).normalize();   // needle tip + barrel direction in elbow-local space
  const ease = p => p * p * (3 - 2 * p), lerp = (a, b, p) => a + (b - a) * p;

  /* ---------- room + lab bench ---------- */
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
    // results panel
    mesh(new T.BoxGeometry(3.9, 2.0, .14), M({ color: 0x151a28, roughness: .4, metalness: .8 }), 2.45, 2.85, bz + .05, scene);
    const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 560; pg = pc.getContext('2d'); ptex = new T.CanvasTexture(pc); ptex.encoding = T.sRGBEncoding; ptex.anisotropy = 4;
    const sc = new T.Mesh(new T.PlaneGeometry(3.6, 1.97), new T.MeshBasicMaterial({ map: ptex, toneMapped: false })); sc.position.set(2.45, 2.85, bz + .13); scene.add(sc);
    lamp = new T.Mesh(new T.BoxGeometry(3.6, .07, .06), new T.MeshBasicMaterial({ color: 0x6f7c99 })); lamp.position.set(2.45, 3.88, bz + .12); scene.add(lamp);
  }
  function bench() {
    const white = M({ color: 0xe9edf5, roughness: .35, metalness: .15 }), dark = M({ color: 0x20242f, roughness: .5, metalness: .4 }), steel = M({ color: 0xb8c0d0, roughness: .25, metalness: .9 });
    const cab = M({ color: 0x38445f, roughness: .55, metalness: .5 });
    const bx = 2.3, bz = -3.2, top = .95;
    mesh(new T.BoxGeometry(4.1, .84, .78), cab, bx, .42, bz, scene);                       // cabinets
    for (let i = 0; i < 6; i++) { mesh(new T.BoxGeometry(.01, .78, .005), dark, bx - 1.7 + i * .68, .42, bz + .395, scene); mesh(new T.BoxGeometry(.2, .018, .02), steel, bx - 1.7 + i * .68 + .12, .62, bz + .4, scene); }
    mesh(new T.BoxGeometry(4.2, .06, .86), M({ color: 0xd9dfeb, roughness: .2, metalness: .3 }), bx, top - .03, bz, scene);   // counter top
    // Microflow analyzer
    const an = new T.Group(); an.position.set(2.05, top, bz); scene.add(an);
    mesh(new T.BoxGeometry(.7, .36, .5), white, 0, .18, 0, an); mesh(new T.BoxGeometry(.72, .05, .52), dark, 0, .02, 0, an);
    mesh(new T.BoxGeometry(.62, .2, .02), dark, 0, .2, .255, an);
    const ac = document.createElement('canvas'); ac.width = 256; ac.height = 160; azg = ac.getContext('2d'); aztex = new T.CanvasTexture(ac); aztex.encoding = T.sRGBEncoding;
    const asc = new T.Mesh(new T.PlaneGeometry(.34, .15), new T.MeshBasicMaterial({ map: aztex, toneMapped: false })); asc.position.set(-.1, .21, .268); an.add(asc);
    const slot = mesh(new T.BoxGeometry(.16, .035, .02), new T.MeshStandardMaterial({ color: 0x000000, emissive: 0x4cc9f0, emissiveIntensity: .9 }), .2, .24, .27, an);
    mesh(new T.BoxGeometry(.1, .014, .012), new T.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0xffffff, emissiveIntensity: .4 }), .2, .24, .285, an);     // cartridge sticking out
    ledBar = []; for (let i = 0; i < 6; i++) ledBar.push(mesh(new T.BoxGeometry(.03, .012, .008), new T.MeshStandardMaterial({ color: 0x103030, emissive: 0x103030 }), .1 + i * .04, .17, .27, an));
    const win = mesh(new T.CylinderGeometry(.1, .1, .02, 32), new T.MeshStandardMaterial({ color: 0x0a1428, roughness: .2, metalness: .6 }), .0, .34, .0, an);  // top window (rotor visible)
    rotor = new T.Group(); rotor.position.set(0, .358, 0); an.add(rotor);
    mesh(new T.CylinderGeometry(.085, .085, .008, 40), new T.MeshStandardMaterial({ color: 0x9fb4d8, metalness: .9, roughness: .25 }), 0, 0, 0, rotor);
    for (let i = 0; i < 6; i++) { const a = i * 1.047; mesh(new T.BoxGeometry(.075, .01, .014), new T.MeshStandardMaterial({ color: 0xff4d5e, emissive: 0x551018 }), Math.cos(a) * .045, .006, Math.sin(a) * .045, rotor).rotation.y = -a; }
    const glass = mesh(new T.CylinderGeometry(.1, .1, .02, 32), new T.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: .2, roughness: .05 }), 0, .372, 0, an); glass.castShadow = false;
    mesh(new T.CylinderGeometry(.02, .02, .03, 12), steel, -.27, .38, -.12, an);         // sample inlet
    const inlet = new T.Vector3(); an.updateMatrixWorld(true); an.localToWorld(inlet.set(-.27, .4, -.12)); api._inlet = inlet.clone();
    // centrifuge
    const cf = new T.Group(); cf.position.set(3.05, top, bz); scene.add(cf);
    mesh(new T.CylinderGeometry(.22, .25, .2, 40), white, 0, .1, 0, cf); mesh(new T.CylinderGeometry(.2, .2, .06, 40), new T.MeshStandardMaterial({ color: 0xcfe3ff, transparent: true, opacity: .55, roughness: .1 }), 0, .23, 0, cf);
    mesh(new T.BoxGeometry(.2, .05, .02), new T.MeshStandardMaterial({ color: 0x04101e, emissive: 0x2ee6a6, emissiveIntensity: .5 }), 0, .1, .245, cf); mesh(new T.CylinderGeometry(.02, .02, .02, 12), new T.MeshStandardMaterial({ color: 0xff4d5e, emissive: 0xff4d5e, emissiveIntensity: .6 }), .12, .05, .22, cf).rotation.x = Math.PI / 2;
    // test-tube rack
    const rk = new T.Group(); rk.position.set(.95, top, bz + .05); scene.add(rk);
    mesh(new T.BoxGeometry(.4, .02, .12), steel, 0, .1, 0, rk); mesh(new T.BoxGeometry(.4, .02, .12), steel, 0, .01, 0, rk);
    [[-.15, 0xff4d5e], [-.075, 0xffd23f], [0, 0x4cc9f0], [.075, 0x2ee6a6], [.15, 0xb072ff]].forEach(([x, c]) => { mesh(new T.CylinderGeometry(.014, .014, .15, 12), new T.MeshStandardMaterial({ color: 0xdfeeff, transparent: true, opacity: .55, roughness: .1 }), x, .075, 0, rk); mesh(new T.CylinderGeometry(.016, .016, .02, 12), M({ color: c, roughness: .5 }), x, .16, 0, rk); mesh(new T.CylinderGeometry(.0125, .0125, .06, 12), M({ color: 0xb3121f, roughness: .3 }), x, .04, 0, rk); });
    // sharps container, glove box, bottle, pipette stand, tablet
    mesh(new T.BoxGeometry(.18, .22, .14), M({ color: 0xffd23f, roughness: .6 }), 3.75, top + .11, bz + .1, scene); mesh(new T.BoxGeometry(.19, .04, .15), M({ color: 0xff4d5e, roughness: .6 }), 3.75, top + .24, bz + .1, scene);
    mesh(new T.BoxGeometry(.26, .09, .13), M({ color: 0x2b86e8, roughness: .6 }), 3.5, top + .045, bz + .2, scene); mesh(new T.BoxGeometry(.06, .08, .05), M({ color: 0xffffff, roughness: .9 }), 3.5, top + .13, bz + .2, scene);
    mesh(new T.CylinderGeometry(.035, .035, .14, 16), M({ color: 0xffffff, roughness: .3 }), 1.4, top + .07, bz + .25, scene); mesh(new T.CylinderGeometry(.012, .012, .04, 8), steel, 1.4, top + .16, bz + .25, scene);
    mesh(new T.CylinderGeometry(.02, .03, .3, 12), steel, 2.7, top + .15, bz - .2, scene); mesh(new T.CylinderGeometry(.012, .012, .22, 8), M({ color: 0x2b86e8 }), 2.7, top + .4, bz - .2, scene);
    const tb = mesh(new T.BoxGeometry(.28, .01, .2), dark, 1.6, top + .005, bz + .22, scene); tb.rotation.y = .2;
    return an;
  }

  /* ---------- fixed seat ---------- */
  function seat(rig) {
    const steel = M({ color: 0x8d96a8, metalness: .95, roughness: .35 }), cush = M({ color: 0x2f5fa8, roughness: .8 }), dark = M({ color: 0x20242f, roughness: .6, metalness: .3 }), orange = M({ color: 0xff7a1a, roughness: .55 });
    mesh(new T.CylinderGeometry(.3, .33, .04, 36), steel, 0, .02, .08, rig); mesh(new T.CylinderGeometry(.34, .34, .01, 36), M({ color: 0xffd23f, roughness: .6 }), 0, .004, .08, rig);
    for (let i = 0; i < 6; i++) { const a = i * 1.047; mesh(new T.CylinderGeometry(.018, .018, .03, 6), dark, Math.cos(a) * .24, .05, .08 + Math.sin(a) * .24, rig); }
    mesh(new T.CylinderGeometry(.06, .08, .38, 20), steel, 0, .22, .08, rig); mesh(new T.BoxGeometry(.62, .09, .66), cush, 0, .47, .06, rig); mesh(new T.BoxGeometry(.66, .03, .7), dark, 0, .415, .06, rig);
    mesh(new T.BoxGeometry(.58, .72, .1), cush, 0, .96, -.32, rig); mesh(new T.BoxGeometry(.2, .16, .08), cush, 0, 1.46, -.32, rig); mesh(new T.BoxGeometry(.6, .1, .04), dark, 0, .6, -.38, rig);
    // lap belt + shoulder straps
    const band = (a, b, w) => { const p = V(...a), q = V(...b), d = q.clone().sub(p), m = new T.Mesh(new T.BoxGeometry(w, .012, d.length()), orange); m.position.copy(p).addScaledVector(d, .5); m.lookAt(q); m.castShadow = true; rig.add(m); };
    band([-.34, .6, -.1], [.34, .6, -.1], .07); [-.14, .14].forEach(x => band([x, 1.42, -.26], [x * .3, .66, .02], .055)); mesh(new T.BoxGeometry(.08, .03, .05), steel, 0, .63, .0, rig);
  }

  /* ---------- syringe ---------- */
  function makeSyringe() {
    const g = new T.Group(), glass = new T.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: .3, roughness: .06, depthWrite: false }), steel = M({ color: 0xc9d0dc, metalness: .95, roughness: .2 });
    mesh(new T.CylinderGeometry(.0035, .0035, .042, 8), steel, 0, .021, 0, g);
    mesh(new T.CylinderGeometry(.009, .004, .012, 12), M({ color: 0x2b86e8, roughness: .5 }), 0, .048, 0, g);
    const barrel = mesh(new T.CylinderGeometry(.02, .02, .18, 28, 1, true), glass, 0, .148, 0, g); barrel.castShadow = false;
    for (let i = 0; i < 7; i++) { const r = mesh(new T.TorusGeometry(.0205, .0013, 4, 28), M({ color: 0x15171d }), 0, .07 + i * .024, 0, g); r.rotation.x = Math.PI / 2; r.castShadow = false; }
    mesh(new T.CylinderGeometry(.034, .034, .004, 20), M({ color: 0xe9eef7, roughness: .5 }), 0, .238, 0, g);
    const lg = new T.CylinderGeometry(.0185, .0185, 1, 24); lg.translate(0, .5, 0);
    syrFill = new T.Mesh(lg, new T.MeshStandardMaterial({ color: 0xb3121f, emissive: 0x3a0308, roughness: .25 })); syrFill.position.y = .058; syrFill.scale.y = .001; syrFill.castShadow = false; g.add(syrFill);
    syrPlunger = new T.Group(); g.add(syrPlunger);
    mesh(new T.CylinderGeometry(.0195, .0195, .014, 20), M({ color: 0x15171d, roughness: .7 }), 0, .058, 0, syrPlunger);
    mesh(new T.CylinderGeometry(.006, .006, .18, 10), M({ color: 0xe9eef7, roughness: .5 }), 0, .15, 0, syrPlunger); mesh(new T.CylinderGeometry(.022, .022, .006, 20), M({ color: 0xe9eef7, roughness: .5 }), 0, .243, 0, syrPlunger);
    g.traverse(o => { if (o.isMesh && o.material !== glass) o.castShadow = true; });
    return g;
  }
  const FILL_LEN = .16;
  function setFill(f) { syrFill.scale.y = Math.max(.001, f * FILL_LEN); syrFill.visible = f > .01; syrPlunger.position.y = f * FILL_LEN; }

  /* ---------- panel ---------- */
  function drawPanel(t) {
    const g = pg, w = 1024, h = 560, running = seq && !seq.fin, done = res.glu != null && !running;
    const lv = done ? level(res.glu, res.spo2) : -1, col = lv < 0 ? '#7f8fb0' : ['#2ee6a6', '#ffd23f', '#ff4d5e'][lv];
    const word = running ? 'ANALYZING…' : done ? ['STABLE', 'ATTENTION', 'EMERGENCY'][lv] : 'READY';
    g.fillStyle = '#04091a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(76,201,240,.10)'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#4cc9f0'; g.font = 'bold 32px "Segoe UI",Arial'; g.fillText('MICROFLOW · BLOOD ANALYSIS', 28, 48);
    g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(700, 12, 296, 46, 23) : g.rect(700, 12, 296, 46); g.fill(); g.fillStyle = '#04091a'; g.font = 'bold 24px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(word, 848, 44); g.textAlign = 'left';
    // pipeline steps
    const steps = ['Tourniquet', 'Needle in vein', 'Collect blood', 'Remove needle', 'Transfer to lab', 'Analyze'], cur = seq ? (seq.fin ? 6 : seq.phase) : -1;
    steps.forEach((s, i) => { const y = 100 + i * 52, ok = i < cur, now = i === cur; g.fillStyle = ok ? '#2ee6a6' : now ? '#ffd23f' : '#2a3350'; g.beginPath(); g.arc(46, y, 15, 0, 7); g.fill(); g.fillStyle = '#04091a'; g.font = 'bold 17px Arial'; g.textAlign = 'center'; g.fillText(ok ? '✔' : String(i + 1), 46, y + 6); g.textAlign = 'left'; g.fillStyle = ok || now ? '#fff' : '#5b6781'; g.font = (now ? 'bold ' : '') + '26px "Segoe UI",Arial'; g.fillText(s, 76, y + 9); });
    // results
    const big = (label, val, unit, x, y, c, note) => { g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(label, x, y); g.fillStyle = c; g.font = 'bold 96px "Segoe UI",Arial'; g.fillText(val, x, y + 88); const wv = g.measureText(val).width; g.fillStyle = '#9aa7c7'; g.font = '26px "Segoe UI",Arial'; g.fillText(unit, x + wv + 10, y + 88); g.font = '20px "Segoe UI",Arial'; g.fillText(note, x, y + 122); };
    const gl = res.glu, sp = res.spo2, gcol = gl == null ? '#5b6781' : level(gl, 98) === 0 ? '#2ee6a6' : level(gl, 98) === 1 ? '#ffd23f' : '#ff4d5e', scol = sp == null ? '#5b6781' : sp >= 95 ? '#2ee6a6' : sp >= 90 ? '#ffd23f' : '#ff4d5e';
    big('GLUCOSE', gl == null ? '--' : String(gl), 'mg/dL', 380, 96, gcol, 'normal: 70 – 99 mg/dL'); big('BLOOD OXYGEN (SpO₂)', sp == null ? '--' : String(sp), '%', 380, 262, scol, 'normal: 95 % or more');
    // progress
    g.fillStyle = '#16203a'; g.fillRect(28, 440, 968, 22); const prog = !seq ? 0 : seq.fin ? 1 : (cur + (seq.p || 0)) / 6; g.fillStyle = running ? '#ffd23f' : '#2ee6a6'; g.fillRect(28, 440, 968 * prog, 22);
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(running ? 'Working… ' + steps[clamp(cur, 0, 5)] : done ? 'Analysis complete · results saved' : 'Tap the astronaut to collect a blood sample', 28, 500); g.textAlign = 'right'; g.fillText('● LIVE', 996, 500); g.textAlign = 'left';
    ptex.needsUpdate = true;
    // analyzer screen
    const c = azg; c.fillStyle = '#04101e'; c.fillRect(0, 0, 256, 160); c.fillStyle = '#4cc9f0'; c.font = 'bold 22px Arial'; c.fillText('MICROFLOW', 10, 26);
    const an = seq && cur >= 5 && !seq.fin; c.fillStyle = '#fff'; c.font = 'bold 26px Arial'; c.fillText(seq ? (seq.fin ? 'DONE' : cur >= 5 ? 'ANALYZING' : cur === 4 ? 'SAMPLE IN' : 'WAITING') : 'READY', 10, 70);
    c.fillStyle = '#16203a'; c.fillRect(10, 100, 236, 16); c.fillStyle = '#2ee6a6'; c.fillRect(10, 100, 236 * (seq ? (seq.fin ? 1 : cur >= 5 ? seq.p : 0) : 0), 16);
    if (seq && seq.fin && res.glu != null) { c.fillStyle = '#ffd23f'; c.font = 'bold 28px Arial'; c.fillText(res.glu + ' mg/dL', 10, 148); } aztex.needsUpdate = true;
  }

  /* ---------- the sequence ---------- */
  api.measure = function (glu, spo2) { if (seq && !seq.fin) return false; seq = { start: (performance.now() - t0) / 1000, glu, spo2, phase: 0, p: 0, fin: false }; res = { glu: null, spo2: null }; lastPhase = -1; onPhase('start'); return true; };
  api.show = function (glu, spo2) { if (seq && !seq.fin) return; res = { glu, spo2 }; seq = { start: 0, phase: 5, p: 1, fin: true, glu, spo2 }; };
  api.reset = function () { seq = null; res = { glu: null, spo2: null }; lastPhase = -1; };
  function stepSeq(t) {
    if (!seq || seq.fin) return; let e = t - seq.start, i = 0; while (i < DUR.length && e > DUR[i]) { e -= DUR[i]; i++; }
    if (i >= DUR.length) { seq.fin = true; seq.phase = 5; seq.p = 1; res = { glu: seq.glu, spo2: seq.spo2 }; onPhase('end'); onDone(seq.glu, seq.spo2); return; }
    seq.phase = i; seq.p = e / DUR[i]; if (i !== lastPhase) { lastPhase = i; onPhase(PH[i]); }
  }
  const qA = new T.Quaternion(), qB = new T.Quaternion(), vA = V(0, 0, 0), vB = V(0, 0, 0), vC = V(0, 0, 0);
  function armFrame() {  // world position of needle tip and barrel direction
    const el = A.elL; el.updateWorldMatrix(true, false); const tip = el.localToWorld(TIP.clone()), d = el.localToWorld(TIP.clone().add(DIR)).sub(tip).normalize(); return { tip, d };
  }
  function animate(t) {
    const ph = seq ? (seq.fin ? 6 : seq.phase) : -1, p = seq && !seq.fin ? seq.p : 0, af = armFrame(); camTip = af.tip;
    let tq = 1.7, ve = 1, fill = 0, flow = -1, spin = 0;
    const pose = (pos, dir) => { syr.position.copy(pos); syr.quaternion.setFromUnitVectors(Y, dir.clone().normalize()); };
    const hover = af.tip.clone().addScaledVector(af.d, .34), trayDir = V(1, .15, 0).normalize();
    if (ph < 0) { pose(trayPos, trayDir); }
    else if (ph === 0) { tq = lerp(1.7, 1, ease(p)); ve = lerp(1, 1.9, ease(p)); pose(trayPos, trayDir); }
    else if (ph === 1) { tq = 1; ve = 1.9; const k = ease(p); if (p < .6) { const u = ease(p / .6); vA.lerpVectors(trayPos, hover, u); qA.setFromUnitVectors(Y, trayDir); qB.setFromUnitVectors(Y, af.d); qA.slerp(qB, u); syr.position.copy(vA); syr.quaternion.copy(qA); } else { const u = ease((p - .6) / .4); vA.lerpVectors(hover, af.tip, u); pose(vA, af.d); } }
    else if (ph === 2) { tq = 1; ve = 1.9; fill = ease(p); pose(af.tip, af.d); }
    else if (ph === 3) { fill = 1; const u = ease(p); tq = lerp(1, 1.7, u); ve = lerp(1.9, 1, u); vA.lerpVectors(af.tip, hover, u); pose(vA, af.d); }
    else if (ph === 4) {
      fill = 1; if (p < .5) { const u = ease(p / .5); vA.lerpVectors(hover, portPos, u); qA.setFromUnitVectors(Y, af.d); qB.setFromUnitVectors(Y, V(-1, .05, 0).normalize()); qA.slerp(qB, u); syr.position.copy(vA); syr.quaternion.copy(qA); }
      else { const u = (p - .5) / .5; pose(portPos, V(-1, .05, 0)); fill = 1 - u; flow = u; }
    }
    else { fill = 0; pose(portPos, V(-1, .05, 0)); flow = 1.4; if (ph === 5) spin = ease(Math.min(1, p * 3)) * (1 - ease(Math.max(0, (p - .85) / .15))); }
    setFill(fill);
    band.scale.set(tq, 1, tq); band.visible = ph >= 0 && ph < 4 || ph === 3; band.visible = ph >= 0 && ph <= 3; vein.scale.set(ve, 1, ve); vein.material.emissiveIntensity = .2 + (ve - 1) * .6;
    beads.forEach((b, i) => { const s = flow < 0 ? -1 : flow * 1.1 - i * .06; b.visible = s > 0 && s < 1 && flow < 1.2; if (b.visible) b.position.copy(flowCurve.getPoint(s)); });
    rotor.rotation.y += spin * .5; ledBar.forEach((l, i) => { const on = ph === 5 && Math.floor(t * 8) % 6 === i; l.material.emissive.setHex(on ? 0x2ee6a6 : (ph === 6 ? 0x2ee6a6 : 0x103030)); l.material.emissiveIntensity = on || ph === 6 ? 1.4 : .3; });
    ring.visible = !seq; ring.scale.setScalar(1 + Math.sin(t * 4) * .1); ring.material.opacity = .5 + Math.sin(t * 4) * .35;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) return;
    const t = (now - t0) / 1000; stepSeq(t);
    // seated pose, small breathing
    A.body.position.y = .66 + Math.sin(t * 1.2) * .004;
    animate(t);
    if (now - lastPanel > 60) { lastPanel = now; drawPanel(t); }
    const fin = seq && seq.fin && res.glu != null; lamp.material.color.set(seq && !seq.fin ? 0xffd23f : fin ? [0x2ee6a6, 0xffd23f, 0xff4d5e][level(res.glu, res.spo2)] : 0x6f7c99);
    api._earth.rotation.y = t * .01;
    // cinematic camera: overview -> close-up of the arm -> transfer tube -> analyzer -> overview
    const ph = seq && !seq.fin ? seq.phase : -1; let wp = V(Math.sin(t * .2) * .2 + .6 + drag.yaw * .6, camBase.y + Math.sin(t * .27) * .04, camBase.z), wl = V(.95, 1.7, -1.9);
    if (ph >= 0 && ph <= 3 && camTip) { wp = camTip.clone().add(V(.1, .42, 1.1)); wl = camTip.clone().add(V(0, -.04, 0)); }
    else if (ph === 4) { wp = portPos.clone().add(V(.7, .45, 1.8)); wl = portPos.clone().add(V(.6, .05, -.6)); }
    else if (ph === 5) { wp = V(2.0, 1.75, -1.2); wl = V(2.05, 1.2, -3.1); }
    if (!curPos) { curPos = wp.clone(); curLook = wl.clone(); } curPos.lerp(wp, .06); curLook.lerp(wl, .06); cam.position.copy(curPos); cam.lookAt(curLook);
    R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 3.2, needW = clamp(a * 2.9, 3.2, 5.4);
    camBase.z = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)) + .2; cam.position.z = camBase.z; cam.updateProjectionMatrix();
  }

  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; getData = opts.getData || getData; level = opts.level || level; onPhase = opts.onPhase || onPhase; onDone = opts.onDone || onDone; onTap = opts.onTap || null;
    try {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
      stage.insertBefore(canvas, stage.firstChild);
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02040c); cam = new T.PerspectiveCamera(38, 1, .1, 400); cam.position.set(.2, camBase.y, camBase.z);
      const envS = new T.Scene(); envS.background = new T.Color(0x0a1226);
      [[6, 3, 0, 6, 0, 0xffffff, 6], [4, 4, -7, 2, 2, 0xcfe6ff, 4], [4, 2, 6, 1, -4, 0xffd9a0, 3], [8, 3, 0, -6, 0, 0x4cc9f0, 1.2], [5, 5, 0, 2, -8, 0x2b6fd6, 1.5]].forEach(([w, h, x, y, z, c, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); });
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(envS, .02).texture; pm.dispose();
      scene.add(new T.HemisphereLight(0xbfd8ff, 0x2a2f44, .6));
      const key = new T.DirectionalLight(0xfff2e0, 1.7); key.position.set(2.5, 7, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); const s = key.shadow.camera; s.left = -4; s.right = 4; s.top = 4; s.bottom = -4; s.near = 1; s.far = 22; key.shadow.bias = -.0004; key.target.position.set(1, 1, -1.5); scene.add(key, key.target);
      const rim = new T.DirectionalLight(0x9fd0ff, 1.0); rim.position.set(-6, 3, -8); scene.add(rim);
      const sl = new T.PointLight(0x4cc9f0, 1.0, 8); sl.position.set(2.4, 2.4, -2.2); scene.add(sl); const lab = new T.PointLight(0xdff3ff, 1.2, 5); lab.position.set(2.2, 2.0, -2.2); scene.add(lab);
      room(); const an = bench();
      // seated astronaut facing the lab (to the right), strapped into a floor-mounted chair
      const rig = new T.Group(); rig.position.set(-.15, 0, -1.55); rig.rotation.y = Math.PI / 2; scene.add(rig); seat(rig);
      A = B.makeAstronaut(rig, { bare: true }); A.body.position.set(0, .66, 0);
      A.hipL.rotation.set(-1.5, 0, -.06); A.hipR.rotation.set(-1.5, 0, .06); A.kneeL.rotation.x = 1.5; A.kneeR.rotation.x = 1.5; A.ankleL.rotation.x = 0; A.ankleR.rotation.x = 0;
      A.shL.rotation.set(-.8, 0, -.05); A.elL.rotation.set(-.85, 0, 0);               // arm extended on the arm rest, inner elbow facing up
      A.shR.rotation.set(-.35, 0, .12); A.elR.rotation.set(-1.25, 0, 0);               // other hand on the lap
      rig.updateMatrixWorld(true);
      // tourniquet, bare skin patch + vein on the extended arm
      const skin = M({ color: 0xd9a583, roughness: .7 }), blue = M({ color: 0x2b86e8, roughness: .5 });
      mesh(new T.CylinderGeometry(.092, .088, .26, 24), skin, 0, -.2, 0, A.elL);
      vein = new T.Mesh(new T.CylinderGeometry(.011, .009, .3, 10), new T.MeshStandardMaterial({ color: 0x4a5fb8, emissive: 0x1a2a78, emissiveIntensity: .2, roughness: .5 })); vein.position.set(0, -.17, .088); A.elL.add(vein);
      band = new T.Group(); band.position.set(0, -.3, 0); A.shL.add(band); mesh(new T.CylinderGeometry(.103, .103, .055, 28), blue, 0, 0, 0, band); mesh(new T.BoxGeometry(.03, .03, .1), blue, .05, -.02, .09, band).rotation.y = .4; mesh(new T.BoxGeometry(.03, .03, .09), blue, -.02, -.03, .1, band).rotation.y = -.5;
      // arm rest + side tray next to the arm, transfer port, tube to the analyzer
      const gw = V(0, 0, 0); A.elL.updateWorldMatrix(true, false); A.elL.localToWorld(gw.set(0, -.46, 0));
      const ew = V(0, 0, 0); A.elL.localToWorld(ew.set(0, 0, 0));
      const arm = new T.Group(); arm.position.set((ew.x + gw.x) / 2, Math.min(ew.y, gw.y) - .16, (ew.z + gw.z) / 2); scene.add(arm);
      mesh(new T.BoxGeometry(.78, .08, .24), M({ color: 0x2f5fa8, roughness: .8 }), 0, 0, 0, arm); mesh(new T.CylinderGeometry(.03, .03, arm.position.y - .03, 12), M({ color: 0x8d96a8, metalness: .9, roughness: .3 }), -.2, -arm.position.y / 2, 0, arm);
      mesh(new T.CylinderGeometry(.14, .16, .03, 28), M({ color: 0x8d96a8, metalness: .9, roughness: .3 }), -.2, -arm.position.y + .015, 0, arm);
      trayPos = V(arm.position.x + .0, arm.position.y + .1, arm.position.z + .3);
      mesh(new T.BoxGeometry(.5, .02, .16), M({ color: 0xd9dfeb, metalness: .4, roughness: .3 }), trayPos.x, trayPos.y - .03, trayPos.z, scene); mesh(new T.CylinderGeometry(.025, .025, .45, 12), M({ color: 0x8d96a8, metalness: .9 }), trayPos.x + .2, (trayPos.y - .03) / 2, trayPos.z, scene).scale.y = (trayPos.y - .03) / .45;
      portPos = V(gw.x + .5, gw.y + .12, gw.z + .1);
      const port = new T.Group(); port.position.copy(portPos).add(V(.03, 0, 0)); scene.add(port); mesh(new T.BoxGeometry(.08, .09, .09), M({ color: 0x1b2030, roughness: .4, metalness: .6 }), .03, 0, 0, port); mesh(new T.CylinderGeometry(.012, .012, .05, 10), M({ color: 0xc9d0dc, metalness: .95, roughness: .2 }), -.02, 0, 0, port).rotation.z = Math.PI / 2;
      mesh(new T.CylinderGeometry(.02, .02, portPos.y - .02, 12), M({ color: 0x8d96a8, metalness: .9 }), portPos.x + .06, (portPos.y - .02) / 2 - .05, portPos.z, scene).scale.y = 1;
      const inlet = api._inlet;
      flowCurve = new T.CatmullRomCurve3([portPos.clone().add(V(.08, .0, 0)), portPos.clone().add(V(.25, .25, -.1)), V(inlet.x - .4, inlet.y + .4, inlet.z + .7), V(inlet.x - .1, inlet.y + .25, inlet.z + .2), inlet.clone()]);
      scene.add(new T.Mesh(new T.TubeGeometry(flowCurve, 64, .011, 10), new T.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: .35, roughness: .05, depthWrite: false })));
      const bm = new T.MeshStandardMaterial({ color: 0xb3121f, emissive: 0x3a0308, roughness: .3 }); for (let i = 0; i < 16; i++) { const b = new T.Mesh(new T.SphereGeometry(.0105, 8, 6), bm); b.visible = false; scene.add(b); beads.push(b); }
      syr = makeSyringe(); scene.add(syr); setFill(0);
      // interaction: tap the astronaut
      hitG = []; const mk = (par, r, x, y, z) => { const h = new T.Mesh(new T.SphereGeometry(r, 10, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); h.position.set(x, y, z); par.add(h); hitG.push(h); };
      mk(A.body, .5, 0, .4, 0); mk(A.elL, .3, 0, -.1, 0); mk(A.body, .35, 0, .9, 0);
      ring = new T.Mesh(new T.TorusGeometry(.2, .008, 8, 40), new T.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: .9 })); ring.position.set(0, -.03, .1); ring.rotation.x = Math.PI / 2 + .3; A.elL.add(ring);
      const ray = new T.Raycaster(), mv = new T.Vector2(); let downX = 0, moved = 0;
      const over = e => { const r = canvas.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); return ray.intersectObjects(hitG, false).length > 0; };
      canvas.addEventListener('pointerdown', e => { drag.down = true; drag.x = downX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag.down) { canvas.style.cursor = over(e) ? 'pointer' : 'grab'; return; } moved = Math.max(moved, Math.abs(e.clientX - downX)); canvas.style.cursor = 'grabbing'; drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .008, -1.2, 1.2); drag.x = e.clientX; });
      canvas.addEventListener('pointerup', e => { const was = drag.down; drag.down = false; canvas.style.cursor = 'grab'; if (was && moved < 6 && over(e) && onTap) onTap(); });
      canvas.addEventListener('pointercancel', () => { drag.down = false; });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D blood test unavailable, using the 2D drawing instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false; }
  };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
})();
