/* Phase 3 · Computer triage in 3D (Three.js r149): the astronaut stands in front of the holographic triage console with three sensors on the suit
   (heart on the chest, blood drop on the belly, radiation emblem on the arm). A scan beam reads them and reveals the real "? / 10" score;
   three physical buttons (CRITICAL · ATTENTION · NORMAL) are synced with the 2D panel. Cabin light and astronaut react to the score band.
   Needs cabin3d.js + bike3d.js.   API: Triage3d.init(stage,{getData,onPick,onReveal}) · reveal() · feedback(res,guess) · reset() · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D, B = window.Bike3D;
  const api = { ready: false, failed: false };
  window.Triage3d = api;
  if (!T || !C || !C.kit || !B || !B.makeAstronaut) { api.failed = true; return; }
  const K = C.kit, M = K.M, ctex = K.ctex, clamp = K.clamp, mesh = K.mesh;
  const V = (x, y, z) => new T.Vector3(x, y, z), lerp = (a, b, p) => a + (b - a) * p, ease = p => p * p * (3 - 2 * p);
  const COL = [0x2ee6a6, 0xffd23f, 0xff4d5e], GREY = 0x6f7c99, CSS = ['#2ee6a6', '#ffd23f', '#ff4d5e'];

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, getData = () => ({}), onPick = () => {}, onReveal = () => {};
  let t0 = performance.now(), last = 0, lastDraw = 0, drag = { yaw: 0, down: false, x: 0 }, camBase = { y: 1.9, z: 7 };
  let A, body, statusL, beam, holo, holoCtx, holoTex, wallCtx, wallTex, lamp, segs = [], marker, btns = [], sens = {}, beads = [], hits = [];
  let scan = null, revealed = false, shown = 0, fb = null, lastN = null;
  const BAND = n => n >= 8 ? 0 : n >= 5 ? 1 : 2;

  /* ---------- room, wall panel, console ---------- */
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
    // wall panel (mirror of the triage screen + MESSAGES)
    mesh(new T.BoxGeometry(3.9, 2.45, .14), M({ color: 0x151a28, roughness: .4, metalness: .8 }), 2.45, 2.75, bz + .05, scene);
    const wc = document.createElement('canvas'); wc.width = 1024; wc.height = 640; wallCtx = wc.getContext('2d'); wallTex = new T.CanvasTexture(wc); wallTex.encoding = T.sRGBEncoding; wallTex.anisotropy = 4;
    const ws = new T.Mesh(new T.PlaneGeometry(3.6, 2.25), new T.MeshBasicMaterial({ map: wallTex, toneMapped: false })); ws.position.set(2.45, 2.75, bz + .13); scene.add(ws);
    lamp = new T.Mesh(new T.BoxGeometry(3.6, .08, .06), new T.MeshBasicMaterial({ color: GREY })); lamp.position.set(2.45, 4.0, bz + .12); scene.add(lamp);
    mesh(new T.BoxGeometry(3.9, .9, .6), M({ color: 0x2a3042, roughness: .5, metalness: .6 }), 2.45, .45, bz + .45, scene);
  }
  function consoleBench() {
    const c = new T.Group(); c.position.set(1.0, 0, .45); c.rotation.y = -.4; scene.add(c);
    const dark = M({ color: 0x1b2030, roughness: .4, metalness: .6 }), alu = M({ color: 0xd7dce8, metalness: .9, roughness: .3 });
    mesh(new T.BoxGeometry(1.5, .88, .7), M({ color: 0x38445f, roughness: .55, metalness: .5 }), 0, .44, 0, c); mesh(new T.BoxGeometry(1.56, .05, .76), M({ color: 0xe9edf5, roughness: .25, metalness: .3 }), 0, .905, 0, c);
    const slope = mesh(new T.BoxGeometry(1.4, .06, .4), dark, 0, 1.0, .12, c); slope.rotation.x = -.25;
    // colour bar 0 critical · 5 attention · 10 normal
    for (let i = 0; i < 10; i++) { const band = i <= 3 ? 2 : i <= 6 ? 1 : 0, m = new T.MeshStandardMaterial({ color: 0x111, emissive: COL[band], emissiveIntensity: .25 }); const s = mesh(new T.BoxGeometry(.12, .035, .07), m, -.54 + i * .12, 1.07, -.06, c); segs.push(s); }
    marker = mesh(new T.ConeGeometry(.04, .09, 4), new T.MeshBasicMaterial({ color: 0xffffff }), 0, 1.16, -.06, c); marker.rotation.x = Math.PI; marker.visible = false;
    const lab = new T.Mesh(new T.PlaneGeometry(1.2, .09), new T.MeshBasicMaterial({ map: ctex(512, 40, (g, w, h) => { g.fillStyle = '#9aa7c7'; g.font = 'bold 22px Arial'; g.fillText('0 critical', 6, 28); g.textAlign = 'center'; g.fillText('5 attention', w / 2, 28); g.textAlign = 'right'; g.fillText('10 normal', w - 6, 28); }), transparent: true, toneMapped: false })); lab.position.set(0, 1.04, .04); lab.rotation.x = -.5; c.add(lab);
    // three physical buttons
    [['CRITICAL', 2, -.42], ['ATTENTION', 1, 0], ['NORMAL', 0, .42]].forEach(([name, lv, x]) => {
      const bm = new T.MeshStandardMaterial({ color: 0x151a22, emissive: COL[lv], emissiveIntensity: .5, roughness: .25 }); const b = mesh(new T.SphereGeometry(.09, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), bm, x, 1.03, .22, c); b.scale.y = .55;
      mesh(new T.CylinderGeometry(.105, .115, .03, 28), alu, x, 1.025, .22, c);
      const tl = new T.Mesh(new T.PlaneGeometry(.26, .06), new T.MeshBasicMaterial({ map: ctex(256, 60, (g, w, h) => { g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, w, h); g.fillStyle = CSS[lv]; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText(name, w / 2, 38); }), transparent: true, toneMapped: false })); tl.position.set(x, 1.0, .34); tl.rotation.x = -.7; c.add(tl);
      const h = new T.Mesh(new T.SphereGeometry(.14, 10, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); h.position.set(x, 1.05, .22); h.userData = { btn: lv }; c.add(h); hits.push(h); btns.push({ mesh: b, mat: bm, lv, h });
    });
    const ch = new T.Mesh(new T.BoxGeometry(1.5, .9, .8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); ch.position.set(0, .8, 0); ch.userData = { console: true }; c.add(ch); hits.push(ch);
    return c;
  }

  /* ---------- astronaut with 3 sensors ---------- */
  function iconTex(txt, col) { return ctex(128, 128, (c, w, h) => { c.fillStyle = '#06101e'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.strokeStyle = col; c.lineWidth = 6; c.stroke(); c.font = '64px "Segoe UI Emoji","Apple Color Emoji",Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(txt, 64, 68); }); }
  function sensor(key, icon, parent, pos, rotY) {
    const g = new T.Group(); g.position.copy(pos); g.rotation.y = rotY || 0; parent.add(g);
    const disc = new T.Mesh(new T.CircleGeometry(.062, 32), new T.MeshBasicMaterial({ map: iconTex(icon, '#6f7c99'), transparent: true, toneMapped: false })); disc.position.z = .004; g.add(disc);
    const ring = new T.Mesh(new T.TorusGeometry(.068, .008, 8, 32), new T.MeshBasicMaterial({ color: GREY, transparent: true, opacity: .9 })); g.add(ring);
    const halo = new T.Mesh(new T.CircleGeometry(.11, 32), new T.MeshBasicMaterial({ color: GREY, transparent: true, opacity: .0, blending: T.AdditiveBlending, depthWrite: false })); halo.position.z = -.002; g.add(halo);
    sens[key] = { g, ring, halo, lvl: -1, on: 0 };
  }
  function astronaut() {
    A = B.makeAstronaut(scene, { noChest: true }); body = A.body; body.position.set(-.85, 1.16, -.5); body.rotation.y = .35;
    A.shL.rotation.set(0, 0, -.14); A.shR.rotation.set(0, 0, .14); A.elL.rotation.x = -.15; A.elR.rotation.x = -.15; A.hipL.rotation.set(0, 0, -.04); A.hipR.rotation.set(0, 0, .04);
    sensor('heart', '❤️', body, V(.1, .43, .21), .0); sensor('blood', '🩸', body, V(.02, .12, .235), 0); sensor('rad', '☢️', A.shR, V(.075, -.22, .075), .8);
    body.updateMatrixWorld(true);
    // scan beam (vertical ring + glow)
    beam = new T.Group(); scene.add(beam); const r = new T.Mesh(new T.TorusGeometry(.6, .012, 8, 64), new T.MeshBasicMaterial({ color: 0x9fffe4, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false })); r.rotation.x = Math.PI / 2; beam.add(r);
    const gl = new T.Mesh(new T.CircleGeometry(.6, 48), new T.MeshBasicMaterial({ color: 0x9fffe4, transparent: true, opacity: .14, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); gl.rotation.x = -Math.PI / 2; beam.add(gl); beam.visible = false;
    for (let i = 0; i < 14; i++) { const b = new T.Mesh(new T.SphereGeometry(.014, 8, 6), new T.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); b.visible = false; scene.add(b); beads.push(b); }
  }

  /* ---------- hologram + wall screen ---------- */
  function drawScreen(ctx, tex, big, d, t) {
    const w = big ? 1024 : 512, h = big ? 640 : 384, k = big ? 2 : 1, g = ctx, band = lastN == null ? -1 : BAND(lastN), col = band < 0 ? '#7f8fb0' : CSS[band];
    g.clearRect(0, 0, w, h); g.fillStyle = big ? '#04091a' : 'rgba(4,14,34,.55)'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(76,201,240,.12)'; for (let x = 0; x < w; x += 32 * k) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 32 * k) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#4cc9f0'; g.font = 'bold ' + 24 * k + 'px "Segoe UI",Arial'; g.fillText('ASTRONAUT OUTPUT (0 to 10)', 18 * k, 34 * k);
    const scanning = scan && !revealed, val = revealed ? Math.round(shown) : (scanning ? Math.floor((t * 14) % 11) : null);
    g.fillStyle = scanning ? '#9fffe4' : revealed ? col : '#5b6781'; g.font = 'bold ' + 150 * k + 'px "Segoe UI",Arial'; g.fillText(val == null ? '?' : String(val), 18 * k, 190 * k); const wv = g.measureText(val == null ? '?' : String(val)).width; g.fillStyle = '#9aa7c7'; g.font = 28 * k + 'px "Segoe UI",Arial'; g.fillText('/ 10', 30 * k + wv, 190 * k);
    g.fillStyle = scanning ? '#9fffe4' : col; g.font = 'bold ' + 30 * k + 'px "Segoe UI",Arial'; g.fillText(scanning ? 'SCANNING…' : revealed ? (d.done ? '✔ ' : '') + ['NORMAL', 'ATTENTION', 'CRITICAL'][band] : 'TAP THE CONSOLE TO SCAN', 18 * k, 236 * k);
    for (let i = 0; i < 10; i++) { const b = i <= 3 ? 2 : i <= 6 ? 1 : 0; g.fillStyle = CSS[b]; g.globalAlpha = revealed && Math.round(shown) === i ? 1 : .4; g.fillRect(18 * k + i * 44 * k, 256 * k, 40 * k, 14 * k); } g.globalAlpha = 1;
    if (big) { g.fillStyle = '#9aa7c7'; g.font = '20px "Segoe UI",Arial'; g.fillText('0 critical', 18, 300); g.textAlign = 'center'; g.fillText('5 attention', 238, 300); g.textAlign = 'right'; g.fillText('10 normal', 458, 300); g.textAlign = 'left';
      g.fillStyle = '#000a'; g.fillRect(500, 70, 500, 250); g.strokeStyle = 'rgba(255,255,255,.15)'; g.strokeRect(500, 70, 500, 250); g.fillStyle = '#4cc9f0'; g.font = 'bold 22px Consolas,monospace'; g.fillText('MESSAGES', 516, 100); g.fillStyle = '#d6def5'; g.font = '22px Consolas,monospace';
      const lines = (d.msg || '').split('\n').filter(Boolean).slice(0, 5); let y = 134; lines.forEach(l => { const words = l.split(' '); let line = ''; words.forEach(wd => { if (g.measureText(line + wd).width > 470) { g.fillText(line, 516, y); y += 28; line = ''; } line += wd + ' '; }); g.fillText(line, 516, y); y += 32; });
      g.fillStyle = '#9aa7c7'; g.font = '22px "Segoe UI",Arial'; g.fillText('What do you think the astronaut\'s state is?', 18, 370); g.fillText('Use the three buttons on the console, or keys 1 · 2 · 3.', 18, 404);
      ['CRITICAL', 'ATTENTION', 'NORMAL'].forEach((n, i) => { const l = 2 - i, x = 18 + i * 320; g.strokeStyle = CSS[l]; g.lineWidth = 3; g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.roundRect ? g.roundRect(x, 440, 300, 70, 14) : g.rect(x, 440, 300, 70); g.fill(); g.stroke(); g.fillStyle = CSS[l]; g.font = 'bold 28px "Segoe UI",Arial'; g.textAlign = 'center'; g.fillText(n, x + 150, 485); g.textAlign = 'left'; });
    } else if (d.msg) { g.fillStyle = '#d6def5'; g.font = '17px Consolas,monospace'; const l = d.msg.split('\n').filter(Boolean).pop() || ''; g.fillText(l.slice(0, 44), 18, 340); }
    tex.needsUpdate = true;
  }

  /* ---------- actions ---------- */
  api.reveal = function () { if (scan && !revealed) return; const d = getData() || {}; if (d.n == null) return; scan = { t: (performance.now() - t0) / 1000 }; revealed = false; shown = 0; lastN = null; fb = null; };
  api.reset = function () { scan = null; revealed = false; shown = 0; lastN = null; fb = null; Object.values(sens).forEach(s => { s.lvl = -1; s.on = 0; }); };
  api.feedback = function (res, guess) { fb = { res, guess, t: 0 }; };
  function worst(d) { const L = d.lv || {}; const h = Math.max(L.hr ?? -1, L.bp ?? -1, L.pain ?? -1), b = L.glu ?? -1, r = L.rad ?? -1; return { heart: h, blood: b, rad: r }; }
  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - (last || now)) / 1000); last = now; const d = getData() || {}, n = d.n, g = d.g == null ? -1 : d.g;
    // scan sequence: beam up/down (0-2.4 s), data flies to the hologram (2.0-3.2 s), number counts up, then reveal
    let phase = -1, e = 0; if (scan) { e = t - scan.t; phase = e < 2.4 ? 0 : e < 3.4 ? 1 : 2; }
    beam.visible = phase === 0; if (phase === 0) { const u = e / 2.4, y = u < .5 ? lerp(.1, 2.2, ease(u * 2)) : lerp(2.2, .1, ease((u - .5) * 2)); beam.position.set(body.position.x, y, body.position.z); }
    if (scan && !revealed && phase === 2) { shown = lerp(shown, n, Math.min(1, dt * 6)); if (e > 4.0) { revealed = true; shown = n; lastN = n; onReveal(n); } }
    if (revealed && lastN !== n && n != null) { lastN = n; shown = n; }
    const band = revealed && lastN != null ? BAND(lastN) : -1;
    // sensors: power up one after another during the scan, then show their own level; critical blinks fast, attention slower
    const wst = worst(d); ['heart', 'blood', 'rad'].forEach((k, i) => { const s = sens[k], on = scan ? clamp((e - .5 * i - .3) / .5, 0, 1) : 0; s.on = revealed ? 1 : on; const lv = revealed ? wst[k] : -1; const col = lv < 0 ? (s.on > .5 ? 0x4cc9f0 : GREY) : COL[lv]; const blink = lv === 2 ? (Math.sin(t * 12) > 0 ? 1 : .15) : lv === 1 ? (Math.sin(t * 5) > 0 ? 1 : .45) : 1;
      s.ring.material.color.setHex(col); s.ring.material.opacity = s.on ? blink : .5; s.halo.material.color.setHex(col); s.halo.material.opacity = s.on ? .35 * blink : 0; s.g.visible = true; });
    // data beads from the sensors to the hologram while the data is sent
    const hp = holo.position; beads.forEach((b, i) => { const s = sens[['heart', 'blood', 'rad'][i % 3]], k = ((e - 2.0) * .9 - Math.floor(i / 3) * .12); b.visible = phase === 1 && k > 0 && k < 1; if (b.visible) { const a = s.g.getWorldPosition(V(0, 0, 0)), c = hp.clone(); const m = a.clone().lerp(c, .5).add(V(0, .5, .3)); b.position.set(lerp(lerp(a.x, m.x, k), lerp(m.x, c.x, k), k), lerp(lerp(a.y, m.y, k), lerp(m.y, c.y, k), k), lerp(lerp(a.z, m.z, k), lerp(m.z, c.z, k), k)); } });
    // cabin light + reactions
    let lc = 0x6fb4ff, li = .8; if (band === 2) { lc = 0xff3050; li = .9 + .8 * Math.sin(t * 5); } else if (band === 1) { lc = 0xffb43a; li = 1.0; } else if (band === 0) { lc = 0x40e0b0; li = .9; } statusL.color.setHex(lc); statusL.intensity = li; lamp.material.color.setHex(band < 0 ? GREY : COL[band]);
    let lean = 0; A.shL.rotation.set(Math.sin(t * .9) * .05, 0, -.14); A.elL.rotation.set(-.15, 0, 0); A.shR.rotation.set(Math.sin(t * .9 + 1) * .05, 0, .14); A.elR.rotation.set(-.15, 0, 0);
    if (band === 2) { A.shL.rotation.set(-.45, 0, .55); A.elL.rotation.set(-1.95, 0, 0); lean = .12; } else if (band === 1) { lean = .06; A.shR.rotation.set(-.6, 0, .3); A.elR.rotation.set(-1.5, 0, 0); } else if (band === 0) { A.shR.rotation.set(-1.15 + Math.sin(t * 3) * .05, 0, .35); A.elR.rotation.set(-1.35, 0, 0); }
    body.position.y = 1.16 + Math.sin(t * 1.1) * .005; body.rotation.set(lean + Math.sin(t * .7) * .012, .35 + Math.sin(t * .4) * .04, 0);
    // console bar + buttons (feedback: the correct band blinks after a wrong guess; green confirmation when right)
    if (fb) fb.t += dt; const wrong = fb && fb.res === 'wrong' && fb.t < 3.2, right = fb && fb.res === 'ok';
    segs.forEach((s, i) => { const b = i <= 3 ? 2 : i <= 6 ? 1 : 0; let k = .25 + (revealed && Math.round(lastN) === i ? 1.1 : 0); if (wrong && revealed && b === band) k = .5 + .9 * (Math.sin(t * 10) > 0 ? 1 : 0); if (right) k = .9 + .3 * Math.sin(t * 6); s.material.emissiveIntensity = k; if (right) s.material.emissive.setHex(0x2ee6a6); else s.material.emissive.setHex(COL[b]); });
    marker.visible = revealed; if (revealed) { marker.position.x = -.54 + clamp(lastN, 0, 10 - 1e-6) * .12; marker.material.color.setHex(COL[band]); }
    btns.forEach(b => { let k = revealed ? .5 : .2; if (wrong && fb.guess === b.lv) k = .3; if (wrong && revealed && b.lv === band) k = .6 + .8 * (Math.sin(t * 10) > 0 ? 1 : 0); if (right) k = b.lv === band ? 1.6 + .4 * Math.sin(t * 8) : .15; b.mat.emissiveIntensity = k; b.mesh.position.y = 1.03 - ((fb && fb.guess === b.lv && fb.t < .25) ? .03 : 0); });
    // hologram (always faces the camera) + wall mirror
    holo.lookAt(cam.position); holo.position.y = 1.62 + Math.sin(t * 1.4) * .02;
    if (now - lastDraw > 70) { lastDraw = now; drawScreen(holoCtx, holoTex, false, d, t); drawScreen(wallCtx, wallTex, true, d, t); }
    api._earth.rotation.y = t * .01;
    cam.position.x = Math.sin(t * .2) * .25 + .5 + drag.yaw * .6; cam.position.y = camBase.y + Math.sin(t * .27) * .04; cam.lookAt(.1, 1.3, -.1);
    R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 3.0, needW = clamp(a * 3.4, 3.4, 6.2);
    camBase.z = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)) + .3; cam.position.z = camBase.z; cam.updateProjectionMatrix();
  }

  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; getData = opts.getData || getData; onPick = opts.onPick || onPick; onReveal = opts.onReveal || onReveal;
    try {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab'; stage.insertBefore(canvas, stage.firstChild);
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02040c); cam = new T.PerspectiveCamera(38, 1, .1, 400); cam.position.set(.5, camBase.y, camBase.z);
      const envS = new T.Scene(); envS.background = new T.Color(0x0a1226);
      [[6, 3, 0, 6, 0, 0xffffff, 6], [4, 4, -7, 2, 2, 0xcfe6ff, 4], [4, 2, 6, 1, -4, 0xffd9a0, 3], [8, 3, 0, -6, 0, 0x4cc9f0, 1.2], [5, 5, 0, 2, -8, 0x2b6fd6, 1.5]].forEach(([w, h, x, y, z, c, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); });
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(envS, .02).texture; pm.dispose();
      scene.add(new T.HemisphereLight(0xbfd8ff, 0x2a2f44, .6));
      const key = new T.DirectionalLight(0xfff2e0, 1.6); key.position.set(2.5, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const s = key.shadow.camera; s.left = -3.5; s.right = 3.5; s.top = 3.5; s.bottom = -2; s.near = 1; s.far = 20; key.shadow.bias = -.0004; key.target.position.set(0, 1, -.2); scene.add(key, key.target);
      const rim = new T.DirectionalLight(0x9fd0ff, .9); rim.position.set(-6, 3, -8); scene.add(rim); statusL = new T.PointLight(0x6fb4ff, .8, 9); statusL.position.set(0, 3.2, 1); scene.add(statusL);
      room(); const bench = consoleBench(); astronaut();
      // floating hologram above the console
      holo = new T.Group(); holo.position.set(1.05, 1.62, .35); scene.add(holo);
      const hc = document.createElement('canvas'); hc.width = 512; hc.height = 384; holoCtx = hc.getContext('2d'); holoTex = new T.CanvasTexture(hc); holoTex.encoding = T.sRGBEncoding; holoTex.anisotropy = 4;
      const hp = new T.Mesh(new T.PlaneGeometry(.95, .71), new T.MeshBasicMaterial({ map: holoTex, transparent: true, opacity: .92, toneMapped: false, side: T.DoubleSide })); holo.add(hp);
      const fr = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(.95, .71)), new T.LineBasicMaterial({ color: 0x4cc9f0 })); holo.add(fr); const hh = new T.Mesh(new T.PlaneGeometry(.95, .71), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hh.userData = { console: true }; holo.add(hh); hits.push(hh);
      // interaction
      const ray = new T.Raycaster(), mv = new T.Vector2(); let downX = 0, moved = 0;
      const pick = e => { const r = canvas.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); const hs = ray.intersectObjects(hits, false); if (!hs.length) return null; const b = hs.find(h => h.object.userData.btn != null); return b ? b.object.userData : hs[0].object.userData; };
      const choose = lv => { const d = getData() || {}; if (!revealed || d.done) { if (!revealed && !scan) api.reveal(); return; } const res = onPick(lv); api.feedback(res, lv); };
      canvas.addEventListener('pointerdown', e => { drag.down = true; drag.x = downX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag.down) { canvas.style.cursor = pick(e) ? 'pointer' : 'grab'; return; } moved = Math.max(moved, Math.abs(e.clientX - downX)); canvas.style.cursor = 'grabbing'; drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .008, -1.3, 1.3); drag.x = e.clientX; });
      canvas.addEventListener('pointerup', e => { const was = drag.down; drag.down = false; canvas.style.cursor = 'grab'; if (was && moved < 6) { const o = pick(e); if (!o) return; if (o.btn != null) choose(o.btn); else if (o.console && !revealed) api.reveal(); } });
      canvas.addEventListener('pointercancel', () => { drag.down = false; });
      document.addEventListener('keydown', e => { if (!running || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; const k = e.key.toLowerCase(), lv = { 1: 2, c: 2, 2: 1, a: 1, 3: 0, n: 0 }[k]; if (lv != null) { choose(lv); } else if (k === 'r' && !revealed) api.reveal(); });
      api._choose = choose;
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D triage unavailable, using the 2D screen instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false; }
  };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
})();
