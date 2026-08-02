<?php
/* ==========================================================================
   GXA TOOLBOX API - CONTACT SUPPORT MESSAGE LOG
   ========================================================================== */

header('Content-Type: application/json; charset=utf-8');
session_start();

require_once '../config/database.php';

// Accept both POST form data and raw JSON inputs
$data = $_POST;
if (empty($data)) {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?: [];
}

$name = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$message = trim($data['message'] ?? '');

if (empty($name) || empty($email) || empty($message)) {
    echo json_encode(['success' => false, 'message' => 'Please fill in name, email, and message.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Invalid email address format.']);
    exit;
}

try {
    $stmt = $pdo->prepare("INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)");
    $stmt->execute([$name, $email, $message]);

    echo json_encode([
        'success' => true,
        'message' => 'Thank you! Your message has been received by our support team.'
    ]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Server execution error: ' . $e->getMessage()]);
}
