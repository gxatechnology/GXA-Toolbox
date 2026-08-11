<?php
/* Backward-compatible unified auth endpoint for PHP-capable hosting. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$action = $_GET['action'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'register') {
    require __DIR__ . '/register.php';
    exit;
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'login') {
    require __DIR__ . '/login.php';
    exit;
}
if (in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true) && $action === 'logout') {
    require __DIR__ . '/logout.php';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'profile') {
    require_once '../config/session.php';
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => true, 'loggedIn' => false, 'user' => null]);
        exit;
    }

    require_once '../config/database.php';
    try {
        $stmt = $pdo->prepare('SELECT id, name, email, role, is_premium, status FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        if (!$user || $user['status'] !== 'active') {
            session_unset();
            session_destroy();
            echo json_encode(['success' => true, 'loggedIn' => false, 'user' => null]);
            exit;
        }
        echo json_encode([
            'success' => true,
            'loggedIn' => true,
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
                'is_premium' => (int)$user['is_premium'],
            ],
        ]);
    } catch (PDOException $e) {
        error_log('Account profile database error: ' . $e->getMessage());
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => 'Unable to connect to the authentication service.']);
    }
    exit;
}

http_response_code(404);
echo json_encode(['success' => false, 'message' => 'Unknown authentication action.']);
