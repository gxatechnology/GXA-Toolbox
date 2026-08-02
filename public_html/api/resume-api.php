<?php
/* ==========================================================================
   GXA TOOLBOX API - ATS RESUME GENERATION & TEMPLATE RENDERER
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

$action = $_GET['action'] ?? 'compile';

if ($action === 'compile') {
    $name = trim($data['name'] ?? '');
    $email = trim($data['email'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $location = trim($data['location'] ?? '');
    $summary = trim($data['summary'] ?? '');
    $experience = trim($data['experience'] ?? '');
    $education = trim($data['education'] ?? '');
    $skills = trim($data['skills'] ?? '');
    $templateId = trim($data['template_id'] ?? 'modern-ats');

    if (empty($name) || empty($email) || empty($summary)) {
        echo json_encode(['success' => false, 'message' => 'Please provide at least Name, Email, and Professional Summary.']);
        exit;
    }

    try {
        // Fetch layout template from database
        $stmt = $pdo->prepare("SELECT layout_html FROM resume_templates WHERE id = ?");
        $stmt->execute([$templateId]);
        $template = $stmt->fetch();

        // Fallback layout if template missing
        $layoutHtml = $template['layout_html'] ?? '
            <div style="font-family:sans-serif; padding:30px;">
                <h1>{{name}}</h1>
                <p>{{email}} | {{phone}} | {{location}}</p>
                <hr>
                <h3>Summary</h3><p>{{summary}}</p>
                <h3>Experience</h3><p>{{experience}}</p>
                <h3>Education</h3><p>{{education}}</p>
                <h3>Skills</h3><p>{{skills}}</p>
            </div>';

        // Bind variables inside templates
        $replacements = [
            '{{name}}' => htmlspecialchars($name),
            '{{email}}' => htmlspecialchars($email),
            '{{phone}}' => htmlspecialchars($phone),
            '{{location}}' => htmlspecialchars($location),
            '{{summary}}' => nl2br(htmlspecialchars($summary)),
            '{{experience}}' => nl2br(htmlspecialchars($experience)),
            '{{education}}' => nl2br(htmlspecialchars($education)),
            '{{skills}}' => nl2br(htmlspecialchars($skills))
        ];

        $outputHtml = str_replace(array_keys($replacements), array_values($replacements), $layoutHtml);

        // Save resume job in database if logged in
        $userId = $_SESSION['user_id'] ?? null;
        $jobStmt = $pdo->prepare("INSERT INTO file_jobs (user_id, tool_name, original_file, output_file, status, size_mb, processing_time_ms) VALUES (?, 'AI Resume Builder', 'resume_details.json', 'ats_resume_output.html', 'done', 0.12, 650)");
        $jobStmt->execute([$userId]);

        // Return compiled resume HTML details
        echo json_encode([
            'success' => true,
            'message' => 'Resume parsed successfully!',
            'compiledHtml' => $outputHtml,
            'fileName' => strtolower(str_replace(' ', '_', $name)) . '_resume.html'
        ]);
        exit;

    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid resume action requested.']);
