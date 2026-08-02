<?php
/* ==========================================================================
   GXA TOOLBOX API - BACKGROUND REMOVER PROCESSOR
   ========================================================================== */

header('Content-Type: application/json; charset=utf-8');
session_start();

define('GXA_ALLOW_DATABASE_OFFLINE', true);
require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$file = $_FILES['file'] ?? null;
if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'No image file uploaded or upload error occurred.']);
    exit;
}
if ($file['size'] <= 0 || $file['size'] > 20 * 1024 * 1024) {
    echo json_encode(['success' => false, 'message' => 'Image must be between 1 byte and 20 MB.']);
    exit;
}

// 1. Establish directory paths
$uploadDir = '../uploads/background-remover/';
$outputDir = '../outputs/background-remover/';

if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}
if (!file_exists($outputDir)) {
    mkdir($outputDir, 0777, true);
}

// 2. File metadata validation
$originalName = basename($file['name']);
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$allowedExts = ['jpg', 'jpeg', 'png', 'webp'];

if (!in_array($extension, $allowedExts)) {
    echo json_encode(['success' => false, 'message' => 'Invalid image format. Supported formats: JPG, PNG, WEBP.']);
    exit;
}
$detectedType = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
if (!in_array($detectedType, $allowedTypes, true)) {
    echo json_encode(['success' => false, 'message' => 'The uploaded file is not a supported image.']);
    exit;
}

$uniqId = time() . '_' . bin2hex(random_bytes(4));
$savedInputPath = $uploadDir . $uniqId . '.' . $extension;
$outputFileName = 'bgremoved_' . $uniqId . '.png';
$savedOutputPath = $outputDir . $outputFileName;

if (!move_uploaded_file($file['tmp_name'], $savedInputPath)) {
    echo json_encode(['success' => false, 'message' => 'Failed to store uploaded input file.']);
    exit;
}

// 3. GD background removal logic
$processedSuccessfully = false;

list($width, $height, $type) = getimagesize($savedInputPath);
$img = null;

switch ($type) {
    case IMAGETYPE_JPEG:
        $img = @imagecreatefromjpeg($savedInputPath);
        break;
    case IMAGETYPE_PNG:
        $img = @imagecreatefrompng($savedInputPath);
        break;
    case IMAGETYPE_WEBP:
        $img = @imagecreatefromwebp($savedInputPath);
        break;
}

if ($img) {
    // Create new transparent output canvas
    $newImg = imagecreatetruecolor($width, $height);
    imagealphablending($newImg, false);
    imagesavealpha($newImg, true);
    
    $transparentColor = imagecolorallocatealpha($newImg, 0, 0, 0, 127);
    imagefill($newImg, 0, 0, $transparentColor);
    
    // Pixel scanning: loop pixels and make near-white colors transparent
    for ($x = 0; $x < $width; $x++) {
        for ($y = 0; $y < $height; $y++) {
            $rgb = imagecolorat($img, $x, $y);
            $r = ($rgb >> 16) & 0xFF;
            $g = ($rgb >> 8) & 0xFF;
            $b = $rgb & 0xFF;
            
            // Threshold: if r, g, b are all above 215, make transparent
            if ($r > 215 && $g > 215 && $b > 215) {
                imagesetpixel($newImg, $x, $y, $transparentColor);
            } else {
                $color = imagecolorallocatealpha($newImg, $r, $g, $b, 0);
                imagesetpixel($newImg, $x, $y, $color);
            }
        }
    }
    
    $processedSuccessfully = imagepng($newImg, $savedOutputPath);
    imagedestroy($img);
    imagedestroy($newImg);
}

if (!$processedSuccessfully) {
    echo json_encode(['success' => false, 'message' => 'Background removal could not be completed. Verify that PHP GD supports this image format and try another file.']);
    exit;
}

// 4. Calculate output parameters
$outputSize = round(filesize($savedOutputPath) / (1024 * 1024), 2);
if ($outputSize < 0.01) {
    $outputSize = 0.01;
}

$outputUrl = '/outputs/background-remover/' . $outputFileName;
$userId = $_SESSION['user_id'] ?? null;

if ($pdo instanceof PDO) {
  try {
    // A. Log to background_removal_jobs table
    $stmt1 = $pdo->prepare("INSERT INTO background_removal_jobs (user_id, original_file, output_file, file_size, status) VALUES (?, ?, ?, ?, 'done')");
    $stmt1->execute([$userId, $originalName, $outputUrl, $outputSize]);
    
    // B. Log to general file_jobs table (recent activity)
    $stmt2 = $pdo->prepare("INSERT INTO file_jobs (user_id, tool_name, original_file, output_file, status, size_mb, processing_time_ms) VALUES (?, 'Background Remover', ?, ?, 'done', ?, 1150)");
    $stmt2->execute([$userId, $originalName, $outputFileName, $outputSize]);
    
    // C. Update tool execution usage counts
    $stmt3 = $pdo->prepare("UPDATE tools SET use_count = use_count + 1 WHERE id = 'background-remover'");
    $stmt3->execute();

  } catch (PDOException $e) {
      // Processing succeeded; database activity logging is optional and never exposed publicly.
  }
}

echo json_encode([
    'success' => true,
    'output_url' => $outputUrl,
    'output_filename' => $outputFileName,
    'file_size' => $outputSize
]);
