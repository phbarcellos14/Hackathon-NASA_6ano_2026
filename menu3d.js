/* First screen in 3D (Three.js r149): a realistic Earth (continents, clouds, atmosphere glow, day/night light), the Moon,
   a spaceship orbiting with an engine flame and trail, shooting stars and a starfield. Needs cabin3d.js (shared kit) only for the canvas helper.
   API: Menu3d.init(stageEl) · start() · stop() */
(function () {
  'use strict';
  const T = window.THREE, C = window.Cabin3D;
  const api = { ready: false, failed: false };
  window.Menu3d = api;
  if (!T || !C || !C.kit) { api.failed = true; return; }
  const K = C.kit, ctex = K.ctex, clamp = K.clamp;
  const rnd = (a, b) => a + Math.random() * (b - a);

  let R, scene, cam, stage, canvas, W = 1, H = 1, running = false, raf = 0, t0 = performance.now(), last = 0;
  let earthG, earth, clouds, ship, flame, glow, moon, passing, trail, trailPts = [], ptr = { x: 0, y: 0 }, camPt = { x: 0, y: 0 };
  const ORBIT = { r: 2.55, incl: .42, speed: .32 };
  const PASS = 170;

  /* ---------- textures ---------- */
  function earthTexture() {
    return ctex(2048, 1024, (c, w, h) => {
      const og = c.createLinearGradient(0, 0, 0, h); og.addColorStop(0, '#0e4a8f'); og.addColorStop(.5, '#1668b8'); og.addColorStop(1, '#0e4a8f'); c.fillStyle = og; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) { c.fillStyle = 'rgba(120,190,255,' + rnd(.02, .07) + ')'; c.beginPath(); c.arc(rnd(0, w), rnd(0, h), rnd(2, 14), 0, 7); c.fill(); }
      // [centerX, centerY, radiusX, radiusY] in 0..1 (rough real-world layout)
      const land = [[.17, .3, .1, .12], [.215, .47, .035, .06], [.275, .68, .055, .16], [.31, .13, .035, .06], [.5, .26, .055, .055], [.53, .52, .075, .16], [.69, .3, .15, .1], [.655, .46, .03, .06], [.77, .5, .045, .045], [.84, .72, .055, .055], [.5, .965, .5, .04]];
      const desert = [[.51, .4, .04, .035], [.59, .41, .03, .04], [.83, .72, .03, .03], [.2, .33, .025, .03]];
      c.shadowColor = '#5cc0ff'; c.shadowBlur = 22;
      land.forEach(([cx, cy, rx, ry], k) => {
        for (let i = 0; i < 46; i++) {
          const x = (cx + rnd(-rx, rx) * .85) * w, y = (cy + rnd(-ry, ry) * .85) * h, lat = Math.abs(cy - .5) * 2, base = lat > .78 ? '#e8f0f4' : lat > .62 ? '#8a9a78' : lat < .22 ? '#2c7d3a' : '#4d9944';
          c.fillStyle = base; c.beginPath(); c.ellipse(x, y, rnd(.2, .55) * rx * w * .5, rnd(.2, .55) * ry * h * .6, rnd(0, 3), 0, 7); c.fill();
        }
      });
      c.shadowBlur = 0;
      desert.forEach(([cx, cy, rx, ry]) => { for (let i = 0; i < 26; i++) { c.fillStyle = 'rgba(205,168,98,' + rnd(.35, .7) + ')'; c.beginPath(); c.ellipse((cx + rnd(-rx, rx)) * w, (cy + rnd(-ry, ry)) * h, rnd(8, 34), rnd(6, 22), rnd(0, 3), 0, 7); c.fill(); } });
      for (let i = 0; i < 1800; i++) { c.fillStyle = 'rgba(20,60,30,' + rnd(.03, .1) + ')'; c.fillRect(rnd(0, w), rnd(0, h), rnd(2, 7), rnd(2, 5)); }
      c.fillStyle = 'rgba(240,248,255,.95)'; c.fillRect(0, 0, w, 26); c.fillRect(0, h - 40, w, 40);
    });
  }
  function cloudTexture() {
    return ctex(1024, 512, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { const x = rnd(0, w), y = rnd(30, h - 30), r = rnd(14, 60), g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,' + rnd(.18, .42) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r * 1.8, r * .7, rnd(-.3, .3), 0, 7); c.fill(); }
    });
  }
  function moonTexture() {
    return ctex(512, 256, (c, w, h) => {
      c.fillStyle = '#9b9b96'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) { c.fillStyle = 'rgba(' + (rnd(0, 1) < .5 ? '60,60,58' : '210,210,205') + ',' + rnd(.04, .15) + ')'; c.beginPath(); c.arc(rnd(0, w), rnd(0, h), rnd(2, 12), 0, 7); c.fill(); }
      for (let i = 0; i < 30; i++) { const x = rnd(0, w), y = rnd(0, h), r = rnd(6, 26), g = c.createRadialGradient(x, y, r * .2, x, y, r); g.addColorStop(0, 'rgba(50,50,48,.55)'); g.addColorStop(.85, 'rgba(50,50,48,.15)'); g.addColorStop(1, 'rgba(230,230,225,.35)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    });
  }
  function glowSprite(col) {
    return ctex(128, 128, (c, w, h) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, col); g.addColorStop(.35, col.replace('1)', '.4)')); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  }

  /* ---------- the spaceship ---------- */
  function buildShip() {
    const g = new T.Group(), M = K.M;
    const white = M({ color: 0xf1f3f8, roughness: .4, metalness: .35 }), foil = M({ color: 0xd9a43a, roughness: .3, metalness: .9 }), metal = M({ color: 0xaab2c4, roughness: .3, metalness: .85 }), dark = M({ color: 0x20242f, roughness: .6 }), red = M({ color: 0xff4d5e, roughness: .5 });
    const add = (geo, mat, x, y, z, rz) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (rz) m.rotation.z = rz; g.add(m); return m; };
    add(new T.CylinderGeometry(.2, .75, .95, 32), white, 1.35, 0, 0, -Math.PI / 2); add(new T.CylinderGeometry(.75, .75, .08, 32), dark, .85, 0, 0, -Math.PI / 2);
    add(new T.CylinderGeometry(.74, .74, 1.4, 32), metal, .1, 0, 0, Math.PI / 2); add(new T.CylinderGeometry(.76, .76, .38, 32), foil, .1, 0, 0, Math.PI / 2);
    add(new T.ConeGeometry(.42, .7, 24, 1, true), M({ color: 0x555b6a, metalness: .9, roughness: .3, side: T.DoubleSide }), -.95, 0, 0, Math.PI / 2);
    const win = add(new T.SphereGeometry(.17, 16, 12), M({ color: 0x7fdcff, roughness: .1, metalness: .3, emissive: 0x1a4a70 }), 1.2, .38, 0); win.scale.set(1, .8, 1);
    const sol = ctex(256, 128, (c, w, h) => { c.fillStyle = '#0d2a63'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3d6fc4'; c.lineWidth = 2; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, h); c.stroke(); } for (let j = 0; j <= 4; j++) { c.beginPath(); c.moveTo(0, j * 32); c.lineTo(w, j * 32); c.stroke(); } });
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(a => { const arm = new T.Group(); arm.rotation.x = a; g.add(arm); const b = new T.Mesh(new T.CylinderGeometry(.04, .04, 1.1, 8), metal); b.position.set(.3, .95, 0); arm.add(b); const p = new T.Mesh(new T.BoxGeometry(.7, 2.0, .03), new T.MeshStandardMaterial({ map: sol, roughness: .35, metalness: .6, emissive: 0x0a1e4a, emissiveIntensity: .45 })); p.position.set(.3, 2.0, 0); arm.add(p); });
    add(new T.SphereGeometry(.06, 8, 6), new T.MeshBasicMaterial({ color: 0xff3040 }), .1, .8, 0);
    flame = new T.Mesh(new T.ConeGeometry(.3, 1.6, 16, 1, true), new T.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: .75, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); flame.rotation.z = Math.PI / 2; flame.position.set(-1.7, 0, 0); g.add(flame);
    glow = new T.Sprite(new T.SpriteMaterial({ map: glowSprite('rgba(120,200,255,1)'), blending: T.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.set(1.8, 1.8, 1); glow.position.set(-1.2, 0, 0); g.add(glow);
    g.scale.setScalar(.26); return g;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame); if (!running) { last = now; return; }
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    earth.rotation.y = t * .06; clouds.rotation.y = t * .075; moon.position.set(Math.cos(t * .08) * 5.2, Math.sin(t * .08) * .6 + .4, Math.sin(t * .08) * 3.4 - 1.5); moon.rotation.y = t * .03;
    // ship on an inclined orbit, facing its direction of travel, with a glowing trail
    const a = t * ORBIT.speed, pos = (ang) => new T.Vector3(Math.cos(ang) * ORBIT.r * 1.12, Math.sin(ang) * ORBIT.r * Math.sin(ORBIT.incl) * .9, Math.sin(ang) * ORBIT.r * Math.cos(ORBIT.incl));
    const p = pos(a), q = pos(a + .02); ship.position.copy(p); ship.up.set(0, 1, 0); ship.lookAt(q); ship.rotateY(-Math.PI / 2); ship.rotation.z += Math.sin(t * .6) * .02;
    flame.scale.set(1 + Math.sin(t * 40) * .1, 1 + Math.sin(t * 31) * .15, 1); glow.material.opacity = .75 + Math.sin(t * 25) * .15;
    // smooth arc sampled from the orbit itself (frame-rate independent, no corners)
    const tp = trail.geometry.attributes.position; for (let i = 0; i < 70; i++) { const v = pos(a - i * .05); tp.setXYZ(i, v.x, v.y, v.z); } tp.needsUpdate = true;
    // shooting stars rush towards the camera
    const pp = passing.geometry.attributes.position; for (let i = 0; i < PASS; i++) { let z = pp.getZ(i) + dt * (6 + (i % 7)); if (z > 6) { z = -40; pp.setX(i, rnd(-14, 14)); pp.setY(i, rnd(-8, 8)); } pp.setZ(i, z); } pp.needsUpdate = true;
    camPt.x += (ptr.x - camPt.x) * .04; camPt.y += (ptr.y - camPt.y) * .04; cam.position.x = camPt.x * .6; cam.position.y = camPt.y * .4 + .3 + Math.sin(t * .2) * .05; cam.lookAt(earthG.position.x * .45, earthG.position.y * .6, 0);
    R.render(scene, cam);
  }
  function resize() {
    W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight); R.setSize(W, H, false); cam.aspect = W / H; const a = W / H;
    cam.position.z = a < .8 ? 11 : a < 1.2 ? 9.2 : 8.4; earthG.position.set(a >= 1.3 ? 2.6 : 0, a < .8 ? 2.1 : a < 1.2 ? 1.1 : a >= 1.3 ? .0 : .2, 0); cam.updateProjectionMatrix();
  }

  api.init = function (stageEl) {
    if (api.ready) return true; stage = stageEl;
    try {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; stage.appendChild(canvas);
      R = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.15; R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      scene = new T.Scene(); scene.background = new T.Color(0x02030a); cam = new T.PerspectiveCamera(40, 1, .1, 300); cam.position.set(0, .3, 6.2);
      scene.add(new T.AmbientLight(0x6a7aa8, .35)); const sun = new T.DirectionalLight(0xfff1dc, 2.4); sun.position.set(5, 2.5, 4); scene.add(sun); const rim = new T.DirectionalLight(0x6fa8ff, .6); rim.position.set(-5, -1, -3); scene.add(rim);
      earthG = new T.Group(); scene.add(earthG);
      earth = new T.Mesh(new T.SphereGeometry(1.6, 96, 64), new T.MeshStandardMaterial({ map: earthTexture(), roughness: .85, metalness: 0, emissive: 0x03122a, emissiveIntensity: .6 })); earthG.add(earth);
      clouds = new T.Mesh(new T.SphereGeometry(1.64, 80, 56), new T.MeshStandardMaterial({ map: cloudTexture(), transparent: true, opacity: .9, depthWrite: false, roughness: 1 })); earthG.add(clouds);
      const atm = new T.Mesh(new T.SphereGeometry(1.86, 64, 48), new T.ShaderMaterial({ transparent: true, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false, vertexShader: 'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying vec3 vN;void main(){float i=pow(0.68-dot(vN,vec3(0.0,0.0,1.0)),3.2);gl_FragColor=vec4(0.28,0.62,1.0,1.0)*i*1.9;}' })); earthG.add(atm);
      const inner = new T.Mesh(new T.SphereGeometry(1.67, 64, 48), new T.ShaderMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false, vertexShader: 'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying vec3 vN;void main(){float i=pow(1.0-abs(dot(vN,vec3(0.0,0.0,1.0))),3.0);gl_FragColor=vec4(0.35,0.65,1.0,1.0)*i*.55;}' })); earthG.add(inner);
      moon = new T.Mesh(new T.SphereGeometry(.34, 40, 28), new T.MeshStandardMaterial({ map: moonTexture(), roughness: 1 })); scene.add(moon);
      const oc = []; for (let i = 0; i <= 120; i++) { const ang = i / 120 * Math.PI * 2; oc.push(new T.Vector3(Math.cos(ang) * ORBIT.r * 1.12, Math.sin(ang) * ORBIT.r * Math.sin(ORBIT.incl) * .9, Math.sin(ang) * ORBIT.r * Math.cos(ORBIT.incl))); }
      const ring = new T.Line(new T.BufferGeometry().setFromPoints(oc), new T.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: .28 })); earthG.add(ring);
      ship = buildShip(); scene.add(ship);
      const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(new Float32Array(70 * 3), 3)); trail = new T.Line(tg, new T.LineBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: .55, blending: T.AdditiveBlending })); trail.frustumCulled = false; scene.add(trail);
      const sg = new T.BufferGeometry(), n = 1500, sp = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const th = rnd(0, 6.283), ph = Math.acos(rnd(-1, 1)); sp[i * 3] = 120 * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = 120 * Math.cos(ph); sp[i * 3 + 2] = 120 * Math.sin(ph) * Math.sin(th); }
      sg.setAttribute('position', new T.BufferAttribute(sp, 3)); scene.add(new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false })));
      const pg = new T.BufferGeometry(), pa = new Float32Array(PASS * 3); for (let i = 0; i < PASS; i++) { pa[i * 3] = rnd(-14, 14); pa[i * 3 + 1] = rnd(-8, 8); pa[i * 3 + 2] = rnd(-40, 6); }
      pg.setAttribute('position', new T.BufferAttribute(pa, 3)); passing = new T.Points(pg, new T.PointsMaterial({ color: 0xbfe6ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: .8 })); scene.add(passing);
      stage.addEventListener('pointermove', e => { const r = stage.getBoundingClientRect(); ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1; ptr.y = -(((e.clientY - r.top) / r.height) * 2 - 1); });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      resize(); raf = requestAnimationFrame(frame); api.ready = true; return true;
    } catch (e) { console.warn('3D menu unavailable, using the CSS Earth instead:', e); api.failed = true; if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); return false; }
  };
  api.start = function () { running = true; if (api.ready) resize(); };
  api.stop = function () { running = false; };
})();
