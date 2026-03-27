const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { pool } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      return cb(new Error('Only .xlsx and .xls files are allowed'));
    }
    cb(null, true);
  }
});

// Public: Get product by barcode
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    const [rows] = await pool.query(
      'SELECT barcode, product_name, selling_price FROM products WHERE barcode = ?',
      [barcode]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Admin: Get product by barcode (includes cost)
router.get('/admin/barcode/:barcode', authenticateAdmin, async (req, res) => {
  try {
    const { barcode } = req.params;
    const [rows] = await pool.query(
      'SELECT barcode, product_name, cost, selling_price FROM products WHERE barcode = ?',
      [barcode]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Admin: Get all products
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT barcode, product_name, cost, selling_price FROM products ORDER BY product_name LIMIT 100'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Admin: Import products from XLSX
router.post('/admin/import', authenticateAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (data.length === 0) {
      return res.status(400).json({ error: 'Empty spreadsheet.' });
    }

    // Detect column names (flexible matching)
    const sampleRow = data[0];
    const keys = Object.keys(sampleRow);
    
    const findCol = (patterns) => keys.find(k => patterns.some(p => k.toLowerCase().includes(p.toLowerCase())));
    
    const nameCol = findCol(['product name', 'name', 'product']);
    const barcodeCol = findCol(['barcode', 'bar code', 'code', 'sku']);
    const costCol = findCol(['cost']);
    const priceCol = findCol(['selling price', 'price', 'sell']);

    if (!nameCol || !barcodeCol) {
      return res.status(400).json({ error: 'Could not find required columns (Product Name, Barcode). Please check the file format.' });
    }

    let added = 0, updated = 0, skipped = 0, errors = 0;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const row of data) {
        const barcode = String(row[barcodeCol] || '').trim();
        const productName = String(row[nameCol] || '').trim();
        if (!barcode || !productName) { skipped++; continue; }

        const cost = parseFloat(row[costCol]) || 0;
        const sellingPrice = parseFloat(row[priceCol]) || 0;

        try {
          const [existing] = await conn.query('SELECT id FROM products WHERE barcode = ?', [barcode]);
          if (existing.length > 0) {
            await conn.query(
              'UPDATE products SET product_name=?, cost=?, selling_price=? WHERE barcode=?',
              [productName, cost, sellingPrice, barcode]
            );
            updated++;
          } else {
            await conn.query(
              'INSERT INTO products (barcode, product_name, cost, selling_price) VALUES (?,?,?,?)',
              [barcode, productName, cost, sellingPrice]
            );
            added++;
          }
        } catch (rowErr) {
          errors++;
        }
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.json({ 
      success: true, 
      message: `Import complete: ${added} added, ${updated} updated, ${skipped} skipped, ${errors} errors.`,
      added, updated, skipped, errors,
      total: data.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Import failed.' });
  }
});

module.exports = router;
