import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  LogOut, X, Upload, FileSpreadsheet,
  CheckCircle, AlertCircle, User, KeyRound, Eye, EyeOff, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BarcodeScanner from '../components/BarcodeScanner';
import ProductResult from '../components/ProductResult';

const ChangePasswordModal = ({ admin, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.'); return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.'); return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.'); return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from the current password.'); return;
    }
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/change-password',
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${admin.token}` } }
      );
      setSuccess(res.data.message);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '400px',
        boxShadow: 'var(--shadow)', animation: 'fadeSlideIn 0.2s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(123,94,167,0.2))',
              border: '1px solid rgba(0,212,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)'
            }}>
              <KeyRound size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>Change Password</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>Update your admin credentials</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} disabled={loading}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="error-msg" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {success && (
          <div className="success-msg" style={{ marginBottom: '1rem' }}>
            <CheckCircle size={14} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {[
            { label: 'Current Password', value: currentPassword, set: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(p => !p), icon: showCurrent },
            { label: 'New Password', value: newPassword, set: setNewPassword, show: showNew, toggle: () => setShowNew(p => !p) },
            { label: 'Confirm New Password', value: confirmPassword, set: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(p => !p) },
          ].map(({ label, value, set, show, toggle }) => (
            <div className="form-group" key={label}>
              <label className="form-label"><Lock size={11} /> {label}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={show ? 'text' : 'password'}
                  className="input-full"
                  placeholder={`Enter ${label.toLowerCase()}`}
                  value={value}
                  onChange={e => set(e.target.value)}
                  disabled={loading}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={toggle}
                  disabled={loading}
                  style={{
                    position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                    padding: '0.2rem', display: 'flex', alignItems: 'center'
                  }}
                >
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
              {loading ? <><div className="spinner" /> Saving...</> : <><KeyRound size={14} /> Update</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const fileInputRef = useRef(null);
  const lastScan = useRef('');

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const lookupBarcode = useCallback(async (barcode) => {
    if (!barcode || barcode === lastScan.current) return;
    lastScan.current = barcode;
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.get(`/api/products/admin/barcode/${encodeURIComponent(barcode)}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      setResult(res.data);
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Product not found', barcode });
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    const barcode = manualBarcode.trim();
    if (!barcode) return;
    const timer = setTimeout(() => {
      lastScan.current = '';
      lookupBarcode(barcode);
    }, 250);
    return () => clearTimeout(timer);
  }, [manualBarcode, lookupBarcode]);

  const clearResult = () => {
    setResult(null);
    lastScan.current = '';
    setManualBarcode('');
  };

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setImportError('Only .xlsx and .xls files are supported.');
      return;
    }
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('/api/products/admin/import', formData, {
        headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(res.data);
    } catch (err) {
      setImportError(err.response?.data?.error || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  return (
    <div className="app-wrapper">
      {showPasswordModal && <ChangePasswordModal admin={admin} onClose={() => setShowPasswordModal(false)} />}
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
          <span className="admin-badge"><User size={10} /> {admin?.username}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPasswordModal(true)} title="Change Password">
            <KeyRound size={14} />
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <div className="page-container page-container-wide">
        {/* Scanner section */}
        <div className="section-label">Admin Scanner</div>
        <BarcodeScanner onScan={lookupBarcode} active={true} />

        <div className="divider" />

        <div className="section-label">Manual Entry</div>
        <form onSubmit={(e) => e.preventDefault()} className="manual-input-group">
          <input
            type="text"
            className="input"
            placeholder="Enter barcode (auto search)..."
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
            <ProductResult result={result} loading={loading} showCost={true} />
          </>
        )}

        <div className="divider" />

        {/* Import section */}
        <div className="section-label">Import Products</div>

        {importError && (
          <div className="error-msg" style={{ marginBottom: '0.75rem' }}>
            <AlertCircle size={14} /> {importError}
          </div>
        )}

        {importResult && (
          <div className="success-msg" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={14} /> {importResult.message}
            </div>
            <div className="import-stats">
              <div className="stat-box">
                <div className="stat-num added">{importResult.added}</div>
                <div className="stat-label">Added</div>
              </div>
              <div className="stat-box">
                <div className="stat-num updated">{importResult.updated}</div>
                <div className="stat-label">Updated</div>
              </div>
              <div className="stat-box">
                <div className="stat-num">{importResult.skipped}</div>
                <div className="stat-label">Skipped</div>
              </div>
              <div className="stat-box">
                <div className="stat-num errors">{importResult.errors}</div>
                <div className="stat-label">Errors</div>
              </div>
            </div>
          </div>
        )}

        <div
          className={`dropzone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{ cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.7 : 1 }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
            disabled={importing}
          />
          <div className="dropzone-icon">
            {importing ? <div className="spinner" style={{ borderTopColor: 'var(--accent)' }} /> : <FileSpreadsheet size={22} />}
          </div>
          <h3>{importing ? 'Importing...' : 'Drop your .xlsx file here'}</h3>
          <p>
            {importing ? 'Processing, please wait...' : 'or click to browse. Supports .xlsx and .xls files.'}
          </p>
          {!importing && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '0.75rem' }}
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              <Upload size={13} /> Choose File
            </button>
          )}
        </div>

        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text3)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text2)' }}>Expected columns:</strong> Product Name, Barcode, Cost, Selling Price.<br />
            Existing items (same barcode) will be updated. New items will be added.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
