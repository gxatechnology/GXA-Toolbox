<?php
/* ==========================================================================
   GXA TOOLBOX USER PORTAL DASHBOARD - SERVER SIDE RENDERED
   ========================================================================== */
session_start();
header('Cache-Control: private, no-store, max-age=0, must-revalidate');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow, noarchive');

// Redirect to index page login form if session is not active
if (!isset($_SESSION['user_id'])) {
    header('Location: /index.php');
    exit;
}

require_once '../config/database.php';

$userId = intval($_SESSION['user_id']);
$userName = $_SESSION['user_name'];
$userRole = $_SESSION['role'];
$isPremium = (int)$_SESSION['is_premium'];

try {
    // 1. Fetch real processing totals by recorded status
    $countStmt = $pdo->prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status <> 'done' THEN 1 ELSE 0 END) as failed FROM file_jobs WHERE user_id = ?");
    $countStmt->execute([$userId]);
    $jobTotals = $countStmt->fetch();
    $totalFiles = intval($jobTotals['total'] ?? 0);
    $completedFiles = intval($jobTotals['completed'] ?? 0);
    $failedFiles = intval($jobTotals['failed'] ?? 0);

    // 2. Fetch the real recorded file volume (this is not a storage-savings claim)
    $sizeStmt = $pdo->prepare("SELECT SUM(size_mb) as total_size FROM file_jobs WHERE user_id = ?");
    $sizeStmt->execute([$userId]);
    $storageSum = floatval($sizeStmt->fetch()['total_size'] ?? 0.00);
    $processedVolumeStr = number_format($storageSum, 2) . " MB";

    // 3. Fetch recent tools used (distinct)
    $toolsStmt = $pdo->prepare("SELECT DISTINCT tool_name FROM file_jobs WHERE user_id = ? ORDER BY id DESC LIMIT 5");
    $toolsStmt->execute([$userId]);
    $recentTools = $toolsStmt->fetchAll();

    // 4. Fetch complete processing history log
    $historyStmt = $pdo->prepare("SELECT original_file as name, tool_name as tool, DATE_FORMAT(created_at, '%Y-%m-%d') as date, CONCAT(size_mb, ' MB') as size, status FROM file_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50");
    $historyStmt->execute([$userId]);
    $historyLogs = $historyStmt->fetchAll();

    // 5. Gather chart coordinates for monthly aggregates
    $chartStmt = $pdo->prepare("SELECT MONTHNAME(created_at) as month, COUNT(*) as count FROM file_jobs WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 5 MONTH) GROUP BY MONTH(created_at) ORDER BY MONTH(created_at) ASC");
    $chartStmt->execute([$userId]);
    $chartData = $chartStmt->fetchAll();
    $chartMax = 1;
    foreach ($chartData as $chartRow) {
        $chartMax = max($chartMax, intval($chartRow['count']));
    }

} catch (PDOException $e) {
    die("Database transaction failed: " . $e->getMessage());
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>User Dashboard | GXA Toolbox</title>
  <meta name="description" content="Manage your GXA Toolbox account, processing history, and tool access.">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="theme-color" content="#2563EB">
  <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/style.css">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body class="light-mode">

  <div class="app-container">
    <!-- Navbar Header -->
    <header class="header-nav" aria-label="GXA Toolbox dashboard navigation">
      <div class="container nav-container">
        <a href="/index.php" class="logo" aria-label="GXA Toolbox home" title="GXA Toolbox home">
          <div class="logo-icon" aria-hidden="true"><img src="/gxa-logo.png" alt=""></div>
          <div class="logo-text">GXA <span class="brand-suffix">Toolbox</span></div>
        </a>
        <div class="nav-actions">
          <button type="button" id="dashboard-theme-toggle" class="btn-icon-nav" aria-label="Toggle dark mode"><i data-lucide="moon"></i></button>
          <a href="/index.php" class="btn btn-ghost btn-sm">Home</a>
          <a href="/api/logout.php" class="btn btn-primary btn-sm">Sign Out</a>
        </div>
      </div>
    </header>

    <!-- Main Body Portal -->
    <main class="main-body" role="main" style="padding-top: 100px;">
      <section class="container premium-dashboard" style="padding: 40px 0;">
        <div class="dashboard-grid">
          <!-- Sidebar Nav -->
          <aside class="dashboard-sidebar">
            <div class="user-profile-widget">
              <div class="avatar"><?php echo strtoupper(substr($userName, 0, 1)); ?></div>
              <div class="user-profile-name"><?php echo htmlspecialchars($userName); ?></div>
              <div class="user-profile-tier"><?php echo $isPremium ? 'Premium' : 'Standard'; ?> Account</div>
            </div>
            <ul class="db-sidebar-menu">
              <li><a href="#overview" class="db-sidebar-link active" onclick="switchTab('overview')"><i data-lucide="layout-dashboard"></i> Overview</a></li>
              <li><a href="/index.php" class="db-sidebar-link"><i data-lucide="home"></i> Home Utilities</a></li>
              <li><a href="/api/logout.php" class="db-sidebar-link"><i data-lucide="log-out"></i> Logout</a></li>
            </ul>
          </aside>

          <!-- Main Dashboard Content -->
          <div class="dashboard-content">
            <div class="db-heading-row">
              <div><span class="section-kicker">Your workspace</span><h1 class="db-title" id="db-content-title">Welcome back, <?php echo htmlspecialchars($userName); ?>!</h1><p>Review your recorded processing activity and return to your tools.</p></div>
              <a href="/index.php#tools-grid-anchor" class="btn btn-primary"><i data-lucide="plus"></i> New task</a>
            </div>

            <!-- TAB 1: OVERVIEW -->
            <div id="tab-overview" class="tab-pane">
              <!-- Account Status overview banner -->
              <div class="db-table-card" style="padding: 24px; margin-bottom: 24px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
                  <div>
                    <h3 style="font-size:18px; font-weight:700; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                      <i data-lucide="<?php echo $isPremium ? 'shield-check' : 'shield'; ?>" style="color:<?php echo $isPremium ? '#8B5CF6' : 'var(--color-text-secondary)'; ?>;"></i> 
                      Account Tier: <?php echo $isPremium ? 'Premium Member' : 'Standard Free Member'; ?>
                    </h3>
                    <p style="font-size:13px; color:var(--color-text-secondary); margin:0;">
                      <?php if ($isPremium): ?>
                        Access to all enabled premium utilities and higher processing thresholds. Thank you for using GXA Toolbox.
                      <?php else: ?>
                        Access to all standard utilities. Some premium tools are locked; contact the administrator to request access.
                      <?php endif; ?>
                    </p>
                  </div>
                  <div>
                    <span style="font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: var(--radius-pill); text-transform: uppercase; letter-spacing: 0.05em; background-color: <?php echo $isPremium ? '#EDE9FE; color: #8B5CF6;' : 'var(--color-border); color: var(--color-text-secondary);'; ?>">
                      <?php echo $isPremium ? 'Premium Access Active' : 'Standard Tier'; ?>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Stats widgets -->
              <div class="db-stats-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                <div class="db-stat-card">
                  <div class="db-stat-icon"><i data-lucide="files"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $completedFiles; ?></div>
                    <div class="db-stat-label">Completed Jobs</div>
                  </div>
                </div>

                <div class="db-stat-card">
                  <div class="db-stat-icon"><i data-lucide="hard-drive"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $processedVolumeStr; ?></div>
                    <div class="db-stat-label">Recorded File Volume</div>
                  </div>
                </div>

                <div class="db-stat-card">
                  <div class="db-stat-icon"><i data-lucide="circle-alert"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $failedFiles; ?></div>
                    <div class="db-stat-label">Failed Jobs</div>
                  </div>
                </div>
              </div>

              <div class="db-quick-grid" aria-label="Dashboard shortcuts">
                <div class="db-table-card db-quick-panel">
                  <div class="db-panel-heading"><div><span class="section-kicker">Shortcuts</span><h3>Quick actions</h3></div><i data-lucide="zap"></i></div>
                  <div class="db-quick-actions">
                    <a href="/index.php#tool-merge-pdf"><i data-lucide="files"></i><span>Merge PDF</span></a>
                    <a href="/index.php#tool-compress-image"><i data-lucide="image-down"></i><span>Compress image</span></a>
                    <a href="/index.php#tool-qr-generator"><i data-lucide="qr-code"></i><span>Create QR</span></a>
                  </div>
                </div>
                <div class="db-table-card db-quick-panel">
                  <div class="db-panel-heading"><div><span class="section-kicker">Saved locally</span><h3>Pinned tools</h3></div><i data-lucide="pin"></i></div>
                  <div id="dashboard-pinned-tools" class="db-pinned-tools"><p>No pinned tools yet. Favorite a tool to keep it here.</p></div>
                </div>
              </div>

              <!-- Dashboard Analytics Chart -->
              <div class="db-chart-card" style="margin-top:20px;">
                <div class="db-chart-header">Monthly Volume (Files Processed)</div>
                <div class="mock-chart-container" style="display:flex; justify-content:space-around; align-items:flex-end; height:180px; padding-top:20px; border-bottom:1px solid var(--color-border);">
                  <?php if (empty($chartData)): ?>
                    <div style="width: 100%; text-align: center; color: var(--color-text-secondary); margin-bottom: 50px;">No processing actions logged for chart analytics.</div>
                  <?php else: ?>
                    <?php foreach ($chartData as $data): ?>
                      <?php
                        $height = min(100, max(8, ($data['count'] / $chartMax) * 100));
                      ?>
                      <div class="mock-chart-bar" style="height: <?php echo $height; ?>%; width:40px; background:var(--color-primary); border-radius: 4px 4px 0 0; position:relative; display:flex; justify-content:center;">
                        <span class="mock-chart-val" style="position:absolute; top:-20px; font-size:11px; font-weight:700; color:var(--color-text-primary);"><?php echo $data['count']; ?></span>
                        <span class="mock-chart-label" style="position:absolute; bottom:-24px; font-size:10px; color:var(--color-text-secondary); white-space:nowrap;"><?php echo htmlspecialchars(substr($data['month'], 0, 3)); ?></span>
                      </div>
                    <?php endforeach; ?>
                  <?php endif; ?>
                </div>
              </div>

              <!-- Recent Tools List widget -->
              <div class="db-table-card" style="margin-top:20px; margin-bottom:20px; padding:20px;">
                <h3 class="db-table-title" style="margin-bottom:12px;">Recent Tools Used</h3>
                <?php if (empty($recentTools)): ?>
                  <p style="color:var(--color-text-secondary); font-size:13px;">No tools run recently.</p>
                <?php else: ?>
                  <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <?php foreach ($recentTools as $rt): ?>
                      <span class="badge-history-status status-done" style="padding: 6px 12px; font-size:12px; background:var(--color-primary-light); color:var(--color-primary); font-weight:700; border-radius:var(--radius-pill);">
                        <?php echo htmlspecialchars($rt['tool_name']); ?>
                      </span>
                    <?php endforeach; ?>
                  </div>
                <?php endif; ?>
              </div>

              <!-- Processing History Log -->
              <div class="db-table-card">
                <div class="db-table-header">
                  <h3 class="db-table-title">Recent Activity Log</h3>
                </div>
                <div class="db-table-wrapper" style="overflow-x:auto;">
                  <table class="db-table">
                    <thead>
                      <tr>
                        <th>Filename</th>
                        <th>Tool</th>
                        <th>Date</th>
                        <th>Size</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php if (empty($historyLogs)): ?>
                        <tr>
                          <td colspan="5" style="text-align:center; padding:30px; color:var(--color-text-secondary);">
                            No files processed yet. Try running some tools on the Home page first!
                          </td>
                        </tr>
                      <?php else: ?>
                        <?php foreach ($historyLogs as $row): ?>
                          <tr>
                            <td style="font-weight:700; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><?php echo htmlspecialchars($row['name']); ?></td>
                            <td><?php echo htmlspecialchars($row['tool']); ?></td>
                            <td><?php echo $row['date']; ?></td>
                            <td><?php echo $row['size']; ?></td>
                            <td>
                              <span class="badge-history-status status-<?php echo ($row['status'] === 'done') ? 'done' : 'fail'; ?>">
                                <?php echo strtoupper($row['status']); ?>
                              </span>
                            </td>
                          </tr>
                        <?php endforeach; ?>
                      <?php endif; ?>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="footer-nav">
      <div class="container">
        <div class="footer-bottom">
          <div class="footer-copy">&copy; <?php echo date('Y'); ?> GXA Technologies. All rights reserved. GXA Toolbox is a product of GXA Technologies.</div>
        </div>
      </div>
    </footer>
  </div>

  <script>
    const dashboardThemeKey = 'gxa-toolbox_theme';
    const dashboardTheme = localStorage.getItem(dashboardThemeKey) || 'light';
    document.body.classList.toggle('dark-mode', dashboardTheme === 'dark');
    document.body.classList.toggle('light-mode', dashboardTheme !== 'dark');
    const dashboardThemeToggle = document.getElementById('dashboard-theme-toggle');
    const dashboardToolLabels = {
      'merge-pdf': 'Merge PDF', 'organize-pdf': 'Organize PDF', 'compress-image': 'Compress Image',
      'resize-image': 'Resize Image', 'crop-image': 'Crop Image', 'background-remover': 'Background Remover',
      'qr-generator': 'QR Generator', 'json-tool': 'JSON Formatter', 'password-generator': 'Password Generator',
      'calculator': 'Simple Calculator', 'scientific-calculator': 'Scientific Calculator', 'zip-manager': 'ZIP Manager'
    };
    function renderDashboardPinnedTools() {
      const mount = document.getElementById('dashboard-pinned-tools');
      let favorites = [];
      try { favorites = JSON.parse(localStorage.getItem('gxa-toolbox_favorites') || '[]'); } catch (error) { favorites = []; }
      if (!Array.isArray(favorites) || !favorites.length) return;
      mount.replaceChildren(...favorites.slice(0, 5).map(toolId => {
        const link = document.createElement('a');
        link.href = '/index.php#tool-' + encodeURIComponent(toolId);
        link.textContent = dashboardToolLabels[toolId] || toolId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        return link;
      }));
    }
    function syncDashboardThemeIcon() {
      const dark = document.body.classList.contains('dark-mode');
      dashboardThemeToggle.innerHTML = `<i data-lucide="${dark ? 'sun' : 'moon'}"></i>`;
      dashboardThemeToggle.setAttribute('aria-label', dark ? 'Use light mode' : 'Use dark mode');
      lucide.createIcons();
    }
    dashboardThemeToggle.addEventListener('click', () => {
      const dark = !document.body.classList.contains('dark-mode');
      document.body.classList.toggle('dark-mode', dark);
      document.body.classList.toggle('light-mode', !dark);
      localStorage.setItem(dashboardThemeKey, dark ? 'dark' : 'light');
      syncDashboardThemeIcon();
    });
    syncDashboardThemeIcon();
    renderDashboardPinnedTools();
    lucide.createIcons();

    // Tab Switcher for User Portal
    function switchTab(tabId) {
        // Toggle menu active status
        const links = document.querySelectorAll('.db-sidebar-link');
        links.forEach(link => {
            if (link.getAttribute('href') === '#' + tabId || link.getAttribute('onclick').includes(tabId)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Hide all panes
        const panes = document.querySelectorAll('.tab-pane');
        panes.forEach(pane => {
            pane.style.display = 'none';
        });

        // Show selected pane
        const activePane = document.getElementById('tab-' + tabId);
        if (activePane) {
            activePane.style.display = 'block';
        }

        // Set subtitle or custom layout header
        const baseTitle = "Welcome back, <?php echo htmlspecialchars($userName); ?>!";
        document.getElementById('db-content-title').innerText = baseTitle;
    }

    // Direct routing setup via anchors
    window.addEventListener('DOMContentLoaded', () => {
        const hash = window.location.hash.substring(1);
        if (hash && ['overview'].includes(hash)) {
            switchTab(hash);
        }
    });
  </script>
</body>
</html>
