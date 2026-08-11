<?php
/* ==========================================================================
   GXA TOOLBOX API - SAVE COMPLETED JOB METRICS & TELEMETRY
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

$toolName = trim($data['tool_name'] ?? '');
$originalFile = trim($data['original_file'] ?? '');
$outputFile = trim($data['output_file'] ?? '');
$status = trim($data['status'] ?? 'done');
$sizeMb = floatval($data['size'] ?? 0.00);
$processingTimeMs = intval($data['processing_time'] ?? 0); // Gathered from client-side execution start/end timings

if (empty($toolName) || empty($originalFile) || empty($outputFile)) {
    echo json_encode(['success' => false, 'message' => 'Missing required job parameters.']);
    exit;
}

$userId = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;

try {
    // 1. Insert job into file_jobs with processing time logging
    $stmt = $pdo->prepare("INSERT INTO file_jobs (user_id, tool_name, original_file, output_file, status, size_mb, processing_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$userId, $toolName, $originalFile, $outputFile, $status, $sizeMb, $processingTimeMs]);
    $jobId = $pdo->lastInsertId();

    // 2. Increment tool execution count in tools table
    $updateTool = $pdo->prepare("UPDATE tools SET use_count = use_count + 1 WHERE name = ? OR id = ?");
    $updateTool->execute([$toolName, strtolower(str_replace(' ', '-', $toolName))]);

    echo json_encode([
        'success' => true,
        'message' => 'Job log telemetry saved in database.',
        'job_id' => $jobId
    ]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Server database error: ' . $e->getMessage()]);
}
