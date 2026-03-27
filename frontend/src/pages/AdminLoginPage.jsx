import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, User, Lock, AlertCircle, ArrowLeft } from 'lucide-react';

const AdminLoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) { setError('Please fill in all fields.'); return; }
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ marginBottom: '1.25rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>
        <div className="login-header">
          <div className="login-icon">
            <ShieldCheck size={26} />
          </div>
          <h1 className="login-title">Admin Portal</h1>
          <p className="login-subtitle">Restricted access — authorized personnel only</p>
        </div>
        {error && (
          <div className="error-msg">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label"><User size={11} /> Username</label>
            <input
              type="text"
              className="input-full"
              placeholder="Enter username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label className="form-label"><Lock size={11} /> Password</label>
            <input
              type="password"
              className="input-full"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? <><div className="spinner" /> Signing in...</> : <><ShieldCheck size={15} /> Sign In</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
