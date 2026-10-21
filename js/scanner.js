/* ═══════════════════════════════════════════════════════════
   SCANNER — Webcam + Google BodyPix Detection
   ─────────────────────────────────────────────────────────
   Uses official Google BodyPix model (unblocked).
   Calculates skin ratio on the torso to determine exposure.
   ═══════════════════════════════════════════════════════════ */

const Scanner = (() => {
  const SKIN_THRESHOLD = 0.35; // Adjust this if it's too sensitive (0.0 to 1.0)
  const TORSO_PART_IDS = [12, 13];

  let bpModel = null;
  let videoEl = null;
  let analysisCanvas = null;
  let analysisCtx = null;
  let isRunning = false;
  let onPrediction = null;
  let loopTimer = null;

  async function init(callback) {

    if (typeof bodyPix === 'undefined') {
        alert("The AI model failed to download. Please check your connection.");
        updateStatus('⚠ NETWORK BLOCK');
        return; // This stops the app from crashing
    }
    onPrediction = callback;
    videoEl = document.getElementById('webcam');
    analysisCanvas = document.getElementById('webcam-canvas');
    analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });

    updateStatus('LOADING GOOGLE AI...');

    try {
      // Load Google's BodyPix model (Unblocked)
      bpModel = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2,
      });
      console.log('[Scanner] BodyPix model loaded!');
    } catch (err) {
      console.error('[Scanner] Model load failed:', err);
      updateStatus('⚠ MODEL LOAD FAILED');
      throw err;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      videoEl.srcObject = stream;
      await videoEl.play();

      videoEl.addEventListener('loadedmetadata', () => {
        analysisCanvas.width = videoEl.videoWidth;
        analysisCanvas.height = videoEl.videoHeight;
      });
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

  async function loop() {
    if (!isRunning) return;

    try {
      const segmentation = await bpModel.segmentPersonParts(videoEl, {
        flipHorizontal: false,
        internalResolution: 'medium',
        segmentationThreshold: 0.55,
      });

      analysisCtx.drawImage(videoEl, 0, 0, analysisCanvas.width, analysisCanvas.height);
      const imageData = analysisCtx.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
      const pixels = imageData.data;

      let torsoPixelCount = 0;
      let skinPixelCount = 0;
      const partData = segmentation.data;

      for (let i = 0; i < partData.length; i++) {
        const partId = partData[i];

        if (TORSO_PART_IDS.includes(partId)) {
          torsoPixelCount++;
          const r = pixels[i * 4];
          const g = pixels[(i * 4) + 1];
          const b = pixels[(i * 4) + 2];

          if (isSkinColor(r, g, b)) {
            skinPixelCount++;
          }
        }
      }

      let skinRatio = 0;
      if (torsoPixelCount > 50) {
        skinRatio = skinPixelCount / torsoPixelCount;
      }

      const state = skinRatio > SKIN_THRESHOLD ? 'caught' : 'safe';
      const caughtProb = skinRatio;
      const safeProb = 1 - skinRatio;

      const predictions = [
        { className: 'Clothes On',  probability: safeProb },
        { className: 'Clothes Off', probability: caughtProb },
      ];

      updatePredBars(predictions);

      if (torsoPixelCount < 50) {
        updateStatus('⏳ NO BODY DETECTED...');
      } else {
        const pct = Math.round(skinRatio * 100);
        updateStatus(state === 'safe'
          ? `SCANNING... SAFE`
          : `⚠ HIGH EXPOSURE: ${pct}%`);
      }

      if (onPrediction && torsoPixelCount >= 50) {
        onPrediction(state, predictions);
      }

    } catch (err) {
      console.warn('[Scanner] Frame error:', err);
    }

    loopTimer = setTimeout(loop, 250);
  }

  function isSkinColor(r, g, b) {
    if (r <= 60 || g <= 30) return false;
    if (r < g || r < b) return false;

    const y  =  0.299 * r + 0.587 * g + 0.114 * b;
    const cb = -0.169 * r - 0.331 * g + 0.500 * b + 128;
    const cr =  0.500 * r - 0.419 * g - 0.081 * b + 128;

    if (y < 60) return false;
    if (cb < 77 || cb > 127) return false;
    if (cr < 133 || cr > 180) return false;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if ((max - min) < 15) return false;

    return true;
  }

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

  return { init, start, stop };
})();