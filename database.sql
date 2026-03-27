CREATE DATABASE IF NOT EXISTS barcode_scanner
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE barcode_scanner;

CREATE TABLE IF NOT EXISTS products (
  id            INT            AUTO_INCREMENT PRIMARY KEY,
  barcode       VARCHAR(255)   NOT NULL,
  product_name  VARCHAR(500)   NOT NULL,
  cost          DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  selling_price DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_barcode (barcode),
  INDEX  idx_barcode (barcode)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id            INT            AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100)   NOT NULL,
  password_hash VARCHAR(255)   NOT NULL,
  created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_username (username)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT INTO admins (username, password_hash)
VALUES (
  'admin',
  '$2a$12$JUiccYPRoZdz0XM5MHC.q.T2XWGXJbXHui6lpOU5sXbl4cz08ZVRO'
)
ON DUPLICATE KEY UPDATE username = username;
