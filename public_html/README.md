# GXA Toolbox - PHP & MySQL Migration & Hostinger Deployment Guide

This repository contains the dynamic PHP + MySQL version of **GXA Toolbox**, a product of **GXA Technologies**, structured for standard, production-ready Hostinger shared hosting deployments.

## Directory Layout Structure
```text
/public_html/                 <-- Map directly to Hostinger's public_html folder
  ├── assets/                 <-- UI Assets (style.css, app.js)
  ├── api/                    <-- Session authentication and database telemetry endpoints
  │     ├── login.php
  │     ├── register.php
  │     ├── logout.php
  │     ├── auth-api.php        <-- Unified authentication profiles query
  │     ├── save-job.php
  │     ├── get-history.php
  │     ├── ai-tools.php        <-- Google Gemini AI summarization and translation bridges
  │     ├── resume-api.php      <-- Dynamic ATS resume generator
  │     ├── payments.php        <-- Razorpay checkout order validation handlers
  │     ├── text-tools.php      <-- Case converters, grammar and plagiarism scoring
  │     └── contact.php
  ├── config/                 <-- Database configurations (PDO connection wrapper)
  │     └── database.php
  ├── dashboard/              <-- Server-side rendered (SSR) User Activity dashboard
  │     └── index.php
  ├── admin/                  <-- Admin control panel (telemetry tracking, customer mailbox)
  │     └── index.php
  ├── uploads/                <-- Writable workspace directory (Chmod 755)
  ├── processed/              <-- Writable workspace directory (Chmod 755)
  ├── .htaccess               <-- URL routing and folder security
  ├── index.php               <-- Bootstrapped homepage entry layout
  └── README.md               <-- This guide
```

---

## Razorpay Payment Integration & Testing

GXA Toolbox has built-in Razorpay checkout billing. By default, it runs in **Sandbox Test Mode** so you can test features without configuring live credentials.

### How to Test Payments in Sandbox Mode:
1. Log in to a standard user account on the website.
2. Click any upgrade option in the pricing cards (e.g. **Upgrade to Pro** for ₹99/month).
3. The app detects that no active Razorpay keys are configured and loads the custom **Sandbox Checkout Modal**.
4. Click **Simulate Success**. The app validates payment logs in the database, upgrades your plan in the session, and redirects you to the user portal billing overview.
5. In PhpMyAdmin, check the `payments` and `subscriptions` tables to confirm the records were inserted successfully.

### How to Configure Live Razorpay Keys:
1. Obtain your `Key ID` and `Key Secret` from the Razorpay Dashboard.
2. Configure them on Hostinger by adding environment variables in your server manager, or define them in `/public_html/api/payments.php` on lines 18-19.
3. Once live keys are defined, the app automatically pulls the real Razorpay script overlay for checkout payments.


---

## Hostinger Deployment & Verification Steps

Follow these exact steps to deploy and test GXA Toolbox on your Hostinger account:

### Step 1: Create MySQL Database
1. Log in to your Hostinger hPanel.
2. Navigate to **Databases** > **MySQL Databases**.
3. Create a new database:
   - **Database Name**: `your_database_name` (e.g. `u123456789_gxa_toolbox`)
   - **Username**: `your_database_user` (e.g. `u123456789_user`)
   - **Password**: `your_database_password`
4. Copy the created database credentials (database name, user, and password) for Step 3.

### Step 2: Import database.sql
1. In Hostinger hPanel, click **Enter phpMyAdmin** for your database.
2. Select your newly created database in the left sidebar.
3. Click the **Import** tab on the top menu bar.
4. Select the [`database.sql`](../database.sql) file from the root folder of this project.
5. Click **Import** (or **Go** depending on the phpMyAdmin version) to execute the tables creation and populate default tools usage stats.
6. Verify that the tables (`users`, `tools`, `file_jobs`, `subscriptions`, `payments`, `contact_messages`) are successfully created.

### Step 3: Update config/database.php
1. Open the file `public_html/config/database.php`.
2. Replace the fallback database connection placeholders with your actual Hostinger credentials:
   ```php
   define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
   define('DB_NAME', getenv('DB_NAME') ?: 'your_actual_database_name');
   define('DB_USER', getenv('DB_USER') ?: 'your_actual_database_user');
   define('DB_PASS', getenv('DB_PASS') !== false ? getenv('DB_PASS') : 'your_actual_database_password');
   ```
3. Alternatively, you can declare these as environment variables in `public_html/.htaccess` or your system environment variables.

### Step 4: Upload public_html Contents
1. Zip the entire contents of the `/public_html` directory.
2. In Hostinger hPanel, open **File Manager** (or connect via FTP using FileZilla).
3. Navigate to your domain's root folder (`public_html/`).
4. Upload the zip package and extract it directly into `public_html/`.
5. Ensure the `/public_html/uploads/` and `/public_html/processed/` folders are created and have write permissions (chmod `755`).

### Step 5: Test login/register/admin
1. Navigate to your live website (e.g., `https://yourdomain.com`).
2. Click **Sign up for free** and create a standard user account to test the registration endpoint (`/api/register.php`).
3. Log out, then click **Sign In** and enter your credentials to test the login endpoint (`/api/login.php`).
4. Execute any tools (like Merge PDF, Color Extractor, or Password Generator) and verify that the activity is tracked under **Recent Activity Log** in the User Dashboard (`/dashboard/index.php`).
5. Log out, then sign in with an administrator account provisioned securely for your deployment. No shared default administrator password is provided.
6. Access the Admin Control Panel at `/admin/` (or `https://yourdomain.com/admin/`).
7. Verify that you can view the registered users list, tool usage telemetry bars, file processing histories, and delete or review support inquiries from the contact form inbox.
