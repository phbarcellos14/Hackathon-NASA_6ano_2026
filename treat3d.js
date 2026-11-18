/* Phase 4 · Treatment in 3D (Three.js r149): the same dark navy cabin with the Earth window and a free camera.
   Critical (or arrhythmia): tap the capsule (or the water pouch) and the astronaut opens the helmet, catches the capsule and the water pouch in microgravity,
   brings them to the mouth, drinks, and shows relief while the cabin light warms and the wall indicators improve.
   Attention: tap the dumbbell and the astronaut does bicep curls and recovers.   Keys: P = capsule, D = dumbbell.
   Needs cabin3d.js + bike3d.js.   API: Treat3d.init(stage,{getData,onUse}) · play(kind) · wrong(kind) · reset() · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D, B = window.Bike3D;
  const api = { ready: false, failed: false };
  window.Treat3d = api;
  if (!T || !C || !C.kit || !B || !B.makeAstronaut) { api.failed = true; return; }
  const K = C.kit, M = K.M, ctex = K.ctex, clamp = K.clamp, mesh = K.mesh;
  const V = (x, y, z) => new T.Vector3(x, y, z), lerp = (a, b, p) => a + (b - a) * p, ease = p => p * p * (3 - 2 * p);

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, getData = () => ({}), onUse = () => false;
  let t0 = performance.now(), last = 0, lastDraw = 0, drag = { yaw: 0, down: false, x: 0 }, camBase = { y: 1.9, z: 7 };
  let A, body, face, skinMat, bubble, mouthM, hemi, key, warmL, alertL, pillG, pouchG, dumbG, hitPill, hitPouch, hitDumb, pg, ptex, ring;
  let act = null, warm = 0, shake = 0, disp = { hr: 78, sys: 120, dia: 80, spo2: 97, stress: 5, mood: 3 }, earth;
  const home = { pill: V(1.15, 1.62, -2.55), pouch: V(1.85, 1.5, -2.5), dumb: V(2.65, 1.5, -2.55) };

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
    // bench with the open medicine case
    mesh(new T.BoxGeometry(3.0, 1.0, .9), M({ color: 0x2a3042, roughness: .5, metalness: .6 }), 1.9, .5, -3.05, scene);
    mesh(new T.BoxGeometry(3.1, .06, .95), M({ color: 0x3a4666, roughness: .35, metalness: .7 }), 1.9, 1.03, -3.05, scene);
    const cs = new T.Group(); cs.position.set(1.15, 1.06, -2.95); scene.add(cs);
    mesh(new T.BoxGeometry(.8, .12, .5), M({ color: 0xe9edf5, roughness: .4, metalness: .3 }), 0, .06, 0, cs);
    mesh(new T.BoxGeometry(.7, .02, .4), M({ color: 0x1b2a52, roughness: .6 }), 0, .125, 0, cs);
    const cross = M({ color: 0xff4d5e, roughness: .5 }); mesh(new T.BoxGeometry(.18, .02, .05), cross, 0, .14, 0, cs); mesh(new T.BoxGeometry(.05, .02, .18), cross, 0, .14, 0, cs);
    // wall health panel
    mesh(new T.BoxGeometry(3.4, 2.0, .14), M({ color: 0x151a28, roughness: .4, metalness: .8 }), 1.9, 2.75, bz + .05, scene);
    const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 600; pg = pc.getContext('2d'); ptex = new T.CanvasTexture(pc); ptex.encoding = T.sRGBEncoding; ptex.anisotropy = 4;
    const ps = new T.Mesh(new T.PlaneGeometry(3.2, 1.875), new T.MeshBasicMaterial({ map: ptex, toneMapped: false })); ps.position.set(1.9, 2.75, bz + .13); scene.add(ps);
    // emergency beacon
    ring = mesh(new T.TorusGeometry(.12, .02, 8, 24), new T.MeshStandardMaterial({ color: 0x300008, emissive: 0xff2040, emissiveIntensity: 0 }), 3.85, 3.95, bz + .1, scene);
    alertL = new T.PointLight(0xff2040, 0, 8); alertL.position.set(3.4, 3.6, -2.8); scene.add(alertL);
  }

  /* ---------- astronaut + face (opens the helmet to drink) ---------- */
  function astronaut() {
    A = B.makeAstronaut(scene, {}); body = A.body; body.position.set(-.7, 1.16, -.4); body.rotation.y = .25;
    face = new T.Group(); face.visible = false; body.add(face);
    skinMat = new T.MeshStandardMaterial({ color: 0xd9a583, roughness: .65, emissive: 0x000000 });
    const head = mesh(new T.SphereGeometry(.205, 28, 20), skinMat, 0, .89, 0, face); head.scale.set(1, 1.08, .95);
    mesh(new T.SphereGeometry(.21, 24, 14, 0, Math.PI * 2, 0, Math.PI * .45), M({ color: 0x2a1a10, roughness: .8 }), 0, .9, -.015, face);
    [-.07, .07].forEach(x => { mesh(new T.SphereGeometry(.022, 10, 8), M({ color: 0x15171d }), x, .93, .185, face); mesh(new T.BoxGeometry(.06, .012, .01), M({ color: 0x2a1a10 }), x, .968, .19, face); });
    mouthM = mesh(new T.SphereGeometry(.03, 12, 8), M({ color: 0x5a1a1a, roughness: .5 }), 0, .83, .195, face); mouthM.scale.set(1.5, .45, .5);
    bubble = new T.Mesh(new T.SphereGeometry(.3, 32, 24), new T.MeshStandardMaterial({ color: 0xdff1ff, transparent: true, opacity: .14, roughness: .05, metalness: .2, depthWrite: false })); bubble.position.y = .89; bubble.visible = false; body.add(bubble);
  }
  const helmet = open => { A.shell.visible = !open; A.visor.visible = !open; face.visible = open; bubble.visible = open; };

  /* ---------- props: capsule, water pouch, dumbbell ---------- */
  function props() {
    pillG = new T.Group(); scene.add(pillG);
    mesh(new T.CapsuleGeometry(.045, .12, 6, 14), new T.MeshStandardMaterial({ color: 0xff4d5e, roughness: .3, emissive: 0x551018, emissiveIntensity: .6 }), 0, 0, 0, pillG).rotation.z = Math.PI / 2;
    mesh(new T.CapsuleGeometry(.047, .05, 4, 12), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .3 }), .05, 0, 0, pillG).rotation.z = Math.PI / 2;
    hitPill = mesh(new T.SphereGeometry(.22, 8, 6), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 0, 0, 0, pillG);
    pouchG = new T.Group(); scene.add(pouchG);
    const pm = new T.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: .75, roughness: .15, metalness: .2, emissive: 0x0a4a9a, emissiveIntensity: .35 });
    const bag = mesh(new T.BoxGeometry(.2, .3, .07, 2, 4, 2), pm, 0, 0, 0, pouchG); bag.scale.set(1, 1, 1);
    mesh(new T.BoxGeometry(.21, .04, .075), M({ color: 0xdfe6f2, metalness: .5, roughness: .3 }), 0, .17, 0, pouchG);
    mesh(new T.CylinderGeometry(.012, .012, .2, 8), M({ color: 0xeef3fb, roughness: .3 }), 0, .27, 0, pouchG).rotation.z = .4;
    hitPouch = mesh(new T.SphereGeometry(.24, 8, 6), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 0, .05, 0, pouchG);
    dumbG = new T.Group(); scene.add(dumbG);
    const steel = M({ color: 0x9aa7c7, metalness: .9, roughness: .3 }), plate = M({ color: 0xe9eefc, roughness: .4 });
    mesh(new T.CylinderGeometry(.025, .025, .34, 12), steel, 0, 0, 0, dumbG).rotation.z = Math.PI / 2;
    [-.16, .16].forEach(x => mesh(new T.CylinderGeometry(.075, .075, .08, 16), plate, x, 0, 0, dumbG).rotation.z = Math.PI / 2);
    hitDumb = mesh(new T.SphereGeometry(.26, 8, 6), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 0, 0, 0, dumbG);
    pillG.scale.setScalar(1.7); pouchG.scale.setScalar(1.6); dumbG.scale.setScalar(1.5);
  }

  /* ---------- wall indicators ---------- */
  function drawPanel(d, t) {
    const g = pg, w = 1024, h = 600; g.fillStyle = '#04091a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4cc9f0'; g.font = 'bold 32px "Segoe UI",Arial'; g.fillText('HEALTH INDICATORS', 28, 46);
    const st = d.done ? ['RECOVERING', '#22C55E'] : d.crit ? ['CRITICAL', '#EF4444'] : ['ATTENTION', '#F59E0B']; g.fillStyle = st[1]; g.beginPath(); g.roundRect ? g.roundRect(700, 12, 296, 44, 22) : g.rect(700, 12, 296, 44); g.fill(); g.fillStyle = '#04091a'; g.font = 'bold 24px Arial'; g.textAlign = 'center'; g.fillText(st[0], 848, 43); g.textAlign = 'left';
    const row = (y, lab, val, unit, frac, col) => { g.fillStyle = '#9aa7c7'; g.font = '24px "Segoe UI",Arial'; g.fillText(lab, 28, y); g.fillStyle = '#fff'; g.font = 'bold 40px "Segoe UI",Arial'; g.fillText(val, 250, y + 2); g.fillStyle = '#9aa7c7'; g.font = '22px Arial'; g.fillText(unit, 250 + g.measureText(val).width + 40, y); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(560, y - 22, 420, 20); g.fillStyle = col; g.fillRect(560, y - 22, 420 * clamp(frac, 0, 1), 20); };
    const hrc = disp.hr > 100 || disp.hr < 50 ? '#EF4444' : '#22C55E', bpc = disp.sys > 140 ? '#F59E0B' : '#22C55E', spc = disp.spo2 < 95 ? '#F59E0B' : '#22C55E', stc = disp.stress > 6 ? '#F59E0B' : '#22C55E';
    row(130, 'Heart rate', String(Math.round(disp.hr)), 'bpm', disp.hr / 160, hrc);
    row(210, 'Blood pressure', Math.round(disp.sys) + '/' + Math.round(disp.dia), 'mmHg', disp.sys / 200, bpc);
    row(290, 'Oxygen', String(Math.round(disp.spo2)), '% SpO2', (disp.spo2 - 80) / 20, spc);
    row(370, 'Stress', String(Math.round(disp.stress)), '/ 10', disp.stress / 10, stc);
    // ECG line
    g.strokeStyle = hrc; g.lineWidth = 4; g.beginPath(); const beat = disp.hr / 60, irr = d.arr && !d.done;
    for (let x = 0; x <= 960; x += 4) { const u = ((x / 960) * 5 * (irr ? 1 + .35 * Math.sin(x / 90) : 1) + t * beat * .5) % 1; let y = 0; if (u > .1 && u < .16) y = -6; else if (u >= .24 && u < .27) y = -70; else if (u >= .27 && u < .3) y = 20; const py = 520 + y; x ? g.lineTo(28 + x, py) : g.moveTo(28 + x, py); }
    g.stroke(); g.fillStyle = '#9aa7c7'; g.font = '22px Arial'; g.fillText(d.msg || (d.done ? 'Treatment worked. Vital signs are improving.' : d.crit ? 'Critical: give the medicine.' : 'Attention: the astronaut needs exercise.'), 28, 582);
    ptex.needsUpdate = true;
  }

  /* ---------- sequences ---------- */
  api.play = function (kind) { if (act) return; act = { kind, t: 0 }; };
  api.wrong = function (kind) { shake = 1; };
  api.reset = function () { act = null; warm = 0; helmet(false); skinMat.emissive.setHex(0); pillG.visible = pouchG.visible = dumbG.visible = true; };
  const hand = (arm) => { body.updateMatrixWorld(true); return arm.localToWorld(V(0, -.5, .03)); };
  const mouth = () => { body.updateMatrixWorld(true); return body.localToWorld(V(0, .84, .27)); };

  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    const t = (now - t0) / 1000, dt = Math.min(.1, (now - (last || now)) / 1000); last = now; const d = getData() || {};
    // lights
    const w = ease(clamp(warm, 0, 1)); warm += (((d.done ? 1 : 0)) - warm) * Math.min(1, dt * 1.4);
    hemi.color.setRGB(lerp(.45, .85, w), lerp(.6, .82, w), lerp(1, .78, w)); hemi.intensity = lerp(.45, .9, w); key.intensity = lerp(1.0, 1.7, w); warmL.intensity = w * 2.2;
    const al = d.crit && !d.done ? (Math.sin(t * 5) > 0 ? 1 : .15) : 0; ring.material.emissiveIntensity = al * 2; alertL.intensity = al * .9;
    // indicators ease toward the real values
    ['hr', 'sys', 'dia', 'spo2', 'stress'].forEach(k => { if (d[k] != null) disp[k] += (d[k] - disp[k]) * Math.min(1, dt * 1.6); });
    // idle floating props
    const idle = (g, h, ph) => g.position.set(h.x + Math.sin(t * .8 + ph) * .04, h.y + Math.sin(t * 1.1 + ph) * .06, h.z + Math.cos(t * .7 + ph) * .03);
    if (!act || act.kind !== 'pill') { if (!(act && act.kind === 'pill')) { idle(pillG, home.pill, 0); pillG.rotation.set(t * .6, t * .8, 0); idle(pouchG, home.pouch, 1.3); pouchG.rotation.set(.2, Math.sin(t * .5) * .5, .1); } }
    if (!act || act.kind !== 'dumb') { idle(dumbG, home.dumb, 2.1); dumbG.rotation.set(0, t * .5, Math.sin(t * .7) * .2); }
    // pose
    let mood = d.done ? 1 : 0; const sad = (d.crit && !d.done) ? 1 : (d.done ? 0 : .5);
    A.shL.rotation.set(.12 * sad, 0, -.14); A.shR.rotation.set(.12 * sad, 0, .14); A.elL.rotation.set(-.2 - .3 * sad, 0, 0); A.elR.rotation.set(-.2 - .3 * sad, 0, 0);
    body.rotation.x = .12 * sad * (1 - w); body.rotation.y = .25; body.position.y = 1.16 + Math.sin(t * 1.1) * .006;
    if (shake > 0) { shake = Math.max(0, shake - dt * 1.2); body.rotation.y = .25 + Math.sin(t * 28) * .12 * shake; }
    mouthM.scale.set(1.5 + w * .5, .45 + w * .35, .5);
    if (act) {
      act.t += dt; const u = act.t;
      if (act.kind === 'pill') {
        helmet(u > .5 && u < 7.6);
        const cap = (p, a, b, k) => p.position.lerpVectors(a, b, ease(clamp(k, 0, 1)));
        // 0.5-2: capsule floats to the right hand; 2-3.2: hand to mouth; 3.2-3.5 swallow
        if (u < 2.0) { A.shR.rotation.set(lerp(.12, -1.1, ease(clamp((u - .5) / 1.3, 0, 1))), 0, .2); A.elR.rotation.set(-.4, 0, 0); cap(pillG, home.pill, hand(A.elR), (u - .4) / 1.5); }
        else if (u < 3.4) { const k = ease(clamp((u - 2.0) / 1.2, 0, 1)); A.shR.rotation.set(lerp(-1.1, -2.2, k), 0, .15); A.elR.rotation.set(lerp(-.4, -1.7, k), 0, 0); pillG.position.copy(hand(A.elR)); }
        else if (u < 3.8) { pillG.position.lerp(mouth(), .3); A.shR.rotation.set(-2.2, 0, .15); A.elR.rotation.set(-1.7, 0, 0); if (u > 3.6) pillG.visible = false; }
        else if (u < 5.8) { // water pouch to the left hand, then to the mouth: drink
          pillG.visible = false; A.shR.rotation.set(lerp(-2.2, .1, ease(clamp((u - 3.8) / .8, 0, 1))), 0, .15); A.elR.rotation.set(lerp(-1.7, -.3, ease(clamp((u - 3.8) / .8, 0, 1))), 0, 0);
          if (u < 4.9) { A.shL.rotation.set(lerp(.12, -1.1, ease(clamp((u - 3.8) / 1.0, 0, 1))), 0, -.2); A.elL.rotation.set(-.4, 0, 0); cap(pouchG, home.pouch, hand(A.elL), (u - 3.8) / 1.0); pouchG.rotation.set(.2, 0, 0); }
          else { const k = ease(clamp((u - 4.9) / .9, 0, 1)); A.shL.rotation.set(lerp(-1.1, -2.1, k), 0, -.15); A.elL.rotation.set(lerp(-.4, -1.8, k), 0, 0); pouchG.position.copy(hand(A.elL)).add(V(0, .05, .05)); pouchG.rotation.set(-.5 * k, 0, 0); }
        }
        else if (u < 7.6) { const k = ease(clamp((u - 5.8) / .8, 0, 1)); A.shL.rotation.set(lerp(-2.1, .1, k), 0, -.14); A.elL.rotation.set(lerp(-1.8, -.3, k), 0, 0); pouchG.position.lerpVectors(pouchG.position, home.pouch, .08);
          const glow = Math.max(0, 1 - (u - 5.8) / 1.8); skinMat.emissive.setRGB(.05 * glow, .4 * glow, .22 * glow); body.rotation.x = -.05; }
        else { helmet(false); skinMat.emissive.setHex(0); act = null; }
      } else {
        // dumbbell: a few biceps curls, then relief
        if (u < 1.2) { dumbG.position.lerpVectors(home.dumb, hand(A.elR), ease(clamp(u / 1.1, 0, 1))); A.shR.rotation.set(lerp(.12, -.5, clamp(u / 1.1, 0, 1)), 0, .2); }
        else if (u < 5.2) { const c = Math.sin((u - 1.2) * 4.2) * .5 + .5; A.shR.rotation.set(-.35, 0, .18); A.shL.rotation.set(-.35, 0, -.18); A.elR.rotation.set(-.2 - c * 1.8, 0, 0); A.elL.rotation.set(-.2 - c * 1.6, 0, 0); dumbG.position.copy(hand(A.elR)); dumbG.rotation.set(0, 0, 0); body.position.y = 1.16 + Math.sin((u - 1.2) * 4.2) * .02; }
        else if (u < 6.4) { dumbG.position.lerp(home.dumb, .1); const k = clamp((u - 5.2) / 1.2, 0, 1); A.shR.rotation.set(lerp(-.35, .1, k), 0, .15); A.elR.rotation.set(lerp(-.4, -.2, k), 0, 0); A.shL.rotation.set(lerp(-.35, .1, k), 0, -.15); A.elL.rotation.set(lerp(-.4, -.2, k), 0, 0); }
        else act = null;
      }
    }
    if (now - lastDraw > 66) { lastDraw = now; drawPanel(d, t); }
    earth.rotation.y = t * .01;
    cam.position.x = Math.sin(t * .2) * .2 + .4 + drag.yaw * .6; cam.position.y = camBase.y + Math.sin(t * .27) * .04; cam.lookAt(.4, 1.5, -1.6);
    R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H;
    const a = W / H, fov = cam.fov * Math.PI / 180, needH = 3.7, needW = clamp(a * 4.4, 4, 7.8);
    camBase.z = Math.max(needH / 2 / Math.tan(fov / 2), needW / 2 / (Math.tan(fov / 2) * a)) + .5; cam.position.z = camBase.z; cam.updateProjectionMatrix();
  }

  api.init = function (stageEl, opts) {
    if (api.ready) return true; stage = stageEl; opts = opts || {}; getData = opts.getData || getData; onUse = opts.onUse || onUse;
    try {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab'; stage.insertBefore(canvas, stage.firstChild);
      R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02040c); cam = new T.PerspectiveCamera(38, 1, .1, 400); cam.position.set(.4, camBase.y, camBase.z);
      const envS = new T.Scene(); envS.background = new T.Color(0x0a1226);
      [[6, 3, 0, 6, 0, 0xffffff, 5], [4, 4, -7, 2, 2, 0xcfe6ff, 4], [4, 2, 6, 1, -4, 0xffd9a0, 2.5], [8, 3, 0, -6, 0, 0x4cc9f0, 1.2], [5, 5, 0, 2, -8, 0x2b6fd6, 1.5]].forEach(([w, h, x, y, z, c, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); });
      const pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(envS, .02).texture; pm.dispose();
      hemi = new T.HemisphereLight(0x8fb4ff, 0x2a3a66, .5); scene.add(hemi);
      key = new T.DirectionalLight(0xdfeaff, 1.0); key.position.set(2.5, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const s = key.shadow.camera; s.left = -5; s.right = 5; s.top = 4; s.bottom = -2; s.near = 1; s.far = 22; key.shadow.bias = -.0004; key.target.position.set(.3, 1, -1.5); scene.add(key, key.target);
      const rim = new T.DirectionalLight(0x9fd0ff, .8); rim.position.set(-6, 3, -8); scene.add(rim);
      warmL = new T.PointLight(0xffb070, 0, 9); warmL.position.set(0, 2.6, -.5); scene.add(warmL);
      room(); astronaut(); props();
      const ray = new T.Raycaster(), mv = new T.Vector2(); let downX = 0, moved = 0;
      const setRay = e => { const r = canvas.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); };
      const pick = e => { if (act) return null; setRay(e); if (ray.intersectObject(hitPill, false).length || ray.intersectObject(hitPouch, false).length) return 'pill'; if (ray.intersectObject(hitDumb, false).length) return 'dumb'; return null; };
      const use = kind => { if (act || (getData() || {}).done) return; const ok = onUse(kind); if (ok) api.play(kind); else api.wrong(kind); };
      canvas.addEventListener('pointerdown', e => { drag.down = true; drag.x = downX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag.down) { canvas.style.cursor = pick(e) ? 'pointer' : 'grab'; return; } moved = Math.max(moved, Math.abs(e.clientX - downX)); canvas.style.cursor = 'grabbing'; drag.yaw = clamp(drag.yaw + (e.clientX - drag.x) * .008, -1.3, 1.3); drag.x = e.clientX; });
      canvas.addEventListener('pointerup', e => { const was = drag.down; drag.down = false; canvas.style.cursor = 'grab'; if (was && moved < 6) { const k = pick(e); if (k) use(k); } });
      canvas.addEventListener('pointercancel', () => { drag.down = false; });
      window.addEventListener('keydown', e => { if (!running) return; const t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA') return; if (e.key === 'p' || e.key === 'P') use('pill'); else if (e.key === 'd' || e.key === 'D') use('dumb'); });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D treatment scene unavailable, using the 2D scene instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false; }
  };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
})();
