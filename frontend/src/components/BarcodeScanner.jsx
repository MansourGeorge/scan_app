import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';

const BarcodeScanner = ({ onScan, active = true }) => {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const refocusIntervalRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceIdx, setDeviceIdx] = useState(-1);
  const [detectedCode, setDetectedCode] = useState('');
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const detectionResetTimerRef = useRef(null);

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

  const markDetected = (value) => {
    setDetectedCode(value);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(35);
    }
    if (detectionResetTimerRef.current) clearTimeout(detectionResetTimerRef.current);
    detectionResetTimerRef.current = setTimeout(() => setDetectedCode(''), 1400);
  };

  const normalizeCameraZoom = () => {
    try {
      const stream = videoRef.current?.srcObject;
      const track = stream?.getVideoTracks?.()[0];
      if (!track || typeof track.getCapabilities !== 'function') return;

      const caps = track.getCapabilities();
      const advanced = [];

      if (caps.zoom && typeof caps.zoom.min === 'number') {
        // Force the lowest available zoom to avoid unwanted "zoomed" preview on some phones.
        const targetZoom = caps.zoom.min > 1 ? caps.zoom.min : 1;
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

      if (caps.focusDistance && typeof caps.focusDistance.min === 'number' && typeof caps.focusDistance.max === 'number') {
        const target = (caps.focusDistance.min + caps.focusDistance.max) / 2;
        advanced.push({ focusDistance: target });
      }

      if (advanced.length) {
        await track.applyConstraints({ advanced });
      }
    } catch {
      // Ignore unsupported focus controls.
    }
  };

  const getVideoConstraints = (deviceId) => ({
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 24, max: 30 },
      advanced: [
        { focusMode: 'continuous' }
      ]
    },
    audio: false
  });

  const startScanner = async (devList, idx) => {
    if (!videoRef.current) return;
    try {
      const reader = buildReader();
      readerRef.current = reader;
      const chosenDevice = idx >= 0 ? devList?.[idx] : null;
      const deviceId = chosenDevice?.deviceId || null;
      setScanning(true);
      setError(null);
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

      let decodePromise;
      try {
        decodePromise = reader.decodeFromConstraints(getVideoConstraints(deviceId), videoRef.current, onDecode);
      } catch {
        // Some browsers are strict with custom constraints; fallback to standard device decode.
        decodePromise = reader.decodeFromVideoDevice(deviceId, videoRef.current, onDecode);
      }
      setTimeout(normalizeCameraZoom, 350);
      setTimeout(normalizeCameraZoom, 1200);
      setTimeout(triggerRefocus, 450);
      if (refocusIntervalRef.current) clearInterval(refocusIntervalRef.current);
      // Keep nudging focus while scanning on phones that support it.
      refocusIntervalRef.current = setInterval(() => {
        triggerRefocus();
      }, 1800);
      await decodePromise;
    } catch (e) {
      try {
        // Final fallback for problematic devices: let browser pick any camera.
        const fallbackReader = buildReader();
        readerRef.current = fallbackReader;
        await fallbackReader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
          if (result) {
            const value = result.getText()?.trim();
            if (value) {
              markDetected(value);
              onScan(value);
            }
          }
          if (err && !(err instanceof NotFoundException)) {
            // Ignore expected scan-loop errors.
          }
        });
        setTimeout(normalizeCameraZoom, 350);
        setTimeout(triggerRefocus, 450);
        if (refocusIntervalRef.current) clearInterval(refocusIntervalRef.current);
        refocusIntervalRef.current = setInterval(() => {
          triggerRefocus();
        }, 1800);
      } catch (fallbackErr) {
        setError(fallbackErr.message || e.message || 'Camera access denied');
        setScanning(false);
      }
    }
  };

  const stopScanner = () => {
    readerRef.current?.reset();
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

  useEffect(() => {
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
    setIsInAppBrowser(/WhatsApp|FBAN|FBAV|Instagram/i.test(ua));
  }, []);

  useEffect(() => {
    if (!active) { stopScanner(); return; }

    let cancelled = false;
    const deviceReader = buildReader();

    const initScanner = async () => {
      try {
        const devs = await deviceReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(devs);
        const preferredIdx = getPreferredDeviceIndex(devs);
        setDeviceIdx(preferredIdx);
        await startScanner(devs, preferredIdx);
      } catch {
        if (cancelled) return;
        // Fallback to generic camera request.
        try {
          await startScanner([], -1);
        } catch (err) {
          setError(err?.message || 'Camera access denied');
        }
      }
    };

    initScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [active]);

  const switchCamera = () => {
    if (!devices.length) return;
    const current = deviceIdx >= 0 ? deviceIdx : 0;
    const next = (current + 1) % devices.length;
    setDeviceIdx(next);
    stopScanner();
    setTimeout(() => startScanner(devices, next), 250);
  };

  return (
    <div className="camera-wrapper" onClick={() => triggerRefocus()}>
      <video ref={videoRef} muted playsInline autoPlay style={{ display: scanning ? 'block' : 'none' }} />
      {!scanning && !error && (
        <div className="camera-placeholder">
          <Camera size={36} />
          <span style={{ fontSize: '0.875rem' }}>Initializing camera...</span>
        </div>
      )}
      {error && (
        <div className="camera-placeholder">
          <CameraOff size={36} color="var(--accent3)" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--accent3)', textAlign: 'center', maxWidth: '240px' }}>{error}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => startScanner(devices, deviceIdx)}>
            <RefreshCw size={14} /> Retry
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
