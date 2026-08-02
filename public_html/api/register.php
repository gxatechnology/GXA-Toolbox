<?php
/* ==========================================================================
   GXA TOOLBOX API - USER REGISTRATION
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
$password = trim($data['password'] ?? '');

if (empty($name) || empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Please fill in all registration fields.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Invalid email address format.']);
    exit;
}

if (strlen($password) < 6) {
    echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters long.']);
    exit;
}

try {
    // Check if email already registered
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'This email address is already registered.']);
        exit;
    }

    // Hash the password securely using bcrypt
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
    $defaultPlan = 'free';

    // Insert user into database
    $insert = $pdo->prepare("INSERT INTO users (name, email, password, role, is_premium, status) VALUES (?, ?, ?, 'user', 0, 'active')");
    $insert->execute([$name, $email, $hashedPassword]);
    $userId = $pdo->lastInsertId();

    // Initialize PHP session
    $_SESSION['user_id'] = $userId;
    $_SESSION['user_name'] = $name;
    $_SESSION['user_email'] = $email;
    $_SESSION['role'] = 'user';
    $_SESSION['is_premium'] = 0;

    echo json_encode([
        'success' => true,
        'message' => 'Account registered successfully!',
        'user' => [
            'id' => $userId,
            'name' => $name,
            'email' => $email,
            'role' => 'user',
            'is_premium' => 0
        ]
    ]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Server execution error: ' . $e->getMessage()]);
}
