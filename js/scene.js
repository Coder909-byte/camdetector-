/* ═══════════════════════════════════════════════════════════
   THREE.JS — Haunted 3D Background Scene
   Floating low-poly pumpkins, bats, ghosts, particles & fog
   ═══════════════════════════════════════════════════════════ */

const SceneManager = (() => {
  // ── State ──
  let scene, camera, renderer;
  let pumpkins = [], bats = [], ghosts = [], particles = [];
  let mouseX = 0, mouseY = 0;
  let clock;
  let speedMultiplier = 1.0; // bumped during "caught" state
  let glitchActive = false;
  let animFrameId;

  // ── Colors ──
  const COL = {
    slime:    0x39ff14,
    purple:   0x4b0082,
    orange:   0xff7518,
    red:      0xff2244,
    darkPurp: 0x1a0033,
    fog:      0x0d0015,
  };

  /* ─────────────────────── INIT ─────────────────────── */
  function init() {
    clock = new THREE.Clock();

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(COL.fog, 0.018);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0, 30);

    // Renderer — use the existing canvas
    const canvas = document.getElementById('bg-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(COL.fog);

    // Lights
    const ambient = new THREE.AmbientLight(0x220044, 0.6);
    scene.add(ambient);

    const pointPurple = new THREE.PointLight(COL.purple, 1.2, 100);
    pointPurple.position.set(-15, 10, 15);
    scene.add(pointPurple);

    const pointOrange = new THREE.PointLight(COL.orange, 0.8, 80);
    pointOrange.position.set(15, -5, 10);
    scene.add(pointOrange);

    const pointGreen = new THREE.PointLight(COL.slime, 0.4, 60);
    pointGreen.position.set(0, 15, 20);
    scene.add(pointGreen);

    // Build objects
    createPumpkins(10);
    createBats(8);
    createGhosts(5);
    createParticleField(300);
    createStars(200);

    // Events
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    // Go
    animate();
  }

  /* ─────────────── LOW-POLY PUMPKIN ─────────────── */
  function createPumpkins(count) {
    const geom = new THREE.SphereGeometry(1, 6, 5); // low-poly!
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshPhongMaterial({
        color: COL.orange,
        emissive: COL.orange,
        emissiveIntensity: 0.25,
        flatShading: true,
        shininess: 10,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.scale.set(
        0.5 + Math.random() * 1.0,
        0.4 + Math.random() * 0.7,
        0.5 + Math.random() * 1.0
      );

      // Spread them around
      mesh.position.set(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 30 - 10
      );

      // Store drift info
      mesh.userData = {
        baseY: mesh.position.y,
        speed: 0.3 + Math.random() * 0.6,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        phase: Math.random() * Math.PI * 2,
        amplitude: 0.5 + Math.random() * 1.5,
      };

      // Add a stem
      const stemGeom = new THREE.CylinderGeometry(0.06, 0.1, 0.35, 4);
      const stemMat = new THREE.MeshPhongMaterial({ color: 0x2d5a1e, flatShading: true });
      const stem = new THREE.Mesh(stemGeom, stemMat);
      stem.position.y = 0.6;
      mesh.add(stem);

      // Add simple face (emissive triangle eyes)
      const eyeGeom = new THREE.BufferGeometry();
      const eyeVerts = new Float32Array([
        -0.25, 0.15, 1.01,
        -0.1,  0.35, 1.01,
         0.05,  0.15, 1.01,
      ]);
      eyeGeom.setAttribute('position', new THREE.BufferAttribute(eyeVerts, 3));
      const eyeMat = new THREE.MeshBasicMaterial({ color: COL.slime, side: THREE.DoubleSide });
      const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
      mesh.add(eyeL);

      const eyeR = eyeL.clone();
      eyeR.position.x = 0.35;
      mesh.add(eyeR);

      scene.add(mesh);
      pumpkins.push(mesh);
    }
  }

  /* ─────────────── SIMPLE BATS ─────────────── */
  function createBats(count) {
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();

      // Body
      const bodyGeom = new THREE.SphereGeometry(0.2, 4, 3);
      const bodyMat = new THREE.MeshPhongMaterial({ color: 0x1a1a2e, flatShading: true, emissive: 0x110022, emissiveIntensity: 0.3 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      group.add(body);

      // Wings
      const wingGeom = new THREE.BufferGeometry();
      const wingVerts = new Float32Array([
        0, 0, 0,     0.8, 0.3, 0,    0.5, -0.2, 0,
        0, 0, 0,     0.5, -0.2, 0,   0.9, -0.1, 0,
      ]);
      wingGeom.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));
      wingGeom.computeVertexNormals();
      const wingMat = new THREE.MeshPhongMaterial({ color: 0x2a0044, flatShading: true, side: THREE.DoubleSide });

      const wingR = new THREE.Mesh(wingGeom, wingMat);
      wingR.userData.dir = 1;
      group.add(wingR);

      const wingL = new THREE.Mesh(wingGeom, wingMat.clone());
      wingL.scale.x = -1;
      wingL.userData.dir = -1;
      group.add(wingL);

      // Eyes
      const eyeGeom = new THREE.SphereGeometry(0.04, 3, 3);
      const eyeMat = new THREE.MeshBasicMaterial({ color: COL.red });
      const eL = new THREE.Mesh(eyeGeom, eyeMat);
      eL.position.set(-0.08, 0.06, 0.18);
      group.add(eL);
      const eR = eL.clone();
      eR.position.x = 0.08;
      group.add(eR);

      group.position.set(
        (Math.random() - 0.5) * 50,
        5 + Math.random() * 15,
        (Math.random() - 0.5) * 20 - 5
      );

      group.userData = {
        speed: 0.4 + Math.random() * 0.8,
        radius: 5 + Math.random() * 15,
        angleOffset: Math.random() * Math.PI * 2,
        baseY: group.position.y,
        wingR, wingL,
      };

      scene.add(group);
      bats.push(group);
    }
  }

  /* ─────────────── GHOSTS ─────────────── */
  function createGhosts(count) {
    for (let i = 0; i < count; i++) {
      const geom = new THREE.ConeGeometry(0.6, 1.4, 5);
      const mat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: 0x9b30ff,
        emissiveIntensity: 0.15,
        flatShading: true,
        transparent: true,
        opacity: 0.35 + Math.random() * 0.25,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = Math.PI; // flip

      mesh.position.set(
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 30,
        -15 + Math.random() * 10
      );

      mesh.userData = {
        baseY: mesh.position.y,
        baseX: mesh.position.x,
        speed: 0.2 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        amplitude: 1 + Math.random() * 3,
      };

      scene.add(mesh);
      ghosts.push(mesh);
    }
  }

  /* ─────────────── PARTICLE FIELD ─────────────── */
  function createParticleField(count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const colSlime = new THREE.Color(COL.slime);
    const colPurple = new THREE.Color(COL.purple);
    const colOrange = new THREE.Color(COL.orange);
    const palette = [colSlime, colPurple, colOrange];

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50 - 10;

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = 0.1 + Math.random() * 0.3;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geom, mat);
    scene.add(points);
    particles.push(points);
  }

  /* ─────────────── BACKGROUND STARS ─────────────── */
  function createStars(count) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 2] = -40 - Math.random() * 30;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });
    scene.add(new THREE.Points(geom, mat));
  }

  /* ─────────────── ANIMATE ─────────────── */
  function animate() {
    animFrameId = requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();
    const dt = clock.getDelta();
    const sp = speedMultiplier;

    // ── Mouse parallax on camera ──
    const targetCX = mouseX * 3;
    const targetCY = mouseY * 2;
    camera.position.x += (targetCX - camera.position.x) * 0.02;
    camera.position.y += (targetCY - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);

    // ── Pumpkins float ──
    pumpkins.forEach(p => {
      const d = p.userData;
      p.position.y = d.baseY + Math.sin(elapsed * d.speed * sp + d.phase) * d.amplitude;
      p.rotation.y += d.rotSpeed * sp;
      p.rotation.z = Math.sin(elapsed * d.speed * 0.5 + d.phase) * 0.1;
    });

    // ── Bats circle & flap ──
    bats.forEach(b => {
      const d = b.userData;
      const angle = elapsed * d.speed * sp + d.angleOffset;
      b.position.x = Math.cos(angle) * d.radius;
      b.position.z = Math.sin(angle) * d.radius * 0.5 - 5;
      b.position.y = d.baseY + Math.sin(elapsed * d.speed * 2) * 2;
      b.rotation.y = -angle + Math.PI * 0.5;

      // Wing flap
      const flapAngle = Math.sin(elapsed * 8 * sp) * 0.6;
      if (d.wingR) d.wingR.rotation.z = -flapAngle;
      if (d.wingL) d.wingL.rotation.z = flapAngle;
    });

    // ── Ghosts drift ──
    ghosts.forEach(g => {
      const d = g.userData;
      g.position.y = d.baseY + Math.sin(elapsed * d.speed * sp + d.phase) * d.amplitude;
      g.position.x = d.baseX + Math.cos(elapsed * d.speed * 0.5 * sp + d.phase) * 3;
      g.rotation.y = Math.sin(elapsed * 0.5) * 0.3;
    });

    // ── Particles rotate ──
    particles.forEach(p => {
      p.rotation.y += 0.0003 * sp;
      p.rotation.x += 0.0001 * sp;
    });

    // ── Glitch offset ──
    if (glitchActive) {
      camera.position.x += (Math.random() - 0.5) * 0.5;
      camera.position.y += (Math.random() - 0.5) * 0.5;
    }

    renderer.render(scene, camera);
  }

  /* ─────────────── EVENT HANDLERS ─────────────── */
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onMouseMove(e) {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
  }

  function onTouchMove(e) {
    if (e.touches.length > 0) {
      mouseX = (e.touches[0].clientX / window.innerWidth - 0.5) * 2;
      mouseY = -(e.touches[0].clientY / window.innerHeight - 0.5) * 2;
    }
  }

  /* ─────────────── PUBLIC API ─────────────── */
  function setSpeedMultiplier(val) { speedMultiplier = val; }
  function setGlitch(val)          { glitchActive = val; }

  function triggerCaughtBurst() {
    // Temporarily flash all pumpkins red
    pumpkins.forEach(p => {
      const orig = p.material.emissive.getHex();
      p.material.emissive.setHex(COL.red);
      p.material.emissiveIntensity = 0.8;
      setTimeout(() => {
        p.material.emissive.setHex(orig);
        p.material.emissiveIntensity = 0.25;
      }, 1500);
    });
  }

  function resetScene() {
    speedMultiplier = 1.0;
    glitchActive = false;
    pumpkins.forEach(p => {
      p.material.emissive.setHex(COL.orange);
      p.material.emissiveIntensity = 0.25;
    });
  }

  return { init, setSpeedMultiplier, setGlitch, triggerCaughtBurst, resetScene };
})();

