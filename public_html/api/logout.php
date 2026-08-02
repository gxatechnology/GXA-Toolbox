<?php
/* ==========================================================================
   GXA TOOLBOX API - USER LOGOUT
   ========================================================================== */

session_start();
session_unset();
session_destroy();

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
