import React from 'react';
import { Barcode, Tag, DollarSign, TrendingUp, AlertCircle, Loader } from 'lucide-react';

const ProductResult = ({ result, loading, showCost = false }) => {
  if (loading) {
    return (
      <div className="product-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
        <div className="spinner" style={{ borderTopColor: 'var(--accent)' }} />
        <span style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>Looking up product...</span>
      </div>
    );
  }
  if (!result) return null;
  if (result.error) {
    return (
      <div className="product-card not-found">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} color="var(--accent3)" />
          <span style={{ color: 'var(--accent3)', fontSize: '0.875rem' }}>{result.error}</span>
        </div>
        {result.barcode && (
          <div className="product-barcode" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            <Barcode size={12} /> {result.barcode}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="product-card found">
      <div className="product-name">
        <Tag size={14} style={{ display: 'inline', marginRight: '0.4rem', color: 'var(--accent)' }} />
        {result.product_name}
      </div>
      <div className="product-barcode">
        <Barcode size={12} /> {result.barcode}
      </div>
      <div className="product-prices">
        {showCost && (
          <div className="price-item cost">
            <div className="price-label">
              <TrendingUp size={10} style={{ display: 'inline' }} /> Cost
            </div>
            <div className="price-value">${parseFloat(result.cost || 0).toFixed(2)}</div>
          </div>
        )}
        <div className="price-item" style={{ gridColumn: showCost ? 'auto' : '1 / -1' }}>
          <div className="price-label">
            <DollarSign size={10} style={{ display: 'inline' }} /> Price
          </div>
          <div className="price-value">${parseFloat(result.selling_price || 0).toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
};

export default ProductResult;
