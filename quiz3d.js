/* Questionnaire & Logbook in 3D (Three.js r149): an astronaut floating by the Earth window with a tablet, a sleeping bag + orbital clock,
   a mini greenhouse, a crew photo, and an analysis console that receives the data beam when you press "Send to SpaceDoc".
   Needs cabin3d.js + bike3d.js.
   API: Quiz3d.init(stage,{level,onObj,onTip}) · set({sleep,stress,iso,mood,diary}) · send(cb) · finish(xp) · busy() · reset() · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D, B = window.Bike3D;
  const api = { ready: false, failed: false };
  window.Quiz3d = api;
  if (!T || !C || !C.kit || !B || !B.makeAstronaut) { api.failed = true; return; }
  const K = C.kit, M = K.M, ctex = K.ctex, clamp = K.clamp, mesh = K.mesh;
  const V = (x, y, z) => new T.Vector3(x, y, z), lerp = (a, b, p) => a + (b - a) * p, ease = p => p * p * (3 - 2 * p);

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, level = () => 0, onObj = () => {}, t0 = performance.now(), last = 0, lastDraw = 0;
  let drag = { yaw: 0, down: false, x: 0 }, camBase = { y: 1.9, z: 7 };
  let moodCtx, moodTex, moodRingMat, coveMat, steam, flame, lampL;
  let A, body, tabletG, tabCtx, tabTex, tabEdge, pg, ptex, lamp, clockCtx, clockTex, bagMat, plantG, conCtx, conTex, port, coldL, warmL, tipEl;
  let beamPts = [], beamCurve = null, beamTube = null, flash = null, hits = [], hoverName = null, bump = {}, yaw = -.3, cold = .3, warm = .3;
  const vals = { sleep: 7, stress: 3, iso: 3, mood: 3, diary: '' };
  let seqS = null, finishedXP = null, shown = null;          // send sequence + results snapshot
  const DUR = [1.4, 2.0, .8];                                  // beam, analysis, reveal
  const EMO = ['😢', '😟', '😐', '🙂', '😄'], MOODN = ['Very bad', 'Bad', 'Okay', 'Good', 'Great'];
  const colS = v => v >= 7 ? '#2ee6a6' : v >= 4 ? '#ffd23f' : '#ff4d5e', colR = v => v <= 4 ? '#2ee6a6' : v <= 8 ? '#ffd23f' : '#ff4d5e';
  function wellbeing(v) { return Math.round(clamp(10 - (v.sleep < 7 ? (7 - v.sleep) * .55 : 0) - (v.stress - 1) * .4 - (v.iso - 1) * .3 + (v.mood - 3) * .45, 0, 10)); }

  /* ---------- therapy room: calming palette (sage teal, warm oak, lavender, soft amber light) ---------- */
  function woodFloorTex() { return ctex(512, 512, (c, w, h) => { const cols = ['#c9a273', '#bf9766', '#d3ae80', '#c49c6c']; for (let i = 0; i < 8; i++) { c.fillStyle = cols[i % 4]; c.fillRect(0, i * 64, w, 64); for (let k = 0; k < 40; k++) { c.strokeStyle = 'rgba(90,55,25,' + (Math.random() * .12) + ')'; c.beginPath(); const y = i * 64 + Math.random() * 64; c.moveTo(0, y); c.lineTo(w, y + (Math.random() - .5) * 6); c.stroke(); } c.fillStyle = 'rgba(60,35,15,.45)'; c.fillRect(0, i * 64, w, 2); c.fillRect(((i * 173) % 512), i * 64, 2, 64); } }, [3, 8]); }
  function slatTex() { return ctex(256, 512, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#b07c4c' : '#bf8a58'; c.fillRect(i * 32, 0, 28, h); c.fillStyle = 'rgba(70,40,20,.6)'; c.fillRect(i * 32 + 28, 0, 4, h); for (let k = 0; k < 30; k++) { c.strokeStyle = 'rgba(80,45,20,.15)'; c.beginPath(); c.moveTo(i * 32 + Math.random() * 28, 0); c.lineTo(i * 32 + Math.random() * 28, h); c.stroke(); } } }, [2, 1]); }
  function sageTex() { return ctex(512, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#47776f'); g.addColorStop(1, '#335f58'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,.10)'; c.lineWidth = 3; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) c.strokeRect(i * 256 + 14, j * 256 + 14, 228, 228); for (let k = 0; k < 600; k++) { c.fillStyle = 'rgba(255,255,255,' + Math.random() * .03 + ')'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }); }
  function rugTex() { return ctex(512, 512, (c, w, h) => { c.translate(256, 256); [['#efe6d6', 250], ['#b9a6e0', 205], ['#efe6d6', 160], ['#8fb9ae', 115], ['#efe6d6', 70], ['#9d8ac7', 34]].forEach(([col, r]) => { c.fillStyle = col; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); }); for (let k = 0; k < 800; k++) { c.fillStyle = 'rgba(0,0,0,.04)'; c.fillRect(Math.random() * 500 - 250, Math.random() * 500 - 250, 2, 2); } }); }
  function room() {
    const sg = sageTex(), wood = woodFloorTex();
    const wm = (w, h) => { const t = sg.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(w / 4, h / 4); return M({ map: t, roughness: .88, metalness: .02 }); };
    const plane = (w, h, x, y, z, rx, ry, mat) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), mat || wm(w, h)); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); m.receiveShadow = true; scene.add(m); return m; };
    const D = 26, CZ = 9.4, bz = -3.6;
    const fl = new T.Mesh(new T.PlaneGeometry(9, D), M({ map: wood, color: 0xb8b8b8, roughness: .6, metalness: .03 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, CZ); fl.receiveShadow = true; scene.add(fl);
    plane(9, D, 0, 5, CZ, Math.PI / 2, 0, M({ color: 0xefe6d8, roughness: .9 })); plane(D, 5, -4.5, 2.5, CZ, 0, Math.PI / 2); plane(D, 5, 4.5, 2.5, CZ, 0, -Math.PI / 2);
    plane(1.1, 5, -3.95, 2.5, bz); plane(5.3, 5, 1.85, 2.5, bz); plane(2.6, 1.7, -2.1, 4.15, bz); plane(2.6, .9, -2.1, .45, bz);
    const st = slatTex(); st.repeat.set(5, 1.6); const accent = new T.Mesh(new T.PlaneGeometry(4.5, 3.6), M({ map: st, roughness: .75 })); accent.position.set(2.5, 2.3, bz + .012); accent.receiveShadow = true; scene.add(accent);
    mesh(new T.BoxGeometry(9, .12, .1), M({ color: 0xe8dcc6, roughness: .7 }), 0, .06, bz + .03, scene);            // skirting
    // window: oak frame + sill with a succulent
    const fm = M({ color: 0x8a5f3c, roughness: .6 }), fb = (w, h, x, y) => mesh(new T.BoxGeometry(w, h, .22), fm, x, y, bz - .02, scene);
    fb(2.8, .14, -2.1, 3.3); fb(2.8, .14, -2.1, .9); fb(.14, 2.52, -3.4, 2.1); fb(.14, 2.52, -.8, 2.1); mesh(new T.BoxGeometry(2.95, .05, .32), fm, -2.1, .97, bz + .1, scene);
    mesh(new T.CylinderGeometry(.06, .045, .09, 16), M({ color: 0xe8dcc6, roughness: .7 }), -3.05, 1.045, bz + .12, scene); for (let i = 0; i < 6; i++) { const a = i * 1.05; mesh(new T.SphereGeometry(.035, 10, 8), M({ color: 0x7fbf7a, roughness: .7 }), -3.05 + Math.cos(a) * .035, 1.12, bz + .12 + Math.sin(a) * .035, scene).scale.y = 1.6; }
    // space outside
    const g = new T.BufferGeometry(), n = 1200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = Math.random() * 6.283, ph = Math.acos(Math.random() * 2 - 1); pos[i * 3] = 160 * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = 160 * Math.cos(ph); pos[i * 3 + 2] = 160 * Math.sin(ph) * Math.sin(th); }
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); scene.add(new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
    const eg = new T.Group(); eg.add(new T.Mesh(new T.SphereGeometry(12, 56, 40), new T.MeshStandardMaterial({ map: K.earthTexture(), roughness: .9, emissive: 0x0a2a60, emissiveIntensity: .35 })), new T.Mesh(new T.SphereGeometry(12.5, 40, 28), new T.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: .28, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false })));
    eg.position.set(-14, -9, -40); scene.add(eg); api._earth = eg;
    // warm cove lighting along the ceiling (changes colour with stress: breathing light)
    coveMat = new T.MeshBasicMaterial({ color: 0xffd9a0 }); [-4.25, 4.25].forEach(x => mesh(new T.BoxGeometry(.18, .06, 26), coveMat, x, 4.92, 9, scene)); mesh(new T.BoxGeometry(9, .06, .18), coveMat, 0, 4.92, -3.4, scene);
    // results panel (back wall, right)
    mesh(new T.BoxGeometry(3.9, 2.45, .14), M({ color: 0x2a2018, roughness: .5, metalness: .3 }), 2.45, 2.7, bz + .06, scene);
    const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 640; pg = pc.getContext('2d'); ptex = new T.CanvasTexture(pc); ptex.encoding = T.sRGBEncoding; ptex.anisotropy = 4;
    const sc = new T.Mesh(new T.PlaneGeometry(3.6, 2.25), new T.MeshBasicMaterial({ map: ptex, toneMapped: false })); sc.position.set(2.45, 2.7, bz + .14); scene.add(sc);
    lamp = new T.Mesh(new T.BoxGeometry(3.6, .08, .06), new T.MeshBasicMaterial({ color: 0x6f7c99 })); lamp.position.set(2.45, 3.95, bz + .13); scene.add(lamp);
    // crew photo with Velcro (warm glow when the astronaut feels connected)
    const photo = new T.Group(); photo.position.set(-.15, 3.42, bz + .02); scene.add(photo);
    mesh(new T.BoxGeometry(.56, .42, .02), M({ color: 0xf1f1ea, roughness: .6 }), 0, 0, 0, photo);
    const pt = ctex(256, 192, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffcf8a'); gr.addColorStop(1, '#e98a5a'); c.fillStyle = gr; c.fillRect(0, 0, w, h); [[70, 130, '#3b4f8a'], [128, 118, '#2e7d6b'], [188, 130, '#8a3b5f']].forEach(([x, y, col]) => { c.fillStyle = '#f2c9a5'; c.beginPath(); c.arc(x, y - 44, 22, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(x, y + 8, 34, 42, 0, 0, 7); c.fill(); c.fillStyle = '#2a1a10'; c.fillRect(x - 10, y - 50, 4, 4); c.fillRect(x + 6, y - 50, 4, 4); c.strokeStyle = '#2a1a10'; c.lineWidth = 3; c.beginPath(); c.arc(x, y - 40, 9, .2, 2.9); c.stroke(); }); c.fillStyle = 'rgba(255,255,255,.9)'; c.font = 'bold 16px Arial'; c.fillText('MY CREW ♥', 8, 184); });
    const pp = new T.Mesh(new T.PlaneGeometry(.5, .36), new T.MeshBasicMaterial({ map: pt, toneMapped: false })); pp.position.z = .012; photo.add(pp);
    [[-.25, .18], [.25, .18], [-.25, -.18], [.25, -.18]].forEach(([x, y]) => mesh(new T.BoxGeometry(.07, .035, .012), M({ color: 0x15171d, roughness: .9 }), x, y, .016, photo));
    warmL = new T.PointLight(0xffa24a, 0, 4.5); warmL.position.set(-.15, 3.1, bz + .9); scene.add(warmL);
    // mood mirror (round mirror with a mood-coloured LED ring) + emoji display: tap to change "How are you feeling?"
    const mir = new T.Group(); mir.position.set(-.15, 2.28, bz + .03); scene.add(mir);
    mesh(new T.TorusGeometry(.36, .03, 14, 48), M({ color: 0xc9a24a, metalness: .9, roughness: .3 }), 0, 0, .01, mir);
    moodRingMat = new T.MeshStandardMaterial({ color: 0x102018, emissive: 0x9ad7c8, emissiveIntensity: 1.4 }); mesh(new T.TorusGeometry(.325, .012, 10, 48), moodRingMat, 0, 0, .02, mir);
    const mt = ctex(256, 256, (c, w, h) => { const gr = c.createRadialGradient(100, 90, 10, 128, 128, 130); gr.addColorStop(0, '#f4f9ff'); gr.addColorStop(.5, '#b9cbe0'); gr.addColorStop(1, '#6f86a3'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(40, 220); c.lineTo(90, 30); c.lineTo(125, 30); c.lineTo(78, 220); c.fill(); });
    mesh(new T.CircleGeometry(.31, 48), new T.MeshStandardMaterial({ map: mt, metalness: .95, roughness: .06 }), 0, 0, .022, mir).castShadow = false;
    const md = document.createElement('canvas'); md.width = 512; md.height = 160; moodCtx = md.getContext('2d'); moodTex = new T.CanvasTexture(md); moodTex.encoding = T.sRGBEncoding;
    mesh(new T.BoxGeometry(.78, .24, .03), M({ color: 0x2a2018, roughness: .5, metalness: .4 }), 0, -.62, 0, mir); const mdp = new T.Mesh(new T.PlaneGeometry(.74, .2), new T.MeshBasicMaterial({ map: moodTex, toneMapped: false })); mdp.position.set(0, -.62, .017); mir.add(mdp);
    // sleeping bag strapped to the wall + orbital clock (fast day/night cycle)
    const bag = new T.Group(); bag.position.set(-3.95, 1.55, bz + .3); scene.add(bag);
    bagMat = M({ map: ctex(256, 512, (c, w, h) => { c.fillStyle = '#8c7bc2'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; for (let y = 20; y < h; y += 56) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } for (let x = 0; x < w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } c.fillStyle = '#efe6d6'; c.fillRect(w / 2 - 3, 30, 6, h - 60); }), roughness: .9 });
    const bm = new T.Mesh(new T.CapsuleGeometry(.3, 1.15, 10, 24), bagMat); bm.scale.z = .55; bm.castShadow = true; bag.add(bm);
    [-.45, .05, .55].forEach(y => { mesh(new T.BoxGeometry(.7, .06, .08), M({ color: 0xe8a15a, roughness: .6 }), 0, y, .17, bag); mesh(new T.BoxGeometry(.09, .08, .03), M({ color: 0xc9d0dc, metalness: .9, roughness: .3 }), .12, y, .21, bag); });
    const clk = new T.Group(); clk.position.set(-3.95, 3.15, bz + .06); scene.add(clk);
    mesh(new T.CylinderGeometry(.21, .21, .05, 40), M({ color: 0x8a5f3c, roughness: .55 }), 0, 0, 0, clk).rotation.x = Math.PI / 2;
    const cc = document.createElement('canvas'); cc.width = 256; cc.height = 256; clockCtx = cc.getContext('2d'); clockTex = new T.CanvasTexture(cc); clockTex.encoding = T.sRGBEncoding;
    const cf = new T.Mesh(new T.CircleGeometry(.185, 40), new T.MeshBasicMaterial({ map: clockTex, toneMapped: false })); cf.position.z = .03; clk.add(cf);
    coldL = new T.PointLight(0x6fa8ff, 0, 7); coldL.position.set(-2.1, 2.3, -2.6); scene.add(coldL);
    // oak desk (cream body, oak top)
    mesh(new T.BoxGeometry(3.9, .9, .6), M({ color: 0xe8dcc6, roughness: .6 }), 2.45, .45, bz + .45, scene); mesh(new T.BoxGeometry(4.0, .06, .7), M({ color: 0xb88a5a, roughness: .5 }), 2.45, .93, bz + .45, scene);
    // floor lamp with a warm shade + soft glow
    mesh(new T.CylinderGeometry(.16, .18, .03, 28), M({ color: 0x3a2f27, roughness: .5 }), -3.35, .015, -2.3, scene); mesh(new T.CylinderGeometry(.015, .015, 1.7, 10), M({ color: 0x3a2f27, roughness: .5 }), -3.35, .88, -2.3, scene);
    mesh(new T.CylinderGeometry(.2, .3, .36, 28, 1, true), new T.MeshBasicMaterial({ color: 0xffd2a0, side: T.DoubleSide }), -3.35, 1.8, -2.3, scene).castShadow = false; lampL = new T.PointLight(0xffc27a, 1.5, 8); lampL.position.set(-3.35, 1.8, -2.1); scene.add(lampL);
    // rug under the astronaut, pouf + folded blanket
    const rug = new T.Mesh(new T.CircleGeometry(1.25, 56), M({ map: rugTex(), roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(-1.35, .004, -.5); rug.receiveShadow = true; scene.add(rug);
    const pouf = mesh(new T.SphereGeometry(.32, 28, 20), M({ color: 0x9d8ac7, roughness: .95 }), .55, .22, -1.4, scene); pouf.scale.set(1.2, .72, 1.2);
    mesh(new T.BoxGeometry(.5, .06, .36), M({ map: ctex(128, 96, (c, w, h) => { c.fillStyle = '#e9c9a0'; c.fillRect(0, 0, w, h); c.fillStyle = '#d9a97a'; for (let i = 0; i < 6; i++) c.fillRect(0, i * 16 + 4, w, 6); }), roughness: 1 }), .55, .46, -1.4, scene).rotation.y = .4;
    // wall shelf (right wall): books, LED candle, stones, aroma diffuser with steam
    const sh = M({ color: 0xb88a5a, roughness: .55 }); mesh(new T.BoxGeometry(.24, .04, 1.6), sh, 4.36, 1.55, -1.3, scene); [-.3, .3].forEach(z => mesh(new T.BoxGeometry(.06, .16, .06), M({ color: 0x3a2f27 }), 4.4, 1.46, -1.3 + z * 2.2, scene));
    [0x8fb9ae, 0xd9a97a, 0x9d8ac7, 0xe8dcc6, 0x6a9a91].forEach((c, i) => mesh(new T.BoxGeometry(.16, .22 + (i % 2) * .05, .045), M({ color: c, roughness: .8 }), 4.36, 1.69 + (i % 2) * .025, -.55 - i * .05, scene));
    mesh(new T.CylinderGeometry(.04, .04, .1, 14), M({ color: 0xf1e7d3, roughness: .6 }), 4.36, 1.62, -.95, scene); flame = mesh(new T.SphereGeometry(.014, 8, 6), new T.MeshBasicMaterial({ color: 0xffc766 }), 4.36, 1.69, -.95, scene); flame.scale.y = 1.7;
    [.1, .075, .055].forEach((r, i) => { const s = mesh(new T.SphereGeometry(r, 14, 10), M({ color: [0x6b6b68, 0x8a8a86, 0xa5a5a0][i], roughness: .9 }), 4.36, 1.595 + i * .06, -1.25, scene); s.scale.y = .5; });
    mesh(new T.CylinderGeometry(.07, .06, .12, 20), M({ color: 0xe8dcc6, roughness: .5 }), 4.36, 1.63, -1.65, scene);
    const sp = new Float32Array(30 * 3); for (let i = 0; i < 30; i++) { sp[i * 3] = 4.36 + (Math.random() - .5) * .06; sp[i * 3 + 1] = 1.7 + Math.random() * .5; sp[i * 3 + 2] = -1.65 + (Math.random() - .5) * .06; }
    const sgeo = new T.BufferGeometry(); sgeo.setAttribute('position', new T.BufferAttribute(sp, 3)); steam = new T.Points(sgeo, new T.PointsMaterial({ color: 0xdff6ff, size: .05, transparent: true, opacity: .45, depthWrite: false })); scene.add(steam);
    // calming painting (sunrise over water) on the right wall
    const art = new T.Group(); art.position.set(4.46, 2.75, -1.6); art.rotation.y = -Math.PI / 2; scene.add(art);
    mesh(new T.BoxGeometry(1.2, .8, .05), M({ color: 0xb88a5a, roughness: .5 }), 0, 0, 0, art);
    const ap = new T.Mesh(new T.PlaneGeometry(1.1, .7), new T.MeshBasicMaterial({ map: ctex(256, 160, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9d8ac7'); gr.addColorStop(.5, '#f0b98a'); gr.addColorStop(.62, '#ffe2b0'); gr.addColorStop(.62, '#4f8179'); gr.addColorStop(1, '#2f5a56'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#fff0c8'; c.beginPath(); c.arc(128, 98, 22, Math.PI, 0); c.fill(); c.strokeStyle = 'rgba(255,240,200,.5)'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(108 - i * 6, 104 + i * 8); c.lineTo(148 + i * 6, 104 + i * 8); c.stroke(); } }), toneMapped: false })); ap.position.z = .03; art.add(ap);
  }  function greenhouse() {
    const gh = new T.Group(); gh.position.set(.85, .96, -3.1); scene.add(gh);
    const fm = M({ color: 0xd7dce8, metalness: .9, roughness: .3 });
    mesh(new T.BoxGeometry(.4, .03, .3), fm, 0, .015, 0, gh); mesh(new T.BoxGeometry(.38, .09, .28), M({ color: 0x4a2f1c, roughness: 1 }), 0, .075, 0, gh);
    [[-.19, -.14], [.19, -.14], [-.19, .14], [.19, .14]].forEach(([x, z]) => mesh(new T.BoxGeometry(.02, .38, .02), fm, x, .2, z, gh));
    mesh(new T.BoxGeometry(.4, .02, .3), fm, 0, .39, 0, gh);
    mesh(new T.BoxGeometry(.34, .014, .04), new T.MeshStandardMaterial({ color: 0x220033, emissive: 0xb066ff, emissiveIntensity: 1.6 }), 0, .375, .08, gh);
    const gl = new T.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: .16, roughness: .05, depthWrite: false });
    mesh(new T.BoxGeometry(.38, .34, .005), gl, 0, .2, .145, gh).castShadow = false; mesh(new T.BoxGeometry(.005, .34, .28), gl, -.195, .2, 0, gh).castShadow = false; mesh(new T.BoxGeometry(.005, .34, .28), gl, .195, .2, 0, gh).castShadow = false;
    plantG = new T.Group(); plantG.position.set(0, .12, 0); gh.add(plantG);
    mesh(new T.CylinderGeometry(.006, .01, .2, 8), M({ color: 0x3d8b3d, roughness: .8 }), 0, .1, 0, plantG);
    for (let i = 0; i < 7; i++) { const a = i * 2.4, y = .06 + i * .026, l = mesh(new T.SphereGeometry(.035, 12, 8), M({ color: i % 2 ? 0x4fbf5a : 0x2f9d4a, roughness: .7 }), Math.cos(a) * .045, y, Math.sin(a) * .045, plantG); l.scale.set(1.5, .25, .8); l.rotation.y = -a; l.rotation.z = .3; }
    mesh(new T.SphereGeometry(.016, 10, 8), new T.MeshStandardMaterial({ color: 0xff7ab8, emissive: 0xff3c8a, emissiveIntensity: .5 }), 0, .215, 0, plantG);
    const lbl = new T.Mesh(new T.PlaneGeometry(.2, .035), new T.MeshBasicMaterial({ map: ctex(256, 44, (c, w, h) => { c.fillStyle = '#04101e'; c.fillRect(0, 0, w, h); c.fillStyle = '#2ee6a6'; c.font = 'bold 24px Arial'; c.textAlign = 'center'; c.fillText('MINI GREENHOUSE', w / 2, 30); }), toneMapped: false })); lbl.position.set(0, .03, .15); gh.add(lbl);
    return gh;
  }
  function consoleUnit() {
    const g = new T.Group(); g.position.set(3.45, .96, -3.1); scene.add(g);
    mesh(new T.BoxGeometry(.9, .6, .5), M({ color: 0x20242f, roughness: .45, metalness: .6 }), 0, .3, 0, g);
    mesh(new T.BoxGeometry(.9, .04, .52), M({ color: 0x8d96a8, roughness: .3, metalness: .9 }), 0, .62, 0, g);
    const cc = document.createElement('canvas'); cc.width = 384; cc.height = 256; conCtx = cc.getContext('2d'); conTex = new T.CanvasTexture(cc); conTex.encoding = T.sRGBEncoding;
    const sc = new T.Mesh(new T.PlaneGeometry(.62, .4), new T.MeshBasicMaterial({ map: conTex, toneMapped: false })); sc.position.set(-.08, .3, .256); g.add(sc);
    for (let i = 0; i < 5; i++) mesh(new T.BoxGeometry(.04, .035, .012), new T.MeshStandardMaterial({ color: 0x111, emissive: [0x2ee6a6, 0x4cc9f0, 0xffd23f, 0x2ee6a6, 0xff4d5e][i], emissiveIntensity: 1 }), .33, .1 + i * .1, .26, g);
    for (let i = 0; i < 7; i++) mesh(new T.BoxGeometry(.7, .006, .012), new T.MeshStandardMaterial({ color: 0x111, emissive: 0x103040 }), -.05, .05 + i * .02, -.256, g);
    // data receiver (the beam lands here)
    const ring = mesh(new T.TorusGeometry(.1, .012, 10, 40), new T.MeshStandardMaterial({ color: 0x001018, emissive: 0x4cc9f0, emissiveIntensity: 1.4 }), 0, .68, 0, g); ring.rotation.x = Math.PI / 2;
    mesh(new T.CylinderGeometry(.02, .02, .07, 10), M({ color: 0xc9d0dc, metalness: .9, roughness: .3 }), 0, .66, 0, g);
    port = V(3.45, 1.7, -3.1).setY(.96 + .72); port.x = 3.45; port.z = -3.1;
    // keyboard
    mesh(new T.BoxGeometry(.5, .02, .18), M({ color: 0x15171d, roughness: .6 }), 2.3, .97, -2.9, scene);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) mesh(new T.BoxGeometry(.032, .008, .03), M({ color: 0x3a4156, roughness: .6 }), 2.3 - .23 + c * .042, .985, -2.96 + r * .045, scene);
    return g;
  }
  function footRestraint(bx, bz) {
    const steel = M({ color: 0x8d96a8, metalness: .95, roughness: .35 }), orange = M({ color: 0xff7a1a, roughness: .55 });
    mesh(new T.BoxGeometry(.72, .03, .5), steel, bx, .015, bz, scene);
    [-.14, .14].forEach(x => { const lp = mesh(new T.TorusGeometry(.1, .018, 8, 20, Math.PI), orange, bx + x, .03, bz + .08, scene); lp.rotation.y = Math.PI / 2; lp.scale.set(1, 1.2, 1); mesh(new T.CylinderGeometry(.02, .02, .03, 10), steel, bx + x, .04, bz - .1, scene); });
    for (let i = 0; i < 4; i++) mesh(new T.CylinderGeometry(.015, .015, .012, 6), M({ color: 0x20242f }), bx + (i % 2 ? .3 : -.3), .034, bz + (i < 2 ? .2 : -.2), scene);
  }

  /* ---------- canvases ---------- */
  function drawTablet() {
    const c = tabCtx, w = 512, h = 352; c.fillStyle = '#06101f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#4cc9f0'; c.font = 'bold 28px "Segoe UI",Arial'; c.fillText('LOGBOOK · Questionnaire', 18, 38);
    const row = (label, val, max, col, y, txt) => { c.fillStyle = '#9aa7c7'; c.font = '22px "Segoe UI",Arial'; c.fillText(label, 18, y); c.fillStyle = '#16203a'; c.fillRect(18, y + 10, 476, 20); c.fillStyle = col; c.fillRect(18, y + 10, 476 * clamp(val / max, 0, 1), 20); c.fillStyle = '#fff'; c.font = 'bold 22px "Segoe UI",Arial'; c.textAlign = 'right'; c.fillText(txt, 494, y); c.textAlign = 'left'; };
    row('😴 Sleep', vals.sleep, 12, colS(vals.sleep), 78, vals.sleep + ' h'); row('😰 Stress', vals.stress, 10, colR(vals.stress), 142, vals.stress + '/10'); row('😶 Isolation', vals.iso, 10, colR(vals.iso), 206, vals.iso + '/10');
    c.fillStyle = '#9aa7c7'; c.font = '22px "Segoe UI",Arial'; c.fillText('How do you feel?', 18, 270);
    EMO.forEach((e, i) => { const x = 160 + i * 66, on = i + 1 === vals.mood; c.fillStyle = on ? 'rgba(255,210,63,.25)' : 'rgba(255,255,255,.05)'; c.beginPath(); c.arc(x, 262, 28, 0, 7); c.fill(); if (on) { c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.stroke(); } c.font = on ? '38px Arial' : '28px Arial'; c.textAlign = 'center'; c.fillText(e, x, on ? 275 : 272); c.textAlign = 'left'; });
    c.fillStyle = '#9aa7c7'; c.font = '17px "Segoe UI",Arial'; const d = (vals.diary || '').replace(/\s+/g, ' ').slice(0, 52); c.fillText(d ? '“' + d + (vals.diary.length > 52 ? '…' : '') + '”' : 'Logbook: (empty)', 18, 328);
    tabTex.needsUpdate = true;
  }
  function drawClock(t) {
    const c = clockCtx, a = (t / 9) * Math.PI * 2;                     // one fast orbit every 9 s (a real orbit is ~90 min: 16 sunrises a day)
    const day = (Math.sin(a) + 1) / 2; c.setTransform(1, 0, 0, 1, 0, 0);
    const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, `rgb(${Math.round(18 + 230 * day)},${Math.round(22 + 170 * day)},${Math.round(60 + 90 * day)})`); gr.addColorStop(1, `rgb(${Math.round(10 + 120 * day)},${Math.round(12 + 90 * day)},${Math.round(40 + 70 * day)})`); c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
    c.translate(128, 128); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 98, 0, 7); c.stroke();
    c.fillStyle = '#ffd86b'; c.beginPath(); c.arc(Math.cos(a) * 98, -Math.sin(a) * 98, 15, 0, 7); c.fill(); c.fillStyle = '#e8eefc'; c.beginPath(); c.arc(-Math.cos(a) * 98, Math.sin(a) * 98, 11, 0, 7); c.fill(); c.fillStyle = gr; c.beginPath(); c.arc(-Math.cos(a) * 98 + 5, Math.sin(a) * 98 - 3, 9, 0, 7); c.fill();
    c.strokeStyle = colS(vals.sleep); c.lineWidth = 12; c.beginPath(); c.arc(0, 0, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(vals.sleep / 12, 0, 1)); c.stroke();
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#fff'; c.font = 'bold 46px Arial'; c.textAlign = 'center'; c.fillText(vals.sleep + ' h', 128, 140); c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '20px Arial'; c.fillText('SLEEP', 128, 100); c.fillText('ORBIT CLOCK', 128, 172); c.font = '15px Arial'; c.fillText('16 sunrises a day', 128, 192); c.textAlign = 'left'; clockTex.needsUpdate = true;
  }
  const MOOD_COL = [0xffa95c, 0xffc27a, 0x9ad7c8, 0x8fe39a, 0x7af0b0];
  function drawMood() {
    const c = moodCtx; c.fillStyle = '#1c1612'; c.fillRect(0, 0, 512, 160); c.fillStyle = '#e8dcc6'; c.font = '22px Arial'; c.fillText('How are you feeling?', 14, 30);
    EMO.forEach((e, i) => { const x = 62 + i * 96, on = i + 1 === vals.mood; c.fillStyle = on ? 'rgba(255,217,160,.3)' : 'rgba(255,255,255,.05)'; c.beginPath(); c.arc(x, 98, 40, 0, 7); c.fill(); if (on) { c.strokeStyle = '#ffd9a0'; c.lineWidth = 4; c.stroke(); } c.font = on ? '58px Arial' : '42px Arial'; c.textAlign = 'center'; c.fillText(e, x, on ? 118 : 112); c.textAlign = 'left'; });
    moodTex.needsUpdate = true;
  }
  function therapyFx(t, dt, stressK) {
    // breathing light: warm amber when calm, a slow lavender pulse (4 s in, 6 s out) when stress is high
    const ph = (t % 10) / 10, br = ph < .4 ? ph / .4 : 1 - (ph - .4) / .6, k = stressK > .05 ? stressK : 0, lav = [.72, .64, 1], warmC = [1, .85, .63], mix = i => warmC[i] + (lav[i] - warmC[i]) * k, lvl = .55 + .45 * (k ? br : .6);
    coveMat.color.setRGB(mix(0) * lvl, mix(1) * lvl, mix(2) * lvl);
    moodRingMat.emissive.setHex(MOOD_COL[vals.mood - 1]); moodRingMat.emissiveIntensity = 1.1 + .4 * Math.sin(t * 2);
    flame.scale.set(1 + Math.sin(t * 17) * .15, 1.7 + Math.sin(t * 23) * .3, 1); flame.position.y = 1.69 + Math.sin(t * 19) * .002;
    const p = steam.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * (.12 + (i % 5) * .02); if (y > 2.4) y = 1.7; p.setY(i, y); p.setX(i, 4.36 + Math.sin(t * 1.5 + i) * .05 * (y - 1.7) * 2); } p.needsUpdate = true;
    lampL.intensity = 1.35 + Math.sin(t * .7) * .1;
  }  function drawConsole(prog, st) {
    const c = conCtx; c.fillStyle = '#04101e'; c.fillRect(0, 0, 384, 256); c.fillStyle = '#4cc9f0'; c.font = 'bold 24px Arial'; c.fillText('SPACEDOC · ANALYSIS', 12, 30);
    [['Sleep', clamp(vals.sleep / 12, 0, 1), colS(vals.sleep)], ['Stress', vals.stress / 10, colR(vals.stress)], ['Isolation', vals.iso / 10, colR(vals.iso)], ['Mood', vals.mood / 5, vals.mood >= 4 ? '#2ee6a6' : vals.mood === 3 ? '#ffd23f' : '#ff4d5e']].forEach(([l, v, col], i) => { const y = 70 + i * 40; c.fillStyle = '#9aa7c7'; c.font = '20px Arial'; c.fillText(l, 12, y); c.fillStyle = '#16203a'; c.fillRect(110, y - 16, 260, 16); c.fillStyle = col; c.fillRect(110, y - 16, 260 * v * prog, 16); });
    c.fillStyle = st === 'idle' ? '#5b6781' : '#ffd23f'; c.font = 'bold 22px Arial'; c.fillText(st === 'idle' ? 'WAITING FOR DATA…' : st === 'busy' ? 'PROCESSING…' : 'RESULTS SENT TO PANEL', 12, 240); conTex.needsUpdate = true;
  }
  function advice(lv) { return ['Your mind is calm. Keep sleeping well and chatting with the crew.', 'A bit worn out: breathe for 5 minutes, call a friend and sleep early.', 'This is serious. Talk to the crew now: you are not alone.'][lv]; }
  function drawPanel(t) {
    const g = pg, w = 1024, h = 640, v = shown || vals, st = seqS ? (seqS.fin ? 'done' : seqS.phase === 0 ? 'recv' : 'proc') : (shown ? 'done' : 'draft');
    const lv = level(v), col = ['#2ee6a6', '#ffd23f', '#ff4d5e'][lv], word = { draft: 'LIVE PREVIEW', recv: 'RECEIVING DATA…', proc: 'ANALYZING…', done: ['STABLE', 'ATTENTION', 'EMERGENCY'][lv] }[st];
    g.fillStyle = '#04091a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(76,201,240,.10)'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#4cc9f0'; g.font = 'bold 32px "Segoe UI",Arial'; g.fillText('MENTAL HEALTH · ANALYSIS CONSOLE', 28, 48);
    g.fillStyle = st === 'done' ? col : st === 'draft' ? '#7f8fb0' : '#ffd23f'; g.beginPath(); g.roundRect ? g.roundRect(690, 12, 306, 46, 23) : g.rect(690, 12, 306, 46); g.fill(); g.fillStyle = '#04091a'; g.font = 'bold 24px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(word, 843, 44); g.textAlign = 'left';
    const prog = st === 'proc' ? seqS.p : 1;
    const bar = (label, val, max, c, y, txt, verdict) => { g.fillStyle = '#9aa7c7'; g.font = '24px "Segoe UI",Arial'; g.fillText(label, 28, y); g.fillStyle = '#16203a'; g.fillRect(240, y - 24, 420, 28); g.fillStyle = c; g.fillRect(240, y - 24, 420 * clamp(val / max, 0, 1) * prog, 28); g.fillStyle = '#fff'; g.font = 'bold 26px "Segoe UI",Arial'; g.fillText(txt, 676, y); if (st === 'done') { g.fillStyle = c; g.font = '22px "Segoe UI",Arial'; g.fillText(verdict, 790, y); } };
    bar('😴 Sleep', v.sleep, 12, colS(v.sleep), 110, v.sleep + ' h', v.sleep >= 7 ? 'Good' : v.sleep >= 4 ? 'Short' : 'Very short'); bar('😰 Stress', v.stress, 10, colR(v.stress), 170, v.stress + '/10', v.stress <= 4 ? 'Low' : v.stress <= 8 ? 'Raised' : 'High'); bar('😶 Isolation', v.iso, 10, colR(v.iso), 230, v.iso + '/10', v.iso <= 4 ? 'Connected' : v.iso <= 8 ? 'Lonely' : 'Very lonely');
    g.fillStyle = '#9aa7c7'; g.font = '24px "Segoe UI",Arial'; g.fillText('Mood', 28, 290); g.font = '54px Arial'; g.fillText(EMO[v.mood - 1], 240, 300); g.fillStyle = '#fff'; g.font = 'bold 26px "Segoe UI",Arial'; g.fillText(MOODN[v.mood - 1], 316, 290);
    g.fillStyle = '#16203a'; g.fillRect(28, 336, 968, 2);
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText('WELLBEING SCORE', 28, 380); g.fillStyle = st === 'done' ? col : '#5b6781'; g.font = 'bold 92px "Segoe UI",Arial'; g.fillText(st === 'done' ? String(wellbeing(v)) : '--', 28, 462); g.fillStyle = '#9aa7c7'; g.font = '26px "Segoe UI",Arial'; g.fillText('/ 10', 28 + (st === 'done' ? (wellbeing(v) >= 10 ? 150 : 80) : 90), 462);
    if (st === 'done') {
      g.fillStyle = col; g.font = 'bold 26px "Segoe UI",Arial'; g.fillText('SpaceDoc says:', 320, 388); g.fillStyle = '#d6def5'; g.font = '24px "Segoe UI",Arial';
      const words = advice(lv).split(' '); let line = '', y = 424; words.forEach(wd => { if (g.measureText(line + wd).width > 660) { g.fillText(line, 320, y); line = ''; y += 32; } line += wd + ' '; }); g.fillText(line, 320, y);
      if (finishedXP != null) { g.fillStyle = finishedXP > 0 ? '#ffd23f' : '#5b6781'; g.beginPath(); g.roundRect ? g.roundRect(28, 500, 250, 56, 28) : g.rect(28, 500, 250, 56); g.fill(); g.fillStyle = '#1b1500'; g.font = 'bold 30px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(finishedXP > 0 ? '+' + finishedXP + ' XP unlocked!' : 'XP already earned', 153, 538); g.textAlign = 'left'; }
    } else { g.fillStyle = '#9aa7c7'; g.font = '24px "Segoe UI",Arial'; g.fillText(st === 'draft' ? 'Fill the form on the tablet, then press “Send to SpaceDoc”.' : 'Data beam received from the astronaut’s tablet…', 320, 424); }
    g.fillStyle = '#9aa7c7'; g.font = '20px "Segoe UI",Arial'; g.fillText(st === 'draft' ? 'Tap: sleeping bag (sleep) · Earth window (isolation) · plant (stress) · tablet (mood)' : '', 28, 610); g.textAlign = 'right'; g.fillText('● LIVE', 996, 610); g.textAlign = 'left';
    ptex.needsUpdate = true;
  }

  /* ---------- sequence ---------- */
  api.set = function (v) { Object.assign(vals, v); if (!seqS || seqS.fin) { if (shown) { shown = null; finishedXP = null; seqS = null; } } };
  api.busy = function () { return !!(seqS && !seqS.fin); };
  api.reset = function () { seqS = null; shown = null; finishedXP = null; };
  api.finish = function (xp) { finishedXP = xp; };
  api.send = function (cb) {
    if (api.busy()) return false; shown = null; finishedXP = null; seqS = { start: (performance.now() - t0) / 1000, phase: 0, p: 0, fin: false, cb, snap: Object.assign({}, vals) };
    const tp = tabletG.position.clone(); beamCurve = new T.CatmullRomCurve3([tp, tp.clone().add(V(.5, .7, -.5)), V(port.x - 1.2, 2.2, -2.4), port.clone().add(V(0, .12, 0))]);
    if (beamTube) scene.remove(beamTube); beamTube = new T.Mesh(new T.TubeGeometry(beamCurve, 48, .006, 6), new T.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); scene.add(beamTube);
    if (api.onPhase) api.onPhase('beam'); return true;
  };
  function stepSeq(t) {
    if (!seqS || seqS.fin) return; let e = t - seqS.start, i = 0; while (i < DUR.length && e > DUR[i]) { e -= DUR[i]; i++; }
    if (i >= DUR.length) { seqS.fin = true; shown = seqS.snap; if (beamTube) beamTube.material.opacity = 0; if (api.onPhase) api.onPhase('done'); const cb = seqS.cb; seqS.cb = null; if (cb) cb(); return; }
    if (i !== seqS.phase) { seqS.phase = i; if (api.onPhase) api.onPhase(i === 1 ? 'analyze' : 'reveal'); } seqS.p = e / DUR[i];
  }

  /* ---------- frame ---------- */
  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - (last || now)) / 1000); last = now; stepSeq(t);
    const stressK = clamp((vals.stress - 4) / 5, 0, 1), sleepy = vals.sleep < 6, good = vals.mood >= 4, bad = vals.mood <= 2;
    const cT = clamp((vals.iso - 3) / 6, 0, 1), wT = clamp((6 - vals.iso) / 5, 0, 1); cold += (cT - cold) * Math.min(1, dt * 1.5); warm += (wT - warm) * Math.min(1, dt * 1.5);
    coldL.intensity = 2.4 * cold; warmL.intensity = 2.4 * warm; const tgtYaw = lerp(-.25, -1.35, cold); yaw += (tgtYaw - yaw) * Math.min(1, dt * 1.2);
    // astronaut: feet in a floor restraint, floating sway above them
    body.position.set(-1.35, 1.13 + Math.sin(t * .8) * .018, -.5); body.rotation.set((sleepy ? .1 : 0) + (bad ? .07 : 0) + Math.sin(t * .6) * .02, yaw, Math.sin(t * .5) * .03);
    A.shR.position.y = .55 + .045 * stressK; A.shL.position.y = .55 + .045 * stressK;
    A.shR.rotation.set(-.95 - stressK * .1, 0, .5 - stressK * .12); A.elR.rotation.set(-1.15, 0, 0);
    A.shL.rotation.set(-.1, 0, -.22 + stressK * .12); A.elL.rotation.set(-.3, 0, 0); A.elL.rotation.z = 0;
    A.hipL.rotation.set(0, 0, -.04); A.hipR.rotation.set(0, 0, .04); A.kneeL.rotation.x = 0; A.kneeR.rotation.x = 0; A.ankleL.rotation.x = 0; A.ankleR.rotation.x = 0;
    const slot = Math.floor(t / 5) % 2, wave = good && (!sleepy || slot === 0), yawn = sleepy && (!good || slot === 1), ph = (t % 5) / 5;
    if (wave && ph < .6) { A.shL.rotation.set(-.2, 0, -2.5); A.elL.rotation.set(-.2, 0, Math.sin(t * 9) * .55); }
    else if (yawn && ph < .5) { const u = Math.sin(ph / .5 * Math.PI); A.shL.rotation.set(-2.4 * u - .1, 0, -.15); A.elL.rotation.set(-1.9 * u - .3, 0, 0); body.rotation.x += .06 * u; }
    // tablet in the right hand, facing the camera; the border blinks amber when stress is high
    body.updateMatrixWorld(true); const hand = A.elR.localToWorld(V(0, -.5, 0)); tabletG.position.copy(hand).add(V(0, .13, .1)); tabletG.lookAt(cam.position); tabletG.rotation.z += .08;
    const blink = stressK > .1 ? (.35 + .65 * (Math.sin(t * 4) * .5 + .5)) * stressK : 0; tabEdge.material.emissiveIntensity = blink * 2.2 + .05; tabEdge.material.emissive.setHex(0xffa000);
    // props: greenhouse plant sway, clicked objects pulse
    plantG.rotation.z = Math.sin(t * 1.2) * .04 + (bump.plant || 0) * Math.sin(t * 20) * .12; plantG.scale.setScalar(1 + (bump.plant || 0) * .15); bagMat.emissive = bagMat.emissive || new T.Color(0); bagMat.emissive.setRGB(0, .5 * (bump.sleep || 0), .5 * (bump.sleep || 0));
    Object.keys(bump).forEach(k => { bump[k] = Math.max(0, bump[k] - dt * 1.6); });
    therapyFx(t, dt, stressK);
    if (now - lastDraw > 80) { lastDraw = now; drawTablet(); drawClock(t); drawMood(); const st = seqS && !seqS.fin ? (seqS.phase === 1 ? 'busy' : 'busy') : (shown ? 'done' : 'idle'); drawConsole(seqS && !seqS.fin ? (seqS.phase === 0 ? 0 : seqS.phase === 1 ? seqS.p : 1) : (shown ? 1 : .0), st); drawPanel(t); }
    // data beam
    if (seqS && !seqS.fin && beamCurve) {
      const u = seqS.phase === 0 ? ease(seqS.p) : 1; beamTube.material.opacity = seqS.phase === 0 ? .55 : .25 * (1 - (seqS.phase === 2 ? seqS.p : 0));
      if (!flash) { flash = []; for (let i = 0; i < 24; i++) { const s = new T.Mesh(new T.SphereGeometry(.018, 8, 6), new T.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false })); s.visible = false; scene.add(s); flash.push(s); } }
      flash.forEach((s, i) => { const k = (seqS.phase === 0 ? u * 1.25 : 1.25 + Math.sin(t * 6)) - i * .045; s.visible = seqS.phase === 0 && k > 0 && k < 1; if (s.visible) s.position.copy(beamCurve.getPoint(k)); });
    } else if (flash) flash.forEach(s => s.visible = false);
    const lv = seqS && seqS.fin ? level(shown || vals) : -1; lamp.material.color.set(seqS && !seqS.fin ? 0xffd23f : shown ? [0x2ee6a6, 0xffd23f, 0xff4d5e][level(shown)] : 0x6f7c99);
    api._earth.rotation.y = t * .01;
    cam.position.x = Math.sin(t * .2) * .25 - .6 + drag.yaw * .6; cam.position.y = camBase.y + Math.sin(t * .27) * .04; cam.lookAt(.2, 1.65, -1.2);
    R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 3.9, needW = clamp(a * 4.3, 3.8, 6.8);
    camBase.z = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)) + .4; cam.position.z = camBase.z; cam.updateProjectionMatrix();
  }

  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; level = opts.level || level; onObj = opts.onObj || onObj; api.onPhase = opts.onPhase || null;
    try {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
      stage.insertBefore(canvas, stage.firstChild);
      tipEl = document.createElement('div'); tipEl.style.cssText = 'position:absolute;z-index:3;pointer-events:none;display:none;padding:5px 10px;border-radius:10px;background:rgba(14,20,42,.92);border:1px solid rgba(76,201,240,.5);font-size:.78rem;color:#e9eefc;white-space:nowrap'; stage.appendChild(tipEl);
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = .95; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02040c); cam = new T.PerspectiveCamera(38, 1, .1, 400); cam.position.set(-.6, camBase.y, camBase.z);
      const envS = new T.Scene(); envS.background = new T.Color(0x0a1226);
      [[6, 3, 0, 6, 0, 0xffffff, 6], [4, 4, -7, 2, 2, 0xcfe6ff, 4], [4, 2, 6, 1, -4, 0xffd9a0, 3], [8, 3, 0, -6, 0, 0x4cc9f0, 1.2], [5, 5, 0, 2, -8, 0x2b6fd6, 1.5]].forEach(([w, h, x, y, z, c, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); });
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(envS, .02).texture; pm.dispose();
      scene.add(new T.HemisphereLight(0xfff0dd, 0x6a5040, .5));
      const key = new T.DirectionalLight(0xffe2bd, 1.25); key.position.set(2.5, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const s = key.shadow.camera; s.left = -4; s.right = 4; s.top = 4; s.bottom = -3; s.near = 1; s.far = 22; key.shadow.bias = -.0004; key.target.position.set(-.5, 1, -1); scene.add(key, key.target);
      const rim = new T.DirectionalLight(0xb9a6ff, .55); rim.position.set(-6, 3, -8); scene.add(rim); const sl = new T.PointLight(0xffb76b, .9, 8); sl.position.set(2.4, 2.4, -2.2); scene.add(sl);
      room(); const gh = greenhouse(), cu = consoleUnit(); footRestraint(-1.35, -.5);
      A = B.makeAstronaut(scene); body = A.body;
      // tablet
      tabletG = new T.Group(); scene.add(tabletG);
      mesh(new T.BoxGeometry(.36, .26, .016), M({ color: 0x1c2130, roughness: .35, metalness: .8 }), 0, 0, 0, tabletG);
      const tc = document.createElement('canvas'); tc.width = 512; tc.height = 352; tabCtx = tc.getContext('2d'); tabTex = new T.CanvasTexture(tc); tabTex.encoding = T.sRGBEncoding; tabTex.anisotropy = 4;
      const scr = new T.Mesh(new T.PlaneGeometry(.33, .227), new T.MeshBasicMaterial({ map: tabTex, toneMapped: false })); scr.position.z = .0095; tabletG.add(scr);
      tabEdge = mesh(new T.BoxGeometry(.37, .27, .012), new T.MeshStandardMaterial({ color: 0x111, emissive: 0xffa000, emissiveIntensity: .05 }), 0, 0, -.004, tabletG); tabEdge.castShadow = false; tabEdge.scale.set(1.0, 1.0, 1);
      // click targets
      const mk = (name, label, geo, pos, par) => { const h = new T.Mesh(geo, new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); h.position.copy(pos); (par || scene).add(h); h.userData = { name, label }; hits.push(h); return h; };
      mk('earth', 'Earth window · tap to change loneliness', new T.PlaneGeometry(2.6, 2.4), V(-2.1, 2.1, -3.7)); mk('sleep', 'Sleeping bag · tap to add 1 h of sleep', new T.BoxGeometry(.9, 1.9, .9), V(-3.95, 1.55, -3.2));
      mk('sleep', 'Orbit clock · tap to add 1 h of sleep', new T.BoxGeometry(.5, .5, .3), V(-3.95, 3.15, -3.5)); mk('plant', 'Mini greenhouse · tap to relax (-1 stress)', new T.BoxGeometry(.5, .55, .4), V(.85, 1.25, -3.1)); mk('mood', 'Mood mirror · tap to change how you feel', new T.BoxGeometry(.9, 1.2, .3), V(-.15, 1.95, -3.5)); mk('tablet', 'Tablet · tap to change the mood', new T.BoxGeometry(.5, .4, .3), V(0, 0, 0), tabletG);
      const ray = new T.Raycaster(), mv = new T.Vector2(); let downX = 0, moved = 0;
      const pick = e => { const r = canvas.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); const hs = ray.intersectObjects(hits, false); return hs.length ? hs[0].object.userData : null; };
      canvas.addEventListener('pointerdown', e => { drag.down = true; drag.x = downX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); tipEl.style.display = 'none'; });
      canvas.addEventListener('pointermove', e => { if (!drag.down) { const o = pick(e); canvas.style.cursor = o ? 'pointer' : 'grab'; if (o) { const r = canvas.getBoundingClientRect(); tipEl.textContent = o.label; tipEl.style.display = 'block'; tipEl.style.left = Math.min(r.width - 220, Math.max(4, e.clientX - r.left + 12)) + 'px'; tipEl.style.top = Math.max(4, e.clientY - r.top - 34) + 'px'; } else tipEl.style.display = 'none'; return; } moved = Math.max(moved, Math.abs(e.clientX - downX)); canvas.style.cursor = 'grabbing'; drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .008, -1.3, 1.3); drag.x = e.clientX; });
      canvas.addEventListener('pointerleave', () => { tipEl.style.display = 'none'; });
      canvas.addEventListener('pointerup', e => { const was = drag.down; drag.down = false; canvas.style.cursor = 'grab'; if (was && moved < 6 && !api.busy()) { const o = pick(e); if (o) { bump[o.name] = 1; onObj(o.name); } } });
      canvas.addEventListener('pointercancel', () => { drag.down = false; });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D questionnaire unavailable, using the 2D panel instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); if (tipEl && tipEl.parentNode) tipEl.parentNode.removeChild(tipEl); return false; }
  };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
})();
