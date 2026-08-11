<?php
/* ==========================================================================
   GXA TOOLBOX API - USER REGISTRATION
   ========================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once '../config/session.php';

require_once '../config/database.php';

// Accept both POST form data and raw JSON inputs
$data = $_POST;
if (empty($data)) {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?: [];
}

$name = preg_replace('/\s+/', ' ', trim($data['name'] ?? ''));
$email = strtolower(trim($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');

if (empty($name) || empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Please fill in all registration fields.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Invalid email address format.']);
    exit;
}

if (strlen($name) < 2 || strlen($name) > 120) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Enter a valid full name.']);
    exit;
}

if (strlen($password) < 8 || strlen($password) > 128) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Use a password between 8 and 128 characters.']);
    exit;
}

try {
    // Check if email already registered
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'This email is already registered.']);
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
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    $_SESSION['user_name'] = $name;
    $_SESSION['user_email'] = $email;
    $_SESSION['role'] = 'user';
    $_SESSION['is_premium'] = 0;

    echo json_encode([
        'success' => true,
        'message' => 'Account created successfully.',
        'user' => [
            'id' => $userId,
            'name' => $name,
            'email' => $email,
            'role' => 'user',
            'is_premium' => 0
        ]
    ]);
} catch (PDOException $e) {
    if ((string)$e->getCode() === '23000') {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'This email is already registered.']);
        exit;
    }
    error_log('Registration database error: ' . $e->getMessage());
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => 'Unable to connect to the authentication service.']);
}
