<?php
/* ==========================================================================
   GXA TOOLBOX API - TEXT PROCESSING UTILITIES (SaaS Suite)
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

$action = $_GET['action'] ?? '';
$text = $data['text'] ?? '';

if (empty($text) && $action !== 'count') {
    echo json_encode(['success' => false, 'message' => 'Please provide input text to analyze.']);
    exit;
}

$userId = $_SESSION['user_id'] ?? null;

switch ($action) {
    case 'count':
        $charCount = mb_strlen($text);
        $charCountNoSpaces = mb_strlen(str_replace(' ', '', $text));
        $wordCount = !empty(trim($text)) ? count(preg_split('/\s+/u', trim($text))) : 0;
        $paragraphCount = !empty(trim($text)) ? count(preg_split('/\n\s*\n+/u', trim($text))) : 0;
        $lineCount = !empty(trim($text)) ? count(explode("\n", $text)) : 0;
        
        // Log telemetry
        $stmt = $pdo->prepare("INSERT INTO file_jobs (user_id, tool_name, original_file, output_file, status, size_mb, processing_time_ms) VALUES (?, 'Word Counter', 'text_input.txt', 'count_metrics.json', 'done', 0.01, 15)");
        $stmt->execute([$userId]);

        echo json_encode([
            'success' => true,
            'metrics' => [
                'characters' => $charCount,
                'charactersNoSpaces' => $charCountNoSpaces,
                'words' => $wordCount,
                'paragraphs' => $paragraphCount,
                'lines' => $lineCount,
                'readingTimeMinutes' => ceil($wordCount / 200) // Average reading speed 200 wpm
            ]
        ]);
        break;

    case 'case':
        $mode = $data['mode'] ?? 'upper'; // upper, lower, title, camel, kebab
        $converted = '';

        if ($mode === 'upper') {
            $converted = mb_strtoupper($text);
        } elseif ($mode === 'lower') {
            $converted = mb_strtolower($text);
        } elseif ($mode === 'title') {
            $converted = mb_convert_case($text, MB_CASE_TITLE, "UTF-8");
        } elseif ($mode === 'camel') {
            $words = preg_split('/\s+/u', mb_strtolower($text));
            $converted = lcfirst(implode('', array_map('ucfirst', $words)));
        } elseif ($mode === 'kebab') {
            $converted = preg_replace('/\s+/u', '-', mb_strtolower(trim($text)));
        }

        $stmt = $pdo->prepare("INSERT INTO file_jobs (user_id, tool_name, original_file, output_file, status, size_mb, processing_time_ms) VALUES (?, 'Case Converter', 'text_input.txt', 'case_converted.txt', 'done', 0.02, 10)");
        $stmt->execute([$userId]);

        echo json_encode(['success' => true, 'result' => $converted]);
        break;

    case 'spaces':
        // Replace multiple spaces or tabs with a single space
        $cleaned = preg_replace('/[ \t]+/u', ' ', $text);
        // Clean line ends
        $cleaned = preg_replace('/^[ \t]+|[ \t]+$/mu', '', $cleaned);
        // Reduce empty lines
        $cleaned = preg_replace('/\n\s*\n+/u', "\n\n", $cleaned);

        $stmt = $pdo->prepare("INSERT INTO file_jobs (user_id, tool_name, original_file, output_file, status, size_mb, processing_time_ms) VALUES (?, 'Remove Extra Spaces', 'text_input.txt', 'cleaned_spaces.txt', 'done', 0.01, 12)");
        $stmt->execute([$userId]);

        echo json_encode(['success' => true, 'result' => trim($cleaned)]);
        break;

    case 'grammar':
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => 'Grammar checking requires a configured language engine. Automatic typo substitutions are disabled.']);
        break;

    case 'plagiarism':
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => 'Plagiarism checking requires a configured source-index service. Random similarity scores are disabled.']);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Invalid text action requested.']);
}
