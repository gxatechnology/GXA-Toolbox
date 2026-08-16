-- MySQL database structures for GXA Toolbox Multi-Role Platform
-- Compatible with PHP 8.2+ and standard Hostinger MySQL installations
-- This script completely removes pricing plans and Razerpay integrations.

CREATE DATABASE IF NOT EXISTS `utilora_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `utilora_db`;

-- Drop old tables in correct order of dependency
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `subscriptions`;
DROP TABLE IF EXISTS `background_removal_jobs`;
DROP TABLE IF EXISTS `ai_usage_logs`;
DROP TABLE IF EXISTS `file_jobs`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `plans`;
DROP TABLE IF EXISTS `tools`;
DROP TABLE IF EXISTS `contact_messages`;
DROP TABLE IF EXISTS `resume_templates`;

-- 1. USERS TABLE
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('developer', 'admin', 'user') DEFAULT 'user',
  `is_premium` TINYINT(1) DEFAULT 0,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TOOLS TABLE (Includes dynamic premium toggle)
CREATE TABLE `tools` (
  `id` VARCHAR(100) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `use_count` INT DEFAULT 0,
  `is_premium` TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. FILE PROCESSING JOBS TABLE
CREATE TABLE `file_jobs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `tool_name` VARCHAR(100) NOT NULL,
  `original_file` VARCHAR(255) NOT NULL,
  `output_file` VARCHAR(255) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'done',
  `size_mb` DECIMAL(10,2) DEFAULT 0.00,
  `processing_time_ms` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. AI BACKGROUND REMOVAL JOBS TABLE
