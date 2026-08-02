<?php
/* ========================================================================== 
   GXA TOOLBOX API - AI SERVICE AVAILABILITY GATE
   ========================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'POST is required.']);
    exit;
}

/*
 * The previous endpoint returned invented summaries and translations when no
 * provider was configured. It also sent only a filename to the provider, not
 * the document contents. That behavior has been removed. Keep this explicit
 * dependency response until a real, consent-aware document extraction and AI
 * provider pipeline is configured and tested.
 */
http_response_code(503);
echo json_encode([
    'success' => false,
    'code' => 'AI_PROVIDER_NOT_CONFIGURED',
    'message' => 'AI document processing is unavailable. A configured provider and a real document-content extraction pipeline are required.'
]);
