import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { admin, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="spinner" style={{ borderTopColor: 'var(--accent)', width: 28, height: 28, borderWidth: 3 }} />
      </div>
    );
  }
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
};

export default ProtectedRoute;
