<?php
/* ==========================================================================
   GXA TOOLBOX API - USER LOGIN
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

$email = strtolower(trim($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');

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
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Incorrect email or password.']);
        exit;
    }

    // Check account status
    if ($user['status'] !== 'active') {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Incorrect email or password.']);
        exit;
    }

    // Set PHP session parameters
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['is_premium'] = (int)$user['is_premium'];

    echo json_encode([
        'success' => true,
        'message' => 'Signed in successfully.',
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'is_premium' => (int)$user['is_premium']
        ]
    ]);
} catch (PDOException $e) {
    error_log('Login database error: ' . $e->getMessage());
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => 'Unable to connect to the authentication service.']);
}
