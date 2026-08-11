<?php
/* ==========================================================================
   GXA TOOLBOX API - USER LOGOUT
   ========================================================================== */

require_once '../config/session.php';
session_unset();
session_destroy();
setcookie(session_name(), '', [
    'expires' => time() - 3600,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Lax',
]);

// Detect request format to support both browser redirect and dynamic AJAX calls
$isAjax = isset($_GET['ajax']) || 
          (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false) ||
          (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

if ($isAjax) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'message' => 'Session terminated successfully.']);
} else {
    header('Location: /index.php');
}
exit;
