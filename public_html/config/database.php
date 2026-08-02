<?php
/* ==========================================================================
   GXA TOOLBOX DATABASE CONNECTION CONFIGURATION (PDO)
   ========================================================================== */

// Hostinger / Server Environment Configuration Variables
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'your_database_name');
define('DB_USER', getenv('DB_USER') ?: 'your_database_user');
define('DB_PASS', getenv('DB_PASS') !== false ? getenv('DB_PASS') : 'your_database_password');

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    $pdo = null;
    $databaseAvailable = false;
    if (defined('GXA_ALLOW_DATABASE_OFFLINE') && GXA_ALLOW_DATABASE_OFFLINE === true) {
        return;
    }
    // If accessed through API routing, output error payload in JSON format
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if (strpos($uri, '/api/') !== false) {
        http_response_code(503);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'The account service is temporarily unavailable.'
        ]);
        exit;
    }
    
    // Web display fallback
    http_response_code(503);
    die("<h3>Database Connection Offline</h3><p>Please check your database configurations or ensure your MySQL server is running.</p>");
}
