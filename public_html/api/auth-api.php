<?php
/* ==========================================================================
   GXA TOOLBOX API - UNIFIED AUTHENTICATION CONTROLLER (SaaS Version)
   ========================================================================== */

header('Content-Type: application/json; charset=utf-8');
session_start();

require_once '../config/database.php';

$action = $_GET['action'] ?? '';

// Accept raw JSON inputs
$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?: [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($action === 'register') {
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
            // Check email uniqueness
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                echo json_encode(['success' => false, 'message' => 'This email address is already registered.']);
                exit;
            }

            // Secure Bcrypt hashing
            $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
            // Insert standard subscriber
            $insert = $pdo->prepare("INSERT INTO users (name, email, password, role, is_premium, status) VALUES (?, ?, ?, 'user', 0, 'active')");
            $insert->execute([$name, $email, $hashedPassword]);
            $userId = $pdo->lastInsertId();

            // Set session properties
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
            echo json_encode(['success' => false, 'message' => 'Database execution error: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'login') {
        $email = trim($data['email'] ?? '');
        $password = trim($data['password'] ?? '');

        if (empty($email) || empty($password)) {
            echo json_encode(['success' => false, 'message' => 'Please enter email and password.']);
            exit;
        }

        try {
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
            echo json_encode(['success' => false, 'message' => 'Database execution error: ' . $e->getMessage()]);
        }
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'logout') {
        session_unset();
        session_destroy();
        echo json_encode(['success' => true, 'message' => 'Session terminated successfully.']);
        exit;
    }

    if ($action === 'profile') {
        if (!isset($_SESSION['user_id'])) {
            echo json_encode(['success' => false, 'loggedIn' => false]);
            exit;
        }

            try {
                // Load fresh data from DB to reflect any changes
                $stmt = $pdo->prepare("SELECT id, name, email, role, is_premium, status FROM users WHERE id = ?");
                $stmt->execute([$_SESSION['user_id']]);
                $user = $stmt->fetch();

            if ($user && $user['status'] === 'active') {
                // Sync session
                $_SESSION['role'] = $user['role'];
                $_SESSION['is_premium'] = (int)$user['is_premium'];

                echo json_encode([
                    'success' => true,
                    'loggedIn' => true,
                    'user' => [
                        'id' => $user['id'],
                        'name' => $user['name'],
                        'email' => $user['email'],
                        'role' => $user['role'],
                        'is_premium' => (int)$user['is_premium']
                    ]
                ]);
            } else {
                session_destroy();
                echo json_encode(['success' => false, 'loggedIn' => false]);
            }
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
        }
        exit;
    }
}

echo json_encode(['success' => false, 'message' => 'Invalid action endpoint request.']);
