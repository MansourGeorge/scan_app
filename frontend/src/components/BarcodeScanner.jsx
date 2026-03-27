import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';

const BarcodeScanner = ({ onScan, active = true }) => {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceIdx, setDeviceIdx] = useState(0);

  const startScanner = async (devList, idx) => {
    if (!videoRef.current) return;
    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const deviceId = devList?.[idx]?.deviceId || undefined;
      setScanning(true);
      setError(null);
      await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
        if (result) {
          onScan(result.getText());
        }
        if (err && !(err instanceof NotFoundException)) {
          // ignore not found, it's expected while scanning
        }
      });
    } catch (e) {
      setError(e.message || 'Camera access denied');
      setScanning(false);
    }
  };

  const stopScanner = () => {
    readerRef.current?.reset();
    setScanning(false);
  };

  useEffect(() => {
    if (!active) { stopScanner(); return; }

    let cancelled = false;
    const deviceReader = new BrowserMultiFormatReader();

    const initScanner = async () => {
      try {
        const devs = await deviceReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(devs);
        await startScanner(devs, deviceIdx);
      } catch {
        if (cancelled) return;
        setDevices([]);
        await startScanner([], 0);
      }
    };

    initScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [active]);

  const switchCamera = () => {
    const next = (deviceIdx + 1) % devices.length;
    setDeviceIdx(next);
    stopScanner();
    setTimeout(() => startScanner(devices, next), 300);
  };

  return (
    <div className="camera-wrapper">
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
