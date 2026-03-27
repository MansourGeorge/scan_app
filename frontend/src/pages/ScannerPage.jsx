import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, X } from 'lucide-react';
import BarcodeScanner from '../components/BarcodeScanner';
import ProductResult from '../components/ProductResult';

const ScannerPage = () => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const lastScan = useRef('');
  const navigate = useNavigate();

  const lookupBarcode = useCallback(async (barcode) => {
    if (!barcode || barcode === lastScan.current) return;
    lastScan.current = barcode;
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.get(`/api/products/barcode/${encodeURIComponent(barcode)}`);
      setResult(res.data);
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Product not found', barcode });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const barcode = manualBarcode.trim();
    if (!barcode) return;
    const timer = setTimeout(() => {
      lastScan.current = '';
      lookupBarcode(barcode);
    }, 2000);
    return () => clearTimeout(timer);
  }, [manualBarcode, lookupBarcode]);

  const clearResult = () => {
    setResult(null);
    lastScan.current = '';
    setManualBarcode('');
  };

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <div className="header-brand">
          <div className="header-brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5v14M7 5v14M11 5v14M15 5v10M19 5v10M3 19h12M15 15h4"/>
            </svg>
          </div>
          ScanPro
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/login')}>
            <ShieldCheck size={14} />
            Admin
          </button>
        </div>
      </header>

      <div className="page-container">
        <div className="section-label">Live Scanner</div>
        <BarcodeScanner onScan={lookupBarcode} active={true} />

        <div className="divider" />

        <div className="section-label">Manual Entry</div>
        <form onSubmit={(e) => e.preventDefault()} className="manual-input-group">
          <input
            type="text"
            className="input"
            placeholder="Enter barcode (auto search in 2s)..."
            value={manualBarcode}
            onChange={e => setManualBarcode(e.target.value)}
          />
        </form>

        {(result || loading) && (
          <>
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div className="section-label" style={{ margin: 0 }}>Result</div>
              {result && <button className="btn btn-ghost btn-sm btn-icon" onClick={clearResult}><X size={14} /></button>}
            </div>
            <ProductResult result={result} loading={loading} showCost={false} />
          </>
        )}
      </div>
    </div>
  );
};

export default ScannerPage;
