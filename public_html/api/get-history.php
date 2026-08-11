<?php
/* ==========================================================================
   GXA TOOLBOX API - RETRIEVE SESSION HISTORY LOGS
   ========================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once '../config/session.php';

require_once '../config/database.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized access. Please login.']);
    exit;
}

$userId = intval($_SESSION['user_id']);

try {
    // 1. Get total processed count for the user
    $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM file_jobs WHERE user_id = ?");
    $countStmt->execute([$userId]);
    $countData = $countStmt->fetch();
    $processedCount = intval($countData['total'] ?? 0);

    // 2. Fetch recent jobs
    $stmt = $pdo->prepare("SELECT id, original_file as name, tool_name as tool, DATE_FORMAT(created_at, '%Y-%m-%d') as date, CONCAT(size_mb, ' MB') as size, status FROM file_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50");
    $stmt->execute([$userId]);
    $history = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'processedCount' => $processedCount,
        'history' => $history
    ]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Server execution error: ' . $e->getMessage()]);
}
