# ScanPro - Barcode Scanner App

A full-stack barcode scanner application with React frontend and Node.js/Express backend.

## Requirements
- Node.js v18+
- MySQL 8.0+

## Setup

### 0. Run Everything From Root (Recommended)
```bash
cd app
npm install
npm run setup
npm run dev
```

This starts both backend (`http://localhost:5000`) and frontend (`http://localhost:3000`) from one command.

### 1. MySQL Database
Create a database:
```sql
CREATE DATABASE barcode_scanner CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your DB credentials and secrets
npm install
npm run dev
```

The backend runs on http://localhost:5000

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The frontend runs on http://localhost:3000

## Default Admin Credentials
- **Username:** admin
- **Password:** admin123

⚠️ Change these in `backend/.env` before production use!

## Environment Variables (backend/.env)
| Variable | Description | Default |
|---|---|---|
| PORT | Backend port | 5000 |
| DB_HOST | MySQL host | localhost |
| DB_USER | MySQL user | root |
| DB_PASSWORD | MySQL password | (empty) |
| DB_NAME | Database name | barcode_scanner |
| JWT_SECRET | JWT signing secret | change this! |
| JWT_EXPIRES_IN | Token expiry | 8h |
| ADMIN_USERNAME | Admin username | admin |
| ADMIN_PASSWORD | Admin password | admin123 |

## Features
- **Public Scanner:** Scan barcodes, see product name and price
- **Admin Login:** Secure JWT-based authentication
- **Admin Scanner:** See product name, price, AND cost
- **Import Products:** Drag & drop .xlsx file to import/update products
  - Duplicate barcodes are updated (not duplicated)
  - New barcodes are inserted
- **Responsive:** Works on mobile and desktop

## Product XLSX Format
Expected columns: `Product Name`, `Barcode`, `Cost`, `Selling Price`
