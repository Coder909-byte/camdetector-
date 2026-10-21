/* ═══════════════════════════════════════════════════════════
   SCANNER — Webcam + BodyPix Skin / Clothes Detection
   ─────────────────────────────────────────────────────────
   Uses TensorFlow.js BodyPix to segment the torso, then
   counts skin-colored pixels in the torso region.
   High skin ratio → "caught" (no shirt)
   Low skin ratio  → "safe"  (shirt on)
   ═══════════════════════════════════════════════════════════ */

const Scanner = (() => {
  /* ────────────────────────────────────────────────────────
   * 🔧  TUNING KNOBS
   * Adjust SKIN_THRESHOLD to calibrate sensitivity.
   *   Higher value  → needs more visible skin to trigger "caught"
   *   Lower value   → triggers "caught" more easily
   * ──────────────────────────────────────────────────────── */
  const SKIN_THRESHOLD = 0.38; // 0.0–1.0 — fraction of torso pixels that are skin-colored

  // BodyPix torso part IDs (from their docs):
  //   12 = torso_front_left,  13 = torso_front_right
  //   (we skip back parts 14/15 since the user faces the camera)
  const TORSO_PART_IDS = [12, 13];

  // ── Internal state ──
  let bpModel = null;
  let videoEl = null;
  let analysisCanvas = null;
  let analysisCtx = null;
  let isRunning = false;
  let onPrediction = null;
  let loopTimer = null;

  /* ─────────────── INIT ─────────────── */
  async function init(callback) {
    onPrediction = callback;
    videoEl = document.getElementById('webcam');
    analysisCanvas = document.getElementById('webcam-canvas');
    analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });

    // Show the canvas (we'll draw into it for analysis)
    analysisCanvas.style.display = 'block';
    analysisCanvas.style.opacity = '0';       // invisible overlay
    analysisCanvas.style.pointerEvents = 'none';

    updateStatus('LOADING AI MODEL...');

    // Load BodyPix
    try {
      bpModel = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2,
      });
      console.log('[Scanner] BodyPix model loaded!');
    } catch (err) {
      console.error('[Scanner] BodyPix load failed:', err);
      updateStatus('⚠ MODEL LOAD FAILED');
      throw err;
    }

    // Start webcam
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      videoEl.srcObject = stream;
      await videoEl.play();

      // Match analysis canvas to video size
      videoEl.addEventListener('loadedmetadata', () => {
        analysisCanvas.width = videoEl.videoWidth;
        analysisCanvas.height = videoEl.videoHeight;
      });
      // Set immediately in case metadata already loaded
      if (videoEl.videoWidth) {
        analysisCanvas.width = videoEl.videoWidth;
        analysisCanvas.height = videoEl.videoHeight;
      }

      console.log('[Scanner] Webcam active.');
    } catch (err) {
      console.error('[Scanner] Webcam error:', err);
      updateStatus('⚠ CAMERA DENIED');
      throw err;
    }

    updateStatus('AI READY — PRESS START');
  }

  /* ─────────────── START / STOP ─────────────── */
  function start() {
    if (isRunning) return;
    isRunning = true;
    updateStatus('SCANNING...');
    loop();
  }

  function stop() {
    isRunning = false;
    if (loopTimer) clearTimeout(loopTimer);
    updateStatus('PAUSED');
  }

  /* ─────────────── MAIN DETECTION LOOP ─────────────── */
  async function loop() {
    if (!isRunning) return;

    try {
      // 1. Run BodyPix segmentation with part data
      const segmentation = await bpModel.segmentPersonParts(videoEl, {
        flipHorizontal: false,
        internalResolution: 'medium',
        segmentationThreshold: 0.55,
      });

      // 2. Draw current frame to analysis canvas
      analysisCtx.drawImage(videoEl, 0, 0, analysisCanvas.width, analysisCanvas.height);

      // 3. Get pixel data
      const imageData = analysisCtx.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
      const pixels = imageData.data; // RGBA flat array

      // 4. Count torso pixels and how many are skin-colored
      let torsoPixelCount = 0;
      let skinPixelCount = 0;

      const partData = segmentation.data; // Int32Array, one value per pixel (-1 = bg, 0-23 = part id)
      const w = analysisCanvas.width;
      const h = analysisCanvas.height;

      for (let i = 0; i < partData.length; i++) {
        const partId = partData[i];

        // Only look at torso front parts
        if (TORSO_PART_IDS.includes(partId)) {
          torsoPixelCount++;

          // Get the RGB values for this pixel
          const r = pixels[i * 4];
          const g = pixels[i * 4 + 1];
          const b = pixels[i * 4 + 2];

          if (isSkinColor(r, g, b)) {
            skinPixelCount++;
          }
        }
      }

      // 5. Calculate skin ratio
      let skinRatio = 0;
      if (torsoPixelCount > 50) { // need a minimum of torso pixels to be reliable
        skinRatio = skinPixelCount / torsoPixelCount;
      }

      // 6. Determine state
      const state = skinRatio > SKIN_THRESHOLD ? 'caught' : 'safe';
      const safeProb = 1 - skinRatio;
      const caughtProb = skinRatio;

      const predictions = [
        { className: 'Clothes On',  probability: safeProb },
        { className: 'Clothes Off', probability: caughtProb },
      ];

      // 7. Update UI bars
      updatePredBars(predictions);

      // 8. Update status with debug info
      if (torsoPixelCount < 50) {
        updateStatus('⏳ NO BODY DETECTED...');
      } else {
        const pct = Math.round(skinRatio * 100);
        updateStatus(state === 'safe'
          ? `SCANNING... SKIN: ${pct}%`
          : `⚠ HIGH SKIN: ${pct}%`);
      }

      // 9. Fire callback
      if (onPrediction && torsoPixelCount >= 50) {
        onPrediction(state, predictions);
      }

    } catch (err) {
      console.warn('[Scanner] Frame error:', err);
    }

    // ~4 fps — keeps it responsive without melting the GPU
    loopTimer = setTimeout(loop, 250);
  }

  /* ─────────────── SKIN COLOR DETECTION ─────────────── */
  // Uses a combination of RGB-ratio and YCbCr rules
  // Works across a wide range of skin tones
  function isSkinColor(r, g, b) {
    // Rule 1: Basic RGB ratio rules
    // Skin tends to have R > G > B, with enough distance
    if (r <= 60 || g <= 30) return false;  // too dark
    if (r < g || r < b) return false;       // R should dominate
    if (Math.abs(r - g) < 10 && b > g) return false; // grayish

    // Rule 2: Convert to YCbCr colorspace (more reliable for skin)
    const y  =  0.299 * r + 0.587 * g + 0.114 * b;
    const cb = -0.169 * r - 0.331 * g + 0.500 * b + 128;
    const cr =  0.500 * r - 0.419 * g - 0.081 * b + 128;

    // Skin cluster in YCbCr space (tuned for diverse skin tones)
    if (y < 60) return false;  // too dark to tell
    if (cb < 77 || cb > 127) return false;
    if (cr < 133 || cr > 180) return false;

    // Rule 3: HSV-ish hue check for red/orange/brown range
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    if (diff < 15) return false; // too gray / unsaturated

    return true;
  }

  /* ─────────────── UI HELPERS ─────────────── */
  function updateStatus(text) {
    const el = document.getElementById('scan-status-text');
    if (el) el.textContent = text;
  }

  function updatePredBars(predictions) {
    const fillA = document.getElementById('pred-a-fill');
    const fillB = document.getElementById('pred-b-fill');
    const pctA  = document.getElementById('pred-a-pct');
    const pctB  = document.getElementById('pred-b-pct');

    if (predictions[0]) {
      const p = Math.round(predictions[0].probability * 100);
      if (fillA) fillA.style.width = p + '%';
      if (pctA)  pctA.textContent = p + '%';
    }
    if (predictions[1]) {
      const p = Math.round(predictions[1].probability * 100);
      if (fillB) fillB.style.width = p + '%';
      if (pctB)  pctB.textContent = p + '%';
    }
  }

  /* ─────────────── PUBLIC API ─────────────── */
  return { init, start, stop };
})();