CREATE TABLE `background_removal_jobs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `original_file` VARCHAR(255) NOT NULL,
  `output_file` VARCHAR(255) NOT NULL,
  `file_size` DECIMAL(10,2) DEFAULT 0.00,
  `status` VARCHAR(50) DEFAULT 'done',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. CONTACT MESSAGES TABLE
CREATE TABLE `contact_messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. ATS RESUME TEMPLATES TABLE
CREATE TABLE `resume_templates` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `layout_html` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. AI CONSUMPTION LOGS TABLE
CREATE TABLE `ai_usage_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `api_provider` VARCHAR(50) NOT NULL,
  `prompt_tokens` INT DEFAULT 0,
  `completion_tokens` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ==========================================
-- SEED INITIAL CONFIGURATION DATA
-- ==========================================

-- No user accounts or credentials are seeded. Provision identities through the production authentication service.

-- Prepopulate tools table and set default premium statuses
INSERT INTO `tools` (`id`, `name`, `category`, `use_count`, `is_premium`) VALUES
-- PDF Tools
('merge-pdf', 'Merge PDF', 'pdf', 0, 0),
('organize-pdf', 'Organize PDF', 'pdf', 0, 0),
('split-pdf', 'Split PDF', 'pdf', 0, 0),
('compress-pdf', 'Compress PDF', 'pdf', 0, 0),
('rotate-pdf', 'Rotate PDF', 'pdf', 0, 0),
('remove-pdf-pages', 'Remove PDF Pages', 'pdf', 0, 0),
('extract-pdf-pages', 'Extract PDF Pages', 'pdf', 0, 0),
('extract-images-pdf', 'Extract Images', 'pdf', 0, 0),
('crop-pdf', 'Crop PDF', 'pdf', 0, 0),
('pagenumber-pdf', 'Add Page Numbers', 'pdf', 0, 0),
('watermark-pdf', 'Add Watermark', 'pdf', 0, 0),
('header-footer-pdf', 'Add Header & Footer', 'pdf', 0, 0),
('sign-pdf', 'Sign PDF', 'pdf', 0, 0),
('protect-pdf', 'Protect PDF', 'pdf', 0, 0),
('unlock-pdf', 'Unlock PDF', 'pdf', 0, 0),
('repair-pdf', 'Repair PDF', 'pdf', 0, 0),
('ocr-pdf', 'OCR PDF', 'pdf', 0, 0),
('pdf-metadata', 'PDF Metadata Editor', 'pdf', 0, 0),
-- Image Tools
('compress-image', 'Compress Image', 'image', 0, 0),
('resize-image', 'Resize Image', 'image', 0, 0),
('crop-image', 'Crop Image', 'image', 0, 0),
('background-remover', 'AI Background Remover', 'image', 0, 0),
('bulk-bg-remover', 'Bulk Background Remover', 'image', 0, 0),
('rotate-image', 'Rotate Image', 'image', 0, 0),
('flip-image', 'Flip Image', 'image', 0, 0),
('photo-enhancer', 'Photo Enhancer', 'image', 0, 0),
('blur-face', 'Blur Face', 'image', 0, 0),
('blur-sensitive', 'Blur Sensitive Area', 'image', 0, 0),
-- AI Tools
('ai-pdf-summarizer', 'AI PDF Summarizer', 'ai', 0, 0),
('ai-pdf-translator', 'PDF Translator', 'ai', 0, 0),
('ai-resume-builder', 'AI Resume Builder', 'ai', 0, 0),
-- Text Tools
('word-counter', 'Word Counter', 'text', 0, 0),
('case-converter', 'Case Converter', 'text', 0, 0),
('remove-spaces', 'Remove Extra Spaces', 'text', 0, 0),
('grammar-checker', 'Grammar Checker', 'text', 0, 0),
('plagiarism-checker', 'Plagiarism Checker', 'text', 0, 0),
-- Utility Tools
('qr-generator', 'QR Code Generator', 'utility', 0, 0),
('qr-reader', 'QR Code Reader', 'utility', 0, 0),
('barcode-generator', 'Barcode Generator', 'utility', 0, 0),
('barcode-scanner', 'Barcode Scanner', 'utility', 0, 0),
-- Calculator Tools
('calculator', 'Simple Calculator', 'calculator', 0, 0),
('scientific-calculator', 'Scientific Calculator', 'calculator', 0, 0),
('percentage-calculator', 'Percentage Calculator', 'calculator', 0, 0),
('age-calculator', 'Age Calculator', 'calculator', 0, 0),
('date-calculator', 'Date Calculator', 'calculator', 0, 0),
('emi-calculator', 'EMI Calculator', 'calculator', 0, 0),
('loan-calculator', 'Loan Calculator', 'calculator', 0, 0),
('interest-calculator', 'Interest Calculator', 'calculator', 0, 0),
('gst-calculator', 'GST Calculator', 'calculator', 0, 0),
('sip-calculator', 'SIP Calculator', 'calculator', 0, 0),
('bmi-calculator', 'BMI Calculator', 'calculator', 0, 0),
('discount-calculator', 'Discount Calculator', 'calculator', 0, 0),
('unit-converter', 'Unit Converter', 'calculator', 0, 0),
('currency-converter', 'Currency Converter', 'calculator', 0, 0),
('time-calculator', 'Time Calculator', 'calculator', 0, 0)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `category`=VALUES(`category`), `is_premium`=VALUES(`is_premium`);

-- Seed default ATS Resume template
INSERT INTO `resume_templates` (`id`, `name`, `layout_html`) VALUES
('modern-ats', 'Modern Minimalist ATS', '<div style="font-family:Arial,sans-serif;color:#333;padding:20px;"><h1 style="text-align:center;color:#1A365D;margin-bottom:5px;">{{name}}</h1><p style="text-align:center;font-size:12px;margin-bottom:20px;">{{email}} | {{phone}} | {{location}}</p><h3 style="border-bottom:1px solid #1A365D;color:#1A365D;">Professional Summary</h3><p>{{summary}}</p><h3 style="border-bottom:1px solid #1A365D;color:#1A365D;margin-top:20px;">Experience</h3><p>{{experience}}</p><h3 style="border-bottom:1px solid #1A365D;color:#1A365D;margin-top:20px;">Education</h3><p>{{education}}</p><h3 style="border-bottom:1px solid #1A365D;color:#1A365D;margin-top:20px;">Skills</h3><p>{{skills}}</p></div>')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);
