<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once '../config/session.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => true, 'authenticated' => false, 'user' => null]);
    exit;
}

echo json_encode([
    'success' => true,
    'authenticated' => true,
    'user' => [
        'id' => (int)$_SESSION['user_id'],
        'name' => (string)$_SESSION['user_name'],
        'email' => (string)$_SESSION['user_email'],
        'role' => (string)$_SESSION['role'],
        'is_premium' => (int)$_SESSION['is_premium'],
    ],
]);

