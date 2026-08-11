<?php
/* ==========================================================================
   GXA TOOLBOX INDEX PAGE - PHP ENGINE & SESSION BOOTSTRAP
   ========================================================================== */
require_once 'config/session.php';

define('GXA_ALLOW_DATABASE_OFFLINE', true);
require_once 'config/database.php';
$premiumTools = [];
try {
    if (!$pdo instanceof PDO) {
        throw new PDOException('Database unavailable');
    }
    $stmt = $pdo->query("SELECT id FROM tools WHERE is_premium = 1 AND id <> 'background-remover'");
    $premiumTools = $stmt->fetchAll(PDO::FETCH_COLUMN);
} catch (PDOException $e) {
    // Fallback if database query fails
    $premiumTools = [];
}
?>
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GXA Toolbox — Your Complete Digital Toolbox</title>
  <meta name="description" content="Use browser-based tools for PDFs, images, file conversions, QR codes, ZIP files, developer utilities, and everyday calculations with GXA Toolbox.">
  <meta name="theme-color" content="#2563EB">
  
  <!-- SEO & Social Media Metadata -->
  <meta property="og:title" content="GXA Toolbox — Your Complete Digital Toolbox">
  <meta property="og:description" content="Use browser-based tools for PDFs, images, file conversions, QR codes, ZIP files, developer utilities, and everyday calculations with GXA Toolbox.">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="GXA Toolbox — Your Complete Digital Toolbox">
  <meta name="twitter:description" content="Use browser-based tools for PDFs, images, file conversions, QR codes, ZIP files, developer utilities, and everyday calculations with GXA Toolbox.">
  <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
  <link rel="manifest" href="/site.webmanifest">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "GXA Toolbox",
    "alternateName": "Your Complete Digital Toolbox",
    "description": "Use browser-based tools for PDFs, images, file conversions, QR codes, ZIP files, developer utilities, and everyday calculations with GXA Toolbox.",
    "applicationCategory": "UtilitiesApplication",
    "operatingSystem": "Any",
    "brand": {
      "@type": "Brand",
      "name": "GXA Toolbox"
    },
    "publisher": {
      "@type": "Organization",
      "name": "GXA Technologies"
    }
  }
  </script>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">

  <!-- Custom Stylesheets (Routed to Assets) -->
  <link rel="stylesheet" href="/assets/style.css?v=background-remover-react-20260808">

  <!-- Core Utility Libraries (CDN) -->
  <script defer src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script defer src="https://unpkg.com/lucide@latest"></script>
</head>
<body class="light-mode">

  <script>
    // Bootstrapped PHP Session parameters loaded in JavaScript global space
    window.PHP_SESSION = {
      loggedIn: <?php echo isset($_SESSION['user_id']) ? 'true' : 'false'; ?>,
      user: <?php echo isset($_SESSION['user_id']) ? json_encode([
        'id' => $_SESSION['user_id'],
        'name' => $_SESSION['user_name'],
        'email' => $_SESSION['user_email'],
        'role' => $_SESSION['role'],
        'is_premium' => (int)$_SESSION['is_premium']
      ]) : 'null'; ?>,
      premium_tools: <?php echo json_encode($premiumTools); ?>,
      databaseOnline: <?php echo $pdo instanceof PDO ? 'true' : 'false'; ?>
    };
  </script>

  <!-- Skip Navigation for Accessibility -->
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <!-- App Wrapper -->
  <div class="app-container">
    <!-- Header / Navigation Bar -->
    <header id="navbar" class="header-nav" aria-label="GXA Toolbox primary navigation"></header>

    <!-- Main Dynamic Content Mount Point -->
    <main id="main-content" class="main-body" role="main"></main>

    <!-- Footer -->
    <footer id="footer" class="footer-nav"></footer>
  </div>

  <!-- Toast Notification Stack -->
  <div id="toast-container" class="toast-stack" aria-live="polite"></div>

  <!-- Modal/Dialog Mounting Point -->
  <div id="modal-container" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-hidden="true"></div>

  <!-- Shared file validation, preview, and processing workspace -->
  <script defer src="/assets/image-annotations.js"></script>
  <script defer src="/assets/phase-one-studios.js"></script>
  <script defer src="/assets/tool-workspace.js"></script>

  <!-- Core App Controller Script (Routed to Assets) -->
  <script defer src="/assets/app.js?v=background-remover-react-20260808"></script>
</body>
</html>
