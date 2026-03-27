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
| DB_PORT | MySQL port | 3306 |
| DB_USER | MySQL user | root |
| DB_PASSWORD | MySQL password | (empty) |
| DB_NAME | Database name | barcode_scanner |
| DB_URL | Full MySQL connection URL (optional) | (empty) |
| DB_SSL | Enable SSL for DB connection (`true`/`false`) | false |
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

## Deploy to Railway
This repo is configured to deploy as a single Railway web service:
- Build command is defined in `railway.json` and builds the frontend.
- Start command runs the backend, which serves the built frontend files.

### Railway setup
1. In Railway, create a new project and connect this GitHub repository.
2. Add a **MySQL** database service to the same Railway project.
3. In your app service variables, create these keys:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
   - `JWT_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
4. For `DB_*` values, use Railway's **Reference Variable** feature and select values from your MySQL service (`MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`).
5. Set strong custom values for `JWT_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`.
6. Deploy the staged changes.
7. Open `https://<your-domain>/api/health` and confirm it returns `{ "status": "ok" }`.

## Connect Railway MySQL from MySQL Workbench
1. Open the Railway MySQL service and make sure TCP Proxy/Public networking is enabled.
2. In the MySQL service Networking tab, copy the TCP Proxy host and port.
3. In the MySQL service variables, copy `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE`.
4. In MySQL Workbench create a new connection with:
   - Connection Method: `Standard (TCP/IP)`
   - Hostname: `<TCP_PROXY_HOST>`
   - Port: `<TCP_PROXY_PORT>`
   - Username: `MYSQLUSER`
   - Password: `MYSQLPASSWORD`
   - Default Schema: `MYSQLDATABASE`
5. Test connection and save.
6. (Optional) Run `database.sql` in the selected `MYSQLDATABASE` schema.
