/* Blood-pressure exam in 3D (Three.js r149): a floating astronaut with a 3D pressure cuff on the arm.
   Tap the cuff -> it inflates, deflates and the values appear on the cabin panel.
   Needs cabin3d.js + bike3d.js.   API: Bp3D.init(stage,{getData,level,onPhase,onDone}) · measure() · show(s,d) · reset() · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D, B = window.Bike3D;
  const api = { ready: false, failed: false };
  window.Bp3D = api;
  if (!T || !C || !C.kit || !B || !B.makeAstronaut) { api.failed = true; return; }
  const K = C.kit, M = K.M, ctex = K.ctex, clamp = K.clamp, mesh = K.mesh;

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, getData = () => ({}), level = () => 0, onPhase = () => {}, onDone = () => {};
  let t0 = performance.now(), last = 0, lastPanel = 0;
  let A, body, cuffG, cuffMat, hit, ring, pg, ptex, sg, stex, lamp, drag = { yaw: 0, down: false, x: 0 };
  const camBase = { y: 1.8, z: 7 };
  const st = { sys: null, dia: null, pulse: null, manual: false };          // values shown on the panel
  let meas = null, press = 0;                                                  // measurement in progress, cuff pressure (mmHg)
  const trace = [];

  /* ---------- room (same family as the cabin) ---------- */
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
    const g = new T.BufferGeometry(), n = 1200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = Math.random() * 6.283, ph = Math.acos(Math.random() * 2 - 1); pos[i * 3] = 160 * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = 160 * Math.cos(ph); pos[i * 3 + 2] = 160 * Math.sin(ph) * Math.sin(th); }
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); scene.add(new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
    const eg = new T.Group(); eg.add(new T.Mesh(new T.SphereGeometry(12, 56, 40), new T.MeshStandardMaterial({ map: K.earthTexture(), roughness: .9, emissive: 0x0a2a60, emissiveIntensity: .35 })), new T.Mesh(new T.SphereGeometry(12.5, 40, 28), new T.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: .28, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false })));
    eg.position.set(-14, -9, -40); scene.add(eg); api._earth = eg;
    const rail = M({ color: 0xc0c7d6, metalness: .9, roughness: .25 }); [-4.35, 4.35].forEach(x => { mesh(new T.CylinderGeometry(.035, .035, 12, 12), rail, x, 1.4, 2, scene).rotation.x = Math.PI / 2; });
    [-2, 2].forEach(x => mesh(new T.BoxGeometry(.5, .06, 14), new T.MeshBasicMaterial({ color: 0xffffff }), x, 4.94, 2, scene));
    // monitor panel
    mesh(new T.BoxGeometry(3.9, 2.45, .14), M({ color: 0x151a28, roughness: .4, metalness: .8 }), 2.2, 2.45, bz + .05, scene);
    const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 640; pg = pc.getContext('2d'); ptex = new T.CanvasTexture(pc); ptex.encoding = T.sRGBEncoding; ptex.anisotropy = 4;
    const sc = new T.Mesh(new T.PlaneGeometry(3.6, 2.25), new T.MeshBasicMaterial({ map: ptex, toneMapped: false })); sc.position.set(2.2, 2.45, bz + .13); scene.add(sc);
    lamp = new T.Mesh(new T.BoxGeometry(3.6, .08, .06), new T.MeshBasicMaterial({ color: 0x6f7c99 })); lamp.position.set(2.2, 3.8, bz + .12); scene.add(lamp);
    mesh(new T.BoxGeometry(3.9, .9, .6), M({ color: 0x2a3042, roughness: .5, metalness: .6 }), 2.2, .45, bz + .45, scene);
  }

  /* ---------- the 3D pressure cuff on the astronaut's arm ---------- */
  function buildCuff(sh) {
    cuffG = new T.Group(); cuffG.position.set(0, -.22, 0); sh.add(cuffG);
    cuffMat = M({ color: 0x2b4a8f, roughness: .85 });
    const band = mesh(new T.CylinderGeometry(.122, .122, .21, 36), cuffMat, 0, 0, 0, cuffG);
    mesh(new T.CylinderGeometry(.126, .126, .02, 36), M({ color: 0xe9eefc, roughness: .8 }), 0, .095, 0, cuffG);   // velcro edges
    mesh(new T.CylinderGeometry(.126, .126, .02, 36), M({ color: 0xe9eefc, roughness: .8 }), 0, -.095, 0, cuffG);
    // digital monitor unit on the cuff
    const unit = mesh(new T.BoxGeometry(.05, .13, .15), M({ color: 0x1b2030, roughness: .4, metalness: .5 }), .14, 0, .02, cuffG);
    const sc = document.createElement('canvas'); sc.width = 192; sc.height = 256; sg = sc.getContext('2d'); stex = new T.CanvasTexture(sc); stex.encoding = T.sRGBEncoding;
    const scr = new T.Mesh(new T.PlaneGeometry(.12, .105), new T.MeshBasicMaterial({ map: stex, toneMapped: false })); scr.position.set(.1665, .0, .02); scr.rotation.y = Math.PI / 2; cuffG.add(scr);
    const btn = mesh(new T.CylinderGeometry(.016, .016, .02, 14), new T.MeshStandardMaterial({ color: 0xff4d5e, emissive: 0xff4d5e, emissiveIntensity: .9 }), .16, -.06, -.04, cuffG); btn.rotation.z = Math.PI / 2;
    // air hose + squeeze bulb
    const hose = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(.12, -.09, .02), new T.Vector3(.2, -.22, .06), new T.Vector3(.22, -.45, .1), new T.Vector3(.2, -.62, .1)]), 24, .012, 8), M({ color: 0x15171d, roughness: .7 })); hose.castShadow = true; cuffG.add(hose);
    const bulb = mesh(new T.SphereGeometry(.045, 16, 12), M({ color: 0xff4d5e, roughness: .5 }), .2, -.66, .1, cuffG); bulb.scale.set(1, 1.35, 1);
    // glowing "tap me" ring + invisible click target
    ring = new T.Mesh(new T.TorusGeometry(.17, .008, 8, 48), new T.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: .9 })); ring.rotation.x = Math.PI / 2; cuffG.add(ring);
    hit = new T.Mesh(new T.SphereGeometry(.3, 12, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); cuffG.add(hit);
  }
  function drawCuffScreen() {
    const g = sg, d = getData() || {}; const busy = !!meas; g.fillStyle = '#04101e'; g.fillRect(0, 0, 192, 256);
    g.fillStyle = '#4cc9f0'; g.font = 'bold 22px Arial'; g.fillText('BP', 10, 28);
    g.fillStyle = busy ? '#ffd23f' : '#fff'; g.font = 'bold 66px Arial'; g.fillText(busy ? String(Math.round(press)) : (st.sys == null ? '--' : st.sys), 10, 100);
    g.fillStyle = '#9aa7c7'; g.font = '20px Arial'; g.fillText(busy ? 'mmHg' : 'SYS', 10, 126);
    g.fillStyle = '#fff'; g.font = 'bold 66px Arial'; g.fillText(st.dia == null ? '--' : st.dia, 10, 200); g.fillStyle = '#9aa7c7'; g.font = '20px Arial'; g.fillText('DIA', 10, 226);
    stex.needsUpdate = true;
  }

  /* ---------- big panel ---------- */
  function drawPanel(t) {
    const g = pg, w = 1024, h = 640, d = getData() || {}, done = st.sys != null && st.dia != null && !meas;
    const lv = done ? level(st.sys, st.dia) : -1, col = lv < 0 ? '#7f8fb0' : ['#2ee6a6', '#ffd23f', '#ff4d5e'][lv], word = meas ? 'MEASURING…' : done ? ['STABLE', 'ATTENTION', 'EMERGENCY'][lv] : 'READY';
    g.fillStyle = '#04091a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(76,201,240,.10)'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#4cc9f0'; g.font = 'bold 34px "Segoe UI",Arial'; g.fillText('BLOOD PRESSURE MONITOR', 28, 50);
    g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(700, 14, 296, 48, 24) : g.rect(700, 14, 296, 48); g.fill(); g.fillStyle = '#04091a'; g.font = 'bold 26px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(word, 848, 48); g.textAlign = 'left';
    // cuff pressure gauge
    const cx = 230, cy = 280, r = 160; g.lineWidth = 28; g.lineCap = 'round'; g.strokeStyle = '#16203a'; g.beginPath(); g.arc(cx, cy, r, Math.PI * .8, Math.PI * 2.2); g.stroke();
    const f = clamp(press / 220, 0, 1); g.strokeStyle = meas ? '#ffd23f' : '#2ee6a6'; g.beginPath(); g.arc(cx, cy, r, Math.PI * .8, Math.PI * (.8 + 1.4 * f)); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 96px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(String(Math.round(press)), cx, cy + 26); g.fillStyle = '#9aa7c7'; g.font = '26px "Segoe UI",Arial'; g.fillText('CUFF PRESSURE · mmHg', cx, cy + 72); g.textAlign = 'left';
    const big = (label, val, unit, x, y, c) => { g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(label, x, y); g.fillStyle = c; g.font = 'bold 84px "Segoe UI",Arial'; g.fillText(val, x, y + 76); const wv = g.measureText(val).width; g.fillStyle = '#9aa7c7'; g.font = '24px "Segoe UI",Arial'; g.fillText(unit, x + wv + 10, y + 76); };
    big('SYSTOLIC', st.sys == null ? '--' : String(st.sys), 'mmHg', 470, 96, st.sys == null ? '#5b6781' : '#ff7a8a'); big('DIASTOLIC', st.dia == null ? '--' : String(st.dia), 'mmHg', 470, 236, st.dia == null ? '#5b6781' : '#ffd23f');
    big('PULSE', st.pulse == null ? '--' : String(st.pulse), 'bpm', 760, 96, st.pulse == null ? '#5b6781' : '#4cc9f0');
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText('MEAN (MAP)', 760, 236); g.fillStyle = '#fff'; g.font = 'bold 54px "Segoe UI",Arial'; g.fillText(done ? String(Math.round((st.sys + 2 * st.dia) / 3)) : '--', 760, 296);
    // pressure trace
    g.fillStyle = '#020611'; g.fillRect(28, 400, 968, 150); g.strokeStyle = 'rgba(46,230,166,.15)'; for (let x = 28; x <= 996; x += 48) { g.beginPath(); g.moveTo(x, 400); g.lineTo(x, 550); g.stroke(); }
    g.strokeStyle = meas ? '#ffd23f' : '#2ee6a6'; g.lineWidth = 3; g.beginPath(); trace.forEach((v, i) => { const x = 28 + i / 140 * 968, y = 546 - clamp(v / 220, 0, 1) * 140; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText(meas ? 'Cuff pressure · listening to the pulse…' : done ? 'Measurement complete · normal is about 120/80 mmHg' : 'Tap the cuff on the astronaut\'s arm to start', 28, 590); g.textAlign = 'right'; g.fillText('● LIVE', 996, 590); g.textAlign = 'left';
    ptex.needsUpdate = true;
  }

  /* ---------- measurement sequence ---------- */
  api.measure = function (sys, dia, pulse) {
    if (meas) return false;
    meas = { t: 0, sys, dia, pulse, top: sys + 35, bot: 38, sysDone: false, diaDone: false, phase: 'inflate' }; st.sys = st.dia = st.pulse = null; trace.length = 0; press = 0; onPhase('start'); return true;
  };
  function stepMeasure(dt) {
    if (!meas) return; meas.t += dt; const m = meas, tInf = 2.4, tHold = .35, tDef = 4.2;
    if (m.t < tInf) { const k = m.t / tInf; press = m.top * (1 - Math.pow(1 - k, 2)); if (Math.random() < dt * 14) onPhase('pump'); }
    else if (m.t < tInf + tHold) { press = m.top; }
    else if (m.t < tInf + tHold + tDef) {
      const k = (m.t - tInf - tHold) / tDef; const prev = press; press = m.top + (m.bot - m.top) * k;
      if (!m.sysDone && press <= m.sys) { m.sysDone = true; st.sys = m.sys; onPhase('sys'); }
      if (!m.diaDone && press <= m.dia) { m.diaDone = true; st.dia = m.dia; onPhase('dia'); }
      if (press <= m.sys && press >= m.dia) { const bp = m.pulse || 72; if (Math.floor((m.t) * bp / 60) !== Math.floor((m.t - dt) * bp / 60)) onPhase('beat'); }
    } else { st.sys = m.sys; st.dia = m.dia; st.pulse = m.pulse; press = 0; const s = m.sys, d = m.dia; meas = null; onPhase('end'); onDone(s, d); }
  }
  api.show = function (s, d) { if (meas) return; st.sys = s; st.dia = d; st.pulse = (getData() || {}).hr || null; };
  api.reset = function () { meas = null; press = 0; st.sys = st.dia = st.pulse = null; trace.length = 0; };

  /* ---------- loop ---------- */
  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    stepMeasure(dt);
    // astronaut floating in microgravity
    body.position.set(0, 1.55 + Math.sin(t * .8) * .08, 0); body.rotation.set(Math.sin(t * .6) * .03 - .02, -.45 + Math.sin(t * .35) * .12 + drag.yaw, Math.sin(t * .5) * .04);
    const hold = meas ? Math.sin(t * 2) * .01 : 0;
    A.shR.rotation.set(-.55 + Math.sin(t * .9) * .03, 0, .32); A.elR.rotation.set(-1.45 + Math.sin(t * 1.1) * .04, 0, 0);
    A.shL.rotation.set(Math.sin(t * .9 + 1) * .08 - .15, 0, -.25 - Math.sin(t * .8) * .06); A.elL.rotation.x = -.35 - Math.sin(t * 1.1 + 1) * .06;
    A.hipL.rotation.set(-.3 + Math.sin(t * .7) * .08, 0, -.1); A.hipR.rotation.set(-.2 + Math.sin(t * .7 + 1) * .08, 0, .1); A.kneeL.rotation.x = .55 + Math.sin(t * .7) * .08; A.kneeR.rotation.x = .45 + Math.sin(t * .7 + 1) * .08;
    A.ankleL.rotation.x = .25; A.ankleR.rotation.x = .2;
    // cuff inflates with the pressure; ring pulses while idle
    const sc = 1 + clamp(press / 220, 0, 1) * .22 + hold; cuffG.scale.set(sc, 1, sc);
    ring.visible = !meas && st.sys == null; ring.scale.setScalar(1 + Math.sin(t * 4) * .12); ring.material.opacity = .55 + Math.sin(t * 4) * .35;
    cuffMat.emissive = cuffMat.emissive || new T.Color(0); cuffMat.emissive.setHex(meas ? 0x0a1840 : 0x000000);
    if (now - lastPanel > 60) { lastPanel = now; trace.push(press + (meas && meas.sysDone && !meas.diaDone ? Math.sin(t * 18) * 3 : 0)); if (trace.length > 140) trace.shift(); drawPanel(t); drawCuffScreen(); }
    const done = st.sys != null && !meas; lamp.material.color.set(meas ? 0xffd23f : done ? [0x2ee6a6, 0xffd23f, 0xff4d5e][level(st.sys, st.dia)] : 0x6f7c99);
    api._earth.rotation.y = t * .01;
    cam.position.x = Math.sin(t * .2) * .25 - .5 + drag.yaw * .5; cam.position.y = camBase.y + Math.sin(t * .27) * .04; cam.lookAt(.25, 1.8, 0);
    R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 3.1, needW = clamp(a * 4.2, 3.4, 6.4);
    cam.position.z = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)); cam.updateProjectionMatrix();
  }

  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; getData = opts.getData || getData; level = opts.level || level; onPhase = opts.onPhase || onPhase; onDone = opts.onDone || onDone;
    try {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
      stage.insertBefore(canvas, stage.firstChild);
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02040c); cam = new T.PerspectiveCamera(38, 1, .1, 400); cam.position.set(-.5, camBase.y, camBase.z);
      const envS = new T.Scene(); envS.background = new T.Color(0x0a1226);
      [[6, 3, 0, 6, 0, 0xffffff, 6], [4, 4, -7, 2, 2, 0xcfe6ff, 4], [4, 2, 6, 1, -4, 0xffd9a0, 3], [8, 3, 0, -6, 0, 0x4cc9f0, 1.2], [5, 5, 0, 2, -8, 0x2b6fd6, 1.5]].forEach(([w, h, x, y, z, c, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); });
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(envS, .02).texture; pm.dispose();
      scene.add(new T.HemisphereLight(0xbfd8ff, 0x2a2f44, .55));
      const key = new T.DirectionalLight(0xfff2e0, 1.6); key.position.set(3, 6, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const s = key.shadow.camera; s.left = -3; s.right = 3; s.top = 4; s.bottom = -2; s.near = 1; s.far = 20; key.shadow.bias = -.0004; key.target.position.set(0, 1.5, 0); scene.add(key, key.target);
      const rim = new T.DirectionalLight(0x9fd0ff, 1.0); rim.position.set(-6, 3, -8); scene.add(rim);
      const sl = new T.PointLight(0x4cc9f0, 1.2, 9); sl.position.set(2.2, 2.4, -2.2); scene.add(sl);
      buildRoom();
      A = B.makeAstronaut(scene); body = A.body; buildCuff(A.shR);
      // interaction: tap the cuff
      const ray = new T.Raycaster(), mv = new T.Vector2(); let downX = 0, moved = 0;
      const over = e => { const r = canvas.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); return ray.intersectObject(hit, false).length > 0; };
      canvas.addEventListener('pointerdown', e => { drag.down = true; drag.x = downX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag.down) { canvas.style.cursor = over(e) ? 'pointer' : 'grab'; return; } moved = Math.max(moved, Math.abs(e.clientX - downX)); canvas.style.cursor = 'grabbing'; drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .008, -1.2, 1.2); drag.x = e.clientX; });
      canvas.addEventListener('pointerup', e => { const was = drag.down; drag.down = false; canvas.style.cursor = 'grab'; if (was && moved < 6 && over(e) && opts.onCuffClick) opts.onCuffClick(); });
      canvas.addEventListener('pointercancel', () => { drag.down = false; });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D blood pressure scene unavailable, using the 2D drawing instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false; }
  };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
})();
