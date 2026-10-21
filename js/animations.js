/* ═══════════════════════════════════════════════════════════
   GSAP ANIMATIONS — Game-like feedback for scanner states
   ═══════════════════════════════════════════════════════════ */

const Animations = (() => {
  // ── State tracking ──
  let currentState = null;
  let resultTimeline = null;
  let healthTween = null;
  let score = 0;
  let healthPct = 100;

  // ── Audio Context for 8-bit sounds ──
  let audioCtx = null;

  function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  /* ═══════════════ INTRO ANIMATIONS ═══════════════ */
  function playIntro() {
    const tl = gsap.timeline();

    // Title slam in
    tl.from('#main-title', {
      y: -80,
      opacity: 0,
      scale: 1.4,
      duration: 0.8,
      ease: 'elastic.out(1.2, 0.5)',
    });

    // HUD elements slide in
    tl.from('.hud-left, .hud-right', {
      x: (i) => i === 0 ? -60 : 60,
      opacity: 0,
      duration: 0.5,
      ease: 'power3.out',
      stagger: 0.1,
    }, '-=0.4');

    // Health bar
    tl.from('#health-bar-container', {
      y: -30,
      opacity: 0,
      scaleX: 0.3,
      duration: 0.5,
      ease: 'back.out(2)',
    }, '-=0.3');

    // Scanner frame
    tl.from('#scanner-frame', {
      y: 60,
      opacity: 0,
      scale: 0.8,
      duration: 0.7,
      ease: 'elastic.out(1, 0.6)',
    }, '-=0.3');

    // Start button bounce
    tl.from('#start-btn', {
      y: 40,
      opacity: 0,
      scale: 0,
      duration: 0.6,
      ease: 'elastic.out(1.2, 0.4)',
    }, '-=0.2');

    // Continuous pulsing on start button
    tl.to('#start-btn', {
      scale: 1.04,
      duration: 0.6,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    return tl;
  }

  /* ═══════════════ TRIGGER RESULT ═══════════════ */
  function triggerResult(state) {
    if (state === currentState) return; // no double-trigger
    currentState = state;

    // Kill previous timeline
    if (resultTimeline) resultTimeline.kill();

    // Remove old state classes
    document.getElementById('ui-overlay').classList.remove('state-safe', 'state-caught');

    if (state === 'safe') {
      triggerSafe();
    } else if (state === 'caught') {
      triggerCaught();
    }
  }

  /* ─────────────── SAFE STATE ─────────────── */
  function triggerSafe() {
    const overlay = document.getElementById('ui-overlay');
    overlay.classList.add('state-safe');

    // Scene reset
    SceneManager.setSpeedMultiplier(1.0);
    SceneManager.setGlitch(false);
    SceneManager.resetScene();

    // Result popup
    const popup = document.getElementById('result-popup');
    const icon = document.getElementById('result-icon');
    const title = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');

    icon.textContent = '';
    title.textContent = 'not a slut ';
    title.className = '';
    title.style.color = '#39ff14';
    title.style.textShadow = '0 0 20px #39ff14, 0 0 40px rgba(57,255,20,0.5)';
    subtitle.textContent = 'not a slut ';
    subtitle.style.color = '#39ff14';
    popup.style.borderColor = '#39ff14';

    resultTimeline = gsap.timeline();

    // Popup bounces in
    resultTimeline.to(popup, {
      scale: 1,
      opacity: 1,
      duration: 0.6,
      ease: 'elastic.out(1.3, 0.4)',
    });

    // Icon bounces
    resultTimeline.from(icon, {
      scale: 3,
      rotation: 720,
      duration: 0.5,
      ease: 'back.out(3)',
    }, '-=0.4');

    // Health goes up
    boostHealth(10);
    addScore(100);

    // 8-bit success sound
    playTone('safe');

    // Scan status update
    updateScanStatus('✓ CLEAR — SUBJECT IS SAFE');

    // Auto-hide popup after 2.5s
    resultTimeline.to(popup, {
      scale: 0,
      opacity: 0,
      duration: 0.3,
      ease: 'back.in(2)',
      delay: 2.0,
      onComplete: () => { currentState = null; }
    });
  }

  /* ─────────────── CAUGHT STATE ─────────────── */
  function triggerCaught() {
    const overlay = document.getElementById('ui-overlay');
    overlay.classList.add('state-caught');

    // Scene chaos!
    SceneManager.setSpeedMultiplier(3.5);
    SceneManager.setGlitch(true);
    SceneManager.triggerCaughtBurst();

    // Screen flash
    gsap.to('#screen-flash', {
      opacity: 0.6,
      duration: 0.08,
      yoyo: true,
      repeat: 5,
      ease: 'steps(1)',
    });

    // Result popup
    const popup = document.getElementById('result-popup');
    const icon = document.getElementById('result-icon');
    const title = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');

    icon.textContent = '';
    title.textContent = 'AHAH A SLUT!';
    title.className = 'glitch-text drip-text';
    title.style.color = '#ff2244';
    title.style.textShadow = '0 0 20px #ff2244, 0 0 40px rgba(255,34,68,0.6)';
    subtitle.textContent = 'AHAH A SLUT!';
    subtitle.style.color = '#ff2244';
    popup.style.borderColor = '#ff2244';

    resultTimeline = gsap.timeline();

    // Popup SMASHES in
    resultTimeline.to(popup, {
      scale: 1,
      opacity: 1,
      duration: 0.15,
      ease: 'power4.out',
    });

    // Shake the popup
    resultTimeline.to(popup, {
      x: 'random(-8, 8)',
      y: 'random(-5, 5)',
      duration: 0.05,
      repeat: 12,
      ease: 'steps(1)',
    }, '-=0.05');

    // Icon smash
    resultTimeline.from(icon, {
      scale: 8,
      opacity: 0,
      duration: 0.2,
      ease: 'power4.out',
    }, 0);

    // Health drain
    drainHealth(25);
    addScore(-50);

    // 8-bit alarm sound
    playTone('caught');

    // Scan status
    updateScanStatus('⚠ ALERT — THREAT DETECTED!');

    // Auto-hide popup & reset after 3s
    resultTimeline.to(popup, {
      scale: 0,
      opacity: 0,
      duration: 0.3,
      ease: 'back.in(2)',
      delay: 2.5,
      onComplete: () => {
        currentState = null;
        overlay.classList.remove('state-caught');
        SceneManager.setSpeedMultiplier(1.0);
        SceneManager.setGlitch(false);
        gsap.set(popup, { x: 0, y: 0 });
      }
    });
  }

  /* ═══════════════ HEALTH BAR ═══════════════ */
  function boostHealth(amount) {
    healthPct = Math.min(100, healthPct + amount);
    animateHealth();
  }

  function drainHealth(amount) {
    healthPct = Math.max(0, healthPct - amount);
    animateHealth();

    // Flash health bar red
    gsap.to('#health-bar-fill', {
      background: 'linear-gradient(90deg, #ff2244 0%, #ff5566 50%, #ff2244 100%)',
      duration: 0.1,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        document.getElementById('health-bar-fill').style.background = '';
      },
    });
  }

  function animateHealth() {
    gsap.to('#health-bar-fill', {
      width: healthPct + '%',
      duration: 0.5,
      ease: 'power2.out',
    });
    document.getElementById('health-text').textContent = healthPct + '%';
  }

  /* ═══════════════ SCORE ═══════════════ */
  function addScore(amount) {
    score = Math.max(0, score + amount);
    const display = document.getElementById('score-display');
    display.textContent = String(score).padStart(4, '0');

    // Bounce effect
    gsap.from(display, {
      scale: 1.5,
      duration: 0.3,
      ease: 'elastic.out(1, 0.5)',
      color: amount > 0 ? '#39ff14' : '#ff2244',
      onComplete: () => { display.style.color = ''; }
    });
  }

  /* ═══════════════ SCAN STATUS ═══════════════ */
  function updateScanStatus(text) {
    const el = document.getElementById('scan-status-text');
    if (!el) return;

    gsap.to(el, {
      opacity: 0,
      duration: 0.15,
      onComplete: () => {
        el.textContent = text;
        gsap.to(el, { opacity: 1, duration: 0.15 });
      }
    });
  }

  /* ═══════════════ 8-BIT SOUND FX ═══════════════ */
  function playTone(type) {
    try {
      const ctx = getAudio();
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.12, now);
      masterGain.connect(ctx.destination);

      if (type === 'safe') {
        // Cheerful ascending arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.15, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.15);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.15);
        });
      } else if (type === 'caught') {
        // Alarming descending buzz
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(150, now + 0.4);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.5);

        // Second buzz hit
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(200, now + 0.15);
        osc2.frequency.linearRampToValueAtTime(80, now + 0.5);
        gain2.gain.setValueAtTime(0.12, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.55);
      } else if (type === 'coin') {
        // Classic coin insert
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(988, now);        // B5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.08);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(1318.5, now + 0.08); // E6
        gain2.gain.setValueAtTime(0.15, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.3);
      }
    } catch (e) {
      // Audio not available — no problem
    }
  }

  /* ─────────────── PUBLIC API ─────────────── */
  return { playIntro, triggerResult, playTone };
})();

