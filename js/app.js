/* ═══════════════════════════════════════════════════════════
   APP.JS — Main Controller
   Ties together Scene, Scanner, and Animations
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── State ──
  let isStarted = false;
  let lastTriggeredState = null;
  let triggerCooldown = false;

  // ── DOM refs ──
  const startBtn = document.getElementById('start-btn');

  /* ─────────────── BOOT ─────────────── */
  window.addEventListener('DOMContentLoaded', () => {
    // 1. Init 3D background immediately
    SceneManager.init();

    // 2. Play intro UI animations
    Animations.playIntro();

    // 3. Setup start button
    startBtn.addEventListener('click', onStartClick);
  });

  /* ─────────────── START BUTTON ─────────────── */
  async function onStartClick() {
    if (isStarted) return;

    // Coin sound
    Animations.playTone('coin');

    // Button animation
    gsap.to(startBtn, {
      scale: 0.92,
      duration: 0.05,
      yoyo: true,
      repeat: 1,
      onComplete: async () => {
        // Change button text
        startBtn.querySelector('.btn-text').textContent = 'INITIALIZING...';
        startBtn.querySelector('.btn-icon').textContent = '⏳';
        startBtn.disabled = true;

        try {
          // Init scanner (webcam + model)
          await Scanner.init(onPrediction);

          // Hide button
          gsap.to(startBtn, {
            scale: 0,
            opacity: 0,
            duration: 0.4,
            ease: 'back.in(2)',
            onComplete: () => { startBtn.style.display = 'none'; }
          });

          // Start scanning loop
          isStarted = true;
          Scanner.start();

          // Update scan status
          document.getElementById('scan-status-text').textContent = 'SCANNING...';

        } catch (err) {
          console.error('[App] Failed to start:', err);
          startBtn.querySelector('.btn-text').textContent = 'CAMERA ERROR — RETRY';
          startBtn.querySelector('.btn-icon').textContent = '⚠️';
          startBtn.disabled = false;
        }
      }
    });
  }

  /* ─────────────── PREDICTION CALLBACK ─────────────── */
  function onPrediction(state, predictions) {
    if (triggerCooldown) return;

    // Only trigger on state CHANGE, and with cooldown to prevent spam
    if (state !== lastTriggeredState) {
      lastTriggeredState = state;
      triggerCooldown = true;

      Animations.triggerResult(state);

      // Cooldown: 3 seconds between state changes
      setTimeout(() => { triggerCooldown = false; }, 3000);
    }
  }

  /* ─────────────── KEYBOARD SHORTCUTS (for testing) ─────────────── */
  window.addEventListener('keydown', (e) => {
    // Press 1 for safe, 2 for caught (debug)
    if (e.key === '1') {
      lastTriggeredState = 'safe';
      Animations.triggerResult('safe');
    }
    if (e.key === '2') {
      lastTriggeredState = 'caught';
      Animations.triggerResult('caught');
    }
  });

})();

