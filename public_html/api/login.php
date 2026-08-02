<?php
/* ==========================================================================
   GXA TOOLBOX API - USER LOGIN
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

$email = trim($data['email'] ?? '');
$password = trim($data['password'] ?? '');

if (empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Please enter both email and password fields.']);
    exit;
}

try {
    // Check if user exists
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid email or password combination.']);
        exit;
    }

    // Check account status
    if ($user['status'] !== 'active') {
        echo json_encode(['success' => false, 'message' => 'Your account has been deactivated. Please contact admin.']);
        exit;
    }

    // Set PHP session parameters
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['is_premium'] = (int)$user['is_premium'];

    echo json_encode([
        'success' => true,
        'message' => 'Logged in successfully!',
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'is_premium' => (int)$user['is_premium']
        ]
    ]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Server execution error: ' . $e->getMessage()]);
}
