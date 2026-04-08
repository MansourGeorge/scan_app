import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';

const NATIVE_BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'codabar'
];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const MAX_NATIVE_DETECT_ERRORS = 10;

const BarcodeScanner = ({ onScan, active = true }) => {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const refocusIntervalRef = useRef(null);
  const nativeDetectorRef = useRef(null);
  const nativeScanRafRef = useRef(null);
  const nativeScanLastTsRef = useRef(0);
  const nativeDetectBusyRef = useRef(false);
  const nativeErrorCountRef = useRef(0);
  const nativeFallbackTriggeredRef = useRef(false);
  const disableNativeDetectorRef = useRef(false);
  const detectionResetTimerRef = useRef(null);
  const startAttemptRef = useRef(0);
  const isIOSRef = useRef(false);
  const isInAppBrowserRef = useRef(false);

  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceIdx, setDeviceIdx] = useState(-1);
  const [detectedCode, setDetectedCode] = useState('');
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [manualStartRequired, setManualStartRequired] = useState(false);

  const buildReader = () => {
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR
    ]);
    const reader = new BrowserMultiFormatReader(hints, 300);
    reader.timeBetweenDecodingAttempts = 80;
    return reader;
  };

  const supportsCameraApis = () => (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );

  const hasSecureCameraContext = () => {
    if (typeof window === 'undefined') return true;
    if (window.isSecureContext) return true;
    return LOCAL_HOSTS.has(window.location.hostname);
  };

  const getPreferredDeviceIndex = (devList) => {
    if (!devList?.length) return -1;
    const labels = devList.map((d) => (d.label || '').toLowerCase());

    // Prefer "main/back" camera and avoid ultra-wide/telephoto when possible.
    let preferred = labels.findIndex((l) => /back|rear|environment/.test(l) && !/ultra|tele|zoom/.test(l));
    if (preferred >= 0) return preferred;

    preferred = labels.findIndex((l) => /back|rear|environment/.test(l));
    if (preferred >= 0) return preferred;

    return -1;
  };

  const getCameraErrorMessage = (err) => {
    const errorName = err?.name || '';
    const errorMessage = String(err?.message || '').toLowerCase();

    if (!hasSecureCameraContext() || errorMessage.includes('secure') || errorMessage.includes('https')) {
      return 'Camera requires HTTPS (or localhost). Open this page using https://';
    }
    if (isInAppBrowserRef.current) {
      return 'Camera support is limited in this in-app browser. Open the page in Safari/Chrome.';
    }
    if (/NotAllowedError|SecurityError/i.test(errorName)) {
      return 'Camera permission denied. Allow camera access, then try again.';
    }
    if (/NotFoundError|DevicesNotFoundError/i.test(errorName)) {
      return 'No camera was found on this device.';
    }
    if (/NotReadableError|TrackStartError|AbortError/i.test(errorName)) {
      return 'Camera is currently busy in another app. Close other apps and retry.';
    }
    if (/OverconstrainedError|ConstraintNotSatisfiedError/i.test(errorName)) {
      return 'Camera mode not supported on this device. Try again to use fallback mode.';
    }
    return err?.message || 'Unable to access camera on this device.';
  };

  const listVideoInputDevices = async () => {
    if (!supportsCameraApis() || typeof navigator.mediaDevices.enumerateDevices !== 'function') {
      return [];
    }

    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      return allDevices
        .filter((device) => device.kind === 'videoinput' || device.kind === 'video')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || '',
          kind: 'videoinput',
          groupId: device.groupId || ''
        }));
    } catch {
      return [];
    }
  };

  const updateDeviceList = async () => {
    const nextDevices = await listVideoInputDevices();
    setDevices(nextDevices);
    return nextDevices;
  };

  const getVideoConstraintCandidates = (deviceId) => {
    const selectors = deviceId
      ? [{ deviceId: { exact: deviceId } }, { deviceId: { ideal: deviceId } }]
      : [{ facingMode: { ideal: 'environment' } }, { facingMode: 'environment' }, {}];

    const resolutionPresets = [
      { width: { ideal: isIOSRef.current ? 1920 : 1280 }, height: { ideal: isIOSRef.current ? 1080 : 720 } },
      { width: { ideal: 1280 }, height: { ideal: 720 } },
      {}
    ];
    const fpsPresets = isIOSRef.current ? [{}] : [{ frameRate: { ideal: 24, max: 30 } }, {}];

    const candidates = [];
    const seen = new Set();

    selectors.forEach((selector) => {
      resolutionPresets.forEach((resolution) => {
        fpsPresets.forEach((fps) => {
          const candidate = { ...selector, ...resolution, ...fps };
          const key = JSON.stringify(candidate);
          if (!seen.has(key)) {
            seen.add(key);
            candidates.push(candidate);
          }
        });
      });
    });

    return candidates;
  };

  const acquireCameraStream = async (deviceId, allowGenericFallback = true) => {
    let lastError = null;
    const candidates = getVideoConstraintCandidates(deviceId);

    for (const video of candidates) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video, audio: false });
      } catch (err) {
        lastError = err;
      }
    }

    if (allowGenericFallback && deviceId) {
      return acquireCameraStream(null, false);
    }

    throw lastError || new Error('Camera access failed');
  };

  const attachStreamToVideo = async (stream, attemptId) => {
    const videoElement = videoRef.current;
    if (!videoElement || attemptId !== startAttemptRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }

    videoElement.setAttribute('playsinline', 'true');
    videoElement.muted = true;
    videoElement.autoplay = true;
    videoElement.srcObject = stream;

    try {
      await videoElement.play();
    } catch {
      // Some browsers delay playback until gesture; keep stream attached.
    }

    if (attemptId !== startAttemptRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }

    return true;
  };

  const markDetected = (value) => {
    setDetectedCode(value);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(35);
    }
    if (detectionResetTimerRef.current) clearTimeout(detectionResetTimerRef.current);
    detectionResetTimerRef.current = setTimeout(() => setDetectedCode(''), 1400);
  };

  const createNativeDetector = async () => {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
    const Detector = window.BarcodeDetector;
    let formats = [...NATIVE_BARCODE_FORMATS];

    try {
      if (typeof Detector.getSupportedFormats === 'function') {
        const supported = await Detector.getSupportedFormats();
        formats = NATIVE_BARCODE_FORMATS.filter((f) => supported.includes(f));
      }
    } catch {
      // Ignore capability read errors and try default format list.
    }

    if (!formats.length) return null;

    try {
      return new Detector({ formats });
    } catch {
      return null;
    }
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const normalizeCameraZoom = () => {
    try {
      const stream = videoRef.current?.srcObject;
      const track = stream?.getVideoTracks?.()[0];
      if (!track || typeof track.getCapabilities !== 'function') return;

      const caps = track.getCapabilities();
      const advanced = [];

      if (caps.zoom && typeof caps.zoom.min === 'number') {
        const min = caps.zoom.min;
        const max = caps.zoom.max;
        let targetZoom;

        if (isIOSRef.current) {
          // iOS can pick ultra-wide lens by default; nudging zoom near 2x often switches to the
          // main wide camera and improves barcode readability/focus.
          targetZoom = max >= 2 ? 2 : (max >= 1 ? 1 : min);
        } else {
          targetZoom = clamp(1, min, max);
        }

        advanced.push({ zoom: targetZoom });
      }

      if (Array.isArray(caps.focusMode)) {
        if (caps.focusMode.includes('continuous')) advanced.push({ focusMode: 'continuous' });
        else if (caps.focusMode.includes('auto')) advanced.push({ focusMode: 'auto' });
      }

      if (advanced.length && typeof track.applyConstraints === 'function') {
        track.applyConstraints({ advanced }).catch(() => {});
      }
    } catch {
      // Ignore browser/device-specific camera capability errors.
    }
  };

  const triggerRefocus = async () => {
    try {
      const stream = videoRef.current?.srcObject;
      const track = stream?.getVideoTracks?.()[0];
      if (!track || typeof track.getCapabilities !== 'function' || typeof track.applyConstraints !== 'function') return;

      const caps = track.getCapabilities();
      const advanced = [];

      if (Array.isArray(caps.focusMode)) {
        if (caps.focusMode.includes('continuous')) advanced.push({ focusMode: 'continuous' });
        else if (caps.focusMode.includes('single-shot')) advanced.push({ focusMode: 'single-shot' });
        else if (caps.focusMode.includes('auto')) advanced.push({ focusMode: 'auto' });
      }

      if (advanced.length) {
        await track.applyConstraints({ advanced });
      }
    } catch {
      // Ignore unsupported focus controls.
    }
  };

  const startRefocusLoop = () => {
    if (refocusIntervalRef.current) clearInterval(refocusIntervalRef.current);
    refocusIntervalRef.current = setInterval(() => {
      triggerRefocus();
    }, 1800);
  };

  const shouldTryNativeDetector = () => (
    !disableNativeDetectorRef.current &&
    !isIOSRef.current &&
    !isInAppBrowserRef.current
  );

  const startNativeScanner = async (devList, idx, attemptId) => {
    if (!videoRef.current) return false;
    const detector = nativeDetectorRef.current || await createNativeDetector();
    if (!detector) return false;
    nativeDetectorRef.current = detector;

    const chosenDevice = idx >= 0 ? devList?.[idx] : null;
    const deviceId = chosenDevice?.deviceId || null;
    const stream = await acquireCameraStream(deviceId);
    const attached = await attachStreamToVideo(stream, attemptId);
    if (!attached) return false;
    if (attemptId !== startAttemptRef.current) return false;

    setScanning(true);
    setError(null);
    setManualStartRequired(false);
    nativeScanLastTsRef.current = 0;
    nativeDetectBusyRef.current = false;
    nativeErrorCountRef.current = 0;
    nativeFallbackTriggeredRef.current = false;

    setTimeout(normalizeCameraZoom, 300);
    setTimeout(normalizeCameraZoom, 1000);
    setTimeout(triggerRefocus, 450);
    startRefocusLoop();
    updateDeviceList();

    const scanLoop = async (ts) => {
      if (attemptId !== startAttemptRef.current) return;
      nativeScanRafRef.current = requestAnimationFrame(scanLoop);

      if (!videoRef.current || videoRef.current.readyState < 2) return;
      if (ts - nativeScanLastTsRef.current < 120) return;
      if (nativeDetectBusyRef.current) return;

      nativeScanLastTsRef.current = ts;
      nativeDetectBusyRef.current = true;

      try {
        const results = await detector.detect(videoRef.current);
        if (Array.isArray(results) && results.length > 0) {
          const value = (results[0].rawValue || '').trim();
          if (value) {
            nativeErrorCountRef.current = 0;
            markDetected(value);
            onScan(value);
          }
        }
      } catch {
        nativeErrorCountRef.current += 1;

        if (
          nativeErrorCountRef.current >= MAX_NATIVE_DETECT_ERRORS &&
          !nativeFallbackTriggeredRef.current &&
          attemptId === startAttemptRef.current
        ) {
          nativeFallbackTriggeredRef.current = true;
          disableNativeDetectorRef.current = true;
          nativeDetectorRef.current = null;

          if (nativeScanRafRef.current) {
            cancelAnimationFrame(nativeScanRafRef.current);
            nativeScanRafRef.current = null;
          }

          if (videoRef.current?.srcObject) {
            const nativeStream = videoRef.current.srcObject;
            nativeStream.getTracks().forEach((track) => track.stop());
            videoRef.current.srcObject = null;
          }

          setScanning(false);
          startZxingScanner(devList, idx, attemptId).catch((fallbackErr) => {
            if (attemptId !== startAttemptRef.current) return;
            setError(getCameraErrorMessage(fallbackErr));
            setScanning(false);
          });
          return;
        }
      } finally {
        nativeDetectBusyRef.current = false;
      }
    };

    nativeScanRafRef.current = requestAnimationFrame(scanLoop);
    return true;
  };

  const startZxingScanner = async (devList, idx, attemptId) => {
    if (!videoRef.current) return;

    const reader = buildReader();
    readerRef.current = reader;
    const chosenDevice = idx >= 0 ? devList?.[idx] : null;
    const deviceId = chosenDevice?.deviceId || null;
    const stream = await acquireCameraStream(deviceId);
    const attached = await attachStreamToVideo(stream, attemptId);
    if (!attached) return;
    if (attemptId !== startAttemptRef.current) return;

    setScanning(true);
    setError(null);
    setManualStartRequired(false);
    updateDeviceList();

    const onDecode = (result, err) => {
      if (result) {
        const value = result.getText()?.trim();
        if (value) {
          markDetected(value);
          onScan(value);
        }
      }
      if (err && !(err instanceof NotFoundException)) {
        // Ignore continuous decode noise errors. NotFound is expected.
      }
    };

    setTimeout(normalizeCameraZoom, 350);
    setTimeout(normalizeCameraZoom, 1200);
    setTimeout(triggerRefocus, 450);
    startRefocusLoop();
    await reader.decodeFromStream(stream, videoRef.current, onDecode);
  };

  const stopScanner = (invalidateStart = true) => {
    if (invalidateStart) {
      startAttemptRef.current += 1;
    }
    readerRef.current?.reset();
    readerRef.current = null;
    nativeErrorCountRef.current = 0;
    nativeFallbackTriggeredRef.current = false;
    if (nativeScanRafRef.current) {
      cancelAnimationFrame(nativeScanRafRef.current);
      nativeScanRafRef.current = null;
    }
    if (refocusIntervalRef.current) {
      clearInterval(refocusIntervalRef.current);
      refocusIntervalRef.current = null;
    }
    if (detectionResetTimerRef.current) {
      clearTimeout(detectionResetTimerRef.current);
      detectionResetTimerRef.current = null;
    }
    setDetectedCode('');
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const startScanner = async (devList = [], idx = -1) => {
    if (!videoRef.current) return;
    if (!supportsCameraApis()) {
      setError('This browser does not support camera access.');
      setScanning(false);
      return;
    }
    if (!hasSecureCameraContext()) {
      setError('Camera requires HTTPS (or localhost). Open this page using https://');
      setScanning(false);
      return;
    }

    stopScanner(false);
    const attemptId = ++startAttemptRef.current;

    try {
      if (shouldTryNativeDetector()) {
        try {
          const nativeStarted = await startNativeScanner(devList, idx, attemptId);
          if (nativeStarted) return;
        } catch {
          // Fallback to ZXing scanner below.
        }
      }

      await startZxingScanner(devList, idx, attemptId);
    } catch (err) {
      if (attemptId !== startAttemptRef.current) return;
      setError(getCameraErrorMessage(err));
      setScanning(false);
    }
  };

  const initializeAndStartScanner = async () => {
    if (!active) return;
    if (!supportsCameraApis()) {
      setError('This browser does not support camera access.');
      return;
    }
    if (!hasSecureCameraContext()) {
      setError('Camera requires HTTPS (or localhost). Open this page using https://');
      return;
    }

    const devs = await updateDeviceList();
    const preferredIdx = getPreferredDeviceIndex(devs);
    setDeviceIdx(preferredIdx);
    await startScanner(devs, preferredIdx);
  };

  const handleManualStart = (event) => {
    event.stopPropagation();
    setManualStartRequired(false);
    initializeAndStartScanner();
  };

  const handleRetry = (event) => {
    event.stopPropagation();
    setError(null);
    setManualStartRequired(false);
    const preferredIdx = deviceIdx >= 0 ? deviceIdx : -1;
    startScanner(devices, preferredIdx);
  };

  const switchCamera = (event) => {
    event.stopPropagation();
    if (!devices.length) return;
    const current = deviceIdx >= 0 ? deviceIdx : 0;
    const next = (current + 1) % devices.length;
    setDeviceIdx(next);
    setManualStartRequired(false);
    startScanner(devices, next);
  };

  useEffect(() => {
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
    const inApp = /WhatsApp|FBAN|FBAV|Instagram/i.test(ua);
    setIsInAppBrowser(inApp);
    isInAppBrowserRef.current = inApp;
    isIOSRef.current = /iPad|iPhone|iPod/.test(ua) || (
      typeof navigator !== 'undefined' &&
      navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1
    );
  }, []);

  useEffect(() => {
    if (!active) {
      setManualStartRequired(false);
      stopScanner();
      return;
    }

    // iOS and in-app browsers are more reliable when start is triggered by a user gesture.
    if (isIOSRef.current || isInAppBrowserRef.current) {
      setManualStartRequired(true);
      setError(null);
      stopScanner(false);
      return () => stopScanner();
    }

    initializeAndStartScanner();

    return () => {
      stopScanner();
    };
  }, [active, isInAppBrowser]);

  return (
    <div className="camera-wrapper" onClick={() => triggerRefocus()}>
      <video ref={videoRef} muted playsInline autoPlay style={{ display: scanning ? 'block' : 'none' }} />
      {!scanning && !error && (
        <div className="camera-placeholder">
          <Camera size={36} />
          <span style={{ fontSize: '0.875rem' }}>
            {manualStartRequired ? 'Tap start to enable camera' : 'Initializing camera...'}
          </span>
          {manualStartRequired && (
            <button className="btn btn-secondary btn-sm" onClick={handleManualStart}>
              <Camera size={14} /> Start Camera
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="camera-placeholder">
          <CameraOff size={36} color="var(--accent3)" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--accent3)', textAlign: 'center', maxWidth: '240px' }}>{error}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleRetry}>
            <RefreshCw size={14} /> {isIOSRef.current ? 'Tap to Start Camera' : 'Retry'}
          </button>
        </div>
      )}
      {scanning && (
        <>
          <div className="camera-overlay">
            <div className="scan-frame">
              <span className="corner-br"></span>
              <span className="corner-bl"></span>
              <div className="scan-line" />
            </div>
          </div>
          <div className="camera-status">Point at barcode to scan</div>
          {isInAppBrowser && (
            <div className="camera-hint">If camera stays blurry, open this link in Safari/Chrome</div>
          )}
          <div className="camera-focus-hint">Tap preview to refocus</div>
          {detectedCode && (
            <div className="camera-detected">Detected: {detectedCode}</div>
          )}
        </>
      )}
      {scanning && devices.length > 1 && (
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={switchCamera}
          style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}
          title="Switch camera"
        >
          <RefreshCw size={14} color="white" />
        </button>
      )}
    </div>
  );
};

export default BarcodeScanner;
