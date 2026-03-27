const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { pool, initDB } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many login attempts.' } });
app.use(limiter);
app.use('/api/auth/login', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve frontend build in production-style deployments
const frontendBuildPath = path.resolve(__dirname, '../../frontend/build');
app.use(express.static(frontendBuildPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

const seedAdmin = async () => {
  try {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const [rows] = await pool.query('SELECT id FROM admins WHERE username = ?', [username]);
    if (rows.length === 0) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, hash]);
      console.log(`Admin user created: ${username}`);
    }
  } catch (err) {
    console.error('Admin seed error:', err.message);
  }
};

const start = async () => {
  try {
    await initDB();
    await seedAdmin();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Startup error:', err.message);
    process.exit(1);
  }
};

start();
