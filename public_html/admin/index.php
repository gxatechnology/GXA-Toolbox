<?php
/* ==========================================================================
   GXA TOOLBOX ADMIN DASHBOARD PORTAL - SERVER SIDE RENDERED & INTERACTIVE
   ========================================================================== */
session_start();
header('Cache-Control: private, no-store, max-age=0, must-revalidate');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow, noarchive');

// 1. Enforce admin-only verification
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role'])) {
    header('Location: /index.php');
    exit;
}
if ($_SESSION['role'] === 'developer') {
    header('Location: /developer/index.php');
    exit;
}
if ($_SESSION['role'] !== 'admin') {
    header('Location: /index.php');
    exit;
}

require_once '../config/database.php';

$adminName = $_SESSION['user_name'];
$successMessage = '';
$errorMessage = '';

// 2. Process user management updates
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    $targetUserId = intval($_POST['user_id'] ?? 0);
    
    if ($targetUserId > 0) {
        try {
            // Verify if target user is standard user
            $checkStmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
            $checkStmt->execute([$targetUserId]);
            $targetUserRole = $checkStmt->fetchColumn();

            if ($targetUserRole === 'user') {
                if ($_POST['action'] === 'toggle_premium') {
                    $isPremium = intval($_POST['is_premium'] ?? 0);
                    $updateStmt = $pdo->prepare("UPDATE users SET is_premium = ? WHERE id = ?");
                    $updateStmt->execute([$isPremium, $targetUserId]);
                    $successMessage = "Successfully updated user premium status.";
                } elseif ($_POST['action'] === 'toggle_status') {
                    $newStatus = trim($_POST['status'] ?? 'active');
                    if (in_array($newStatus, ['active', 'inactive'])) {
                        $updateStmt = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
                        $updateStmt->execute([$newStatus, $targetUserId]);
                        $successMessage = "Successfully updated user status to " . htmlspecialchars(ucfirst($newStatus));
                    }
                }
            } else {
                $errorMessage = "You are not authorized to modify this user account.";
            }
        } catch (PDOException $e) {
            $errorMessage = "Operation failed: " . $e->getMessage();
        }
    }
}

// 3. Process delete messages
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete_msg') {
    $msgId = intval($_POST['msg_id'] ?? 0);
    if ($msgId > 0) {
        try {
            $deleteStmt = $pdo->prepare("DELETE FROM contact_messages WHERE id = ?");
            $deleteStmt->execute([$msgId]);
            $successMessage = "Contact message deleted successfully.";
        } catch (PDOException $e) {
            $errorMessage = "Failed to delete message: " . $e->getMessage();
        }
    }
}

try {
    // 4. Aggregate Overview Stat Cards
    $totalUsers = intval($pdo->query("SELECT COUNT(*) FROM users WHERE role = 'user'")->fetchColumn());
    $totalJobs = intval($pdo->query("SELECT COUNT(*) FROM file_jobs")->fetchColumn());
    $totalMessages = intval($pdo->query("SELECT COUNT(*) FROM contact_messages")->fetchColumn());
    $premiumUsers = intval($pdo->query("SELECT COUNT(*) FROM users WHERE role = 'user' AND is_premium = 1")->fetchColumn());

    // AI Stats
    $totalAiCalls = intval($pdo->query("SELECT COUNT(*) FROM ai_usage_logs")->fetchColumn());
    $totalAiTokens = intval($pdo->query("SELECT SUM(prompt_tokens + completion_tokens) FROM ai_usage_logs")->fetchColumn());

    // AI Background removal stats
    $tableExists = $pdo->query("SHOW TABLES LIKE 'background_removal_jobs'")->fetch();
    $totalBgRemovals = 0;
    $todayBgRemovals = 0;
    $totalBgDownloads = 0;
    $mostActiveBgUsers = [];
    if ($tableExists) {
        $totalBgRemovals = intval($pdo->query("SELECT COUNT(*) FROM background_removal_jobs")->fetchColumn() ?? 0);
        $todayBgRemovals = intval($pdo->query("SELECT COUNT(*) FROM background_removal_jobs WHERE DATE(created_at) = CURDATE()")->fetchColumn() ?? 0);
        $totalBgDownloads = intval($pdo->query("SELECT COUNT(*) FROM background_removal_jobs WHERE status = 'done'")->fetchColumn() ?? 0);
        $mostActiveBgUsers = $pdo->query("SELECT COALESCE(u.name, 'Guest') as user_name, COALESCE(u.email, 'N/A') as user_email, COUNT(*) as count FROM background_removal_jobs j LEFT JOIN users u ON j.user_id = u.id GROUP BY j.user_id, u.name, u.email ORDER BY count DESC LIMIT 5")->fetchAll();
    }

    // 5. Gather detailed datasets
    // A. Users table (Only standard users)
    $users = $pdo->query("SELECT id, name, email, role, is_premium, status, DATE_FORMAT(created_at, '%Y-%m-%d') as created_date FROM users WHERE role = 'user' ORDER BY id DESC")->fetchAll();

    // B. Tools usage stats
    $toolsTelemetry = $pdo->query("SELECT id, name, category, use_count FROM tools ORDER BY use_count DESC")->fetchAll();

    // C. Recent file jobs history
    $jobs = $pdo->query("SELECT j.id, COALESCE(u.name, 'Guest') as user_name, COALESCE(u.email, 'N/A') as user_email, j.tool_name, j.original_file, j.output_file, j.status, j.size_mb, DATE_FORMAT(j.created_at, '%Y-%m-%d %H:%i') as created_time FROM file_jobs j LEFT JOIN users u ON j.user_id = u.id ORDER BY j.id DESC LIMIT 100")->fetchAll();

    // D. Contact support messages
    $messages = $pdo->query("SELECT id, name, email, message, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as sent_time FROM contact_messages ORDER BY id DESC")->fetchAll();

} catch (PDOException $e) {
    die("Database transaction failed: " . $e->getMessage());
}
?>
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard | GXA Toolbox</title>
  <meta name="description" content="GXA Toolbox administration dashboard.">
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
    <header class="header-nav" aria-label="GXA Toolbox admin navigation">
      <div class="container nav-container">
        <a href="/index.php" class="logo" aria-label="GXA Toolbox home" title="GXA Toolbox home">
          <div class="logo-icon" aria-hidden="true"><img src="/gxa-logo.png" alt=""></div>
          <div class="logo-text">GXA <span class="brand-suffix">Toolbox</span></div>
        </a>
        <div class="nav-actions">
          <a href="/index.php" class="btn btn-ghost btn-sm">Home</a>
          <a href="/dashboard/index.php" class="btn btn-ghost btn-sm">User Panel</a>
          <a href="/api/logout.php" class="btn btn-primary btn-sm">Sign Out</a>
        </div>
      </div>
    </header>

    <!-- Main Body Portal -->
    <main class="main-body" role="main" style="padding-top: 100px;">
      <section class="container" style="padding: 40px 0;">
        
        <!-- Action success/error notifications -->
        <?php if (!empty($successMessage)): ?>
          <div class="alert alert-success" style="margin-bottom: 20px; padding: 12px; border-radius: var(--radius-md); background-color: var(--color-accent-light); color: var(--color-accent); font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="check-circle"></i>
            <?php echo htmlspecialchars($successMessage); ?>
          </div>
        <?php endif; ?>
        <?php if (!empty($errorMessage)): ?>
          <div class="alert alert-danger" style="margin-bottom: 20px; padding: 12px; border-radius: var(--radius-md); background-color: var(--color-danger-light); color: var(--color-danger); font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="alert-triangle"></i>
            <?php echo htmlspecialchars($errorMessage); ?>
          </div>
        <?php endif; ?>

        <div class="dashboard-grid">
          <!-- Sidebar Controls -->
          <aside class="dashboard-sidebar">
            <div class="user-profile-widget">
              <div class="avatar" style="background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%);">A</div>
              <div class="user-profile-name"><?php echo htmlspecialchars($adminName); ?></div>
              <div class="user-profile-tier" style="background-color: #EDE9FE; color: #8B5CF6;">System Administrator</div>
            </div>
            <ul class="db-sidebar-menu">
              <li><a href="#overview" class="db-sidebar-link active" onclick="switchTab('overview')"><i data-lucide="layout-dashboard"></i> Overview</a></li>
              <li><a href="#users" class="db-sidebar-link" onclick="switchTab('users')"><i data-lucide="users"></i> User Directory</a></li>
              <li><a href="#telemetry" class="db-sidebar-link" onclick="switchTab('telemetry')"><i data-lucide="bar-chart-3"></i> Tool Telemetry</a></li>
              <li><a href="#jobs" class="db-sidebar-link" onclick="switchTab('jobs')"><i data-lucide="history"></i> Job Logs</a></li>
              <li><a href="#messages" class="db-sidebar-link" onclick="switchTab('messages')"><i data-lucide="mail"></i> Contact Inbox</a></li>
            </ul>
          </aside>

          <!-- Content Wrapper -->
          <div class="dashboard-content">
            <div class="db-title-bar" style="display:flex; justify-content:space-between; align-items:center;">
              <h2 class="db-title" id="page-content-title">Admin Console Overview</h2>
              <div style="font-family: var(--font-mono); font-size:12px; color: var(--color-text-secondary);">System Online</div>
            </div>

            <!-- TAB 1: OVERVIEW -->
            <div id="tab-overview" class="tab-pane">
              <!-- Stats Widget Grid -->
              <div class="db-stats-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                <div class="db-stat-card">
                  <div class="db-stat-icon" style="background-color: var(--color-primary-light); color: var(--color-primary);"><i data-lucide="users"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $totalUsers; ?></div>
                    <div class="db-stat-label">Registered Users</div>
                  </div>
                </div>

                <div class="db-stat-card">
                  <div class="db-stat-icon" style="background-color: var(--color-accent-light); color: var(--color-accent);"><i data-lucide="activity"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $totalJobs; ?></div>
                    <div class="db-stat-label">Files Processed</div>
                  </div>
                </div>

                <div class="db-stat-card">
                  <div class="db-stat-icon" style="background-color: #EDE9FE; color: #8B5CF6;"><i data-lucide="sparkles"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $premiumUsers; ?></div>
                    <div class="db-stat-label">Premium Members</div>
                  </div>
                </div>

                <div class="db-stat-card">
                  <div class="db-stat-icon" style="background-color: var(--color-warning-light); color: var(--color-warning);"><i data-lucide="mail"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $totalMessages; ?></div>
                    <div class="db-stat-label">Support Queries</div>
                  </div>
                </div>

                <div class="db-stat-card">
                  <div class="db-stat-icon" style="background-color: #E0F2FE; color: #0284C7;"><i data-lucide="sparkles"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $totalAiCalls; ?></div>
                    <div class="db-stat-label">AI Generations</div>
                  </div>
                </div>
              </div>

              <!-- Quick Summary Cards -->
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top:20px;">
                <!-- Top Tools Card -->
                <div class="db-table-card">
                  <div class="db-table-header">
                    <h3 class="db-table-title">Top Tools by Usage</h3>
                    <a href="#telemetry" onclick="switchTab('telemetry')" style="font-size:12px; font-weight:700; color:var(--color-primary); text-decoration:none;">View All</a>
                  </div>
                  <table class="db-table">
                    <thead>
                      <tr>
                        <th>Tool Name</th>
                        <th>Category</th>
                        <th>Execution Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php
                      $topTools = array_slice($toolsTelemetry, 0, 5);
                      if (empty($topTools)): ?>
                        <tr><td colspan="3" style="text-align:center;">No data available.</td></tr>
                      <?php else:
                        foreach ($topTools as $t): ?>
                          <tr>
                            <td style="font-weight:700;"><?php echo htmlspecialchars($t['name']); ?></td>
                            <td><span style="text-transform:capitalize; font-size:12px; color:var(--color-text-secondary);"><?php echo htmlspecialchars($t['category']); ?></span></td>
                            <td style="font-family:var(--font-mono); font-weight:700;"><?php echo $t['use_count']; ?></td>
                          </tr>
                        <?php endforeach;
                      endif; ?>
                    </tbody>
                  </table>
                </div>

                <!-- Inbox Preview -->
                <div class="db-table-card">
                  <div class="db-table-header">
                    <h3 class="db-table-title">Recent Customer Messages</h3>
                    <a href="#messages" onclick="switchTab('messages')" style="font-size:12px; font-weight:700; color:var(--color-primary); text-decoration:none;">View All Inbox</a>
                  </div>
                  <div style="display:flex; flex-direction:column; gap:12px; max-height: 280px; overflow-y:auto;">
                    <?php
                    $previewMsgs = array_slice($messages, 0, 3);
                    if (empty($previewMsgs)): ?>
                      <p style="text-align:center; color:var(--color-text-secondary); padding:20px;">No messages received.</p>
                    <?php else:
                      foreach ($previewMsgs as $m): ?>
                        <div style="background-color: var(--color-bg); padding:12px; border-radius:var(--radius-md); border:1px solid var(--color-border);">
                          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <strong style="font-size:13px;"><?php echo htmlspecialchars($m['name']); ?></strong>
                            <span style="font-size:10px; color:var(--color-text-muted);"><?php echo $m['sent_time']; ?></span>
                          </div>
                          <p style="font-size:12px; color:var(--color-text-secondary); overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;"><?php echo htmlspecialchars($m['message']); ?></p>
                        </div>
                      <?php endforeach;
                    endif; ?>
                  </div>
                </div>
              </div>

              <!-- AI Background Removal Statistics -->
              <div class="db-title-bar" style="margin-top: 40px; display:flex; justify-content:space-between; align-items:center;">
                <h3 class="db-title" style="font-size: 18px; margin-bottom: 0;">AI Background Removal Overview</h3>
                <span style="font-size: 11px; text-transform: uppercase; color: var(--color-accent); font-weight: 700; letter-spacing: 0.05em;">AI Power Statistics</span>
              </div>
              
              <div class="db-stats-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 15px;">
                <div class="db-stat-card">
                  <div class="db-stat-icon" style="background-color: #EDE9FE; color: #8B5CF6;"><i data-lucide="image"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $totalBgRemovals; ?></div>
                    <div class="db-stat-label">Total Bg Removals</div>
                  </div>
                </div>

                <div class="db-stat-card">
                  <div class="db-stat-icon" style="background-color: var(--color-accent-light); color: var(--color-accent);"><i data-lucide="calendar"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $todayBgRemovals; ?></div>
                    <div class="db-stat-label">Today's Removals</div>
                  </div>
                </div>

                <div class="db-stat-card">
                  <div class="db-stat-icon" style="background-color: #D1FAE5; color: #10B981;"><i data-lucide="download"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $totalBgDownloads; ?></div>
                    <div class="db-stat-label">Total Downloads</div>
                  </div>
                </div>
              </div>

              <!-- Most Active AI Users Table -->
              <div style="display:grid; grid-template-columns: 1fr; gap: 20px; margin-top:20px;">
                <div class="db-table-card">
                  <div class="db-table-header">
                    <h3 class="db-table-title">Most Active AI Background Removal Users</h3>
                  </div>
                  <table class="db-table">
                    <thead>
                      <tr>
                        <th>User Name</th>
                        <th>Email Address</th>
                        <th style="text-align:right;">Removal Operations Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php if (empty($mostActiveBgUsers)): ?>
                        <tr><td colspan="3" style="text-align:center; padding: 15px;">No AI removals logged yet.</td></tr>
                      <?php else:
                        foreach ($mostActiveBgUsers as $u): ?>
                          <tr>
                            <td style="font-weight:700;"><?php echo htmlspecialchars($u['user_name']); ?></td>
                            <td><?php echo htmlspecialchars($u['user_email']); ?></td>
                            <td style="font-family:var(--font-mono); font-weight:700; text-align:right;"><?php echo $u['count']; ?></td>
                          </tr>
                        <?php endforeach;
                      endif; ?>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            <!-- TAB 2: USER DIRECTORY -->
            <div id="tab-users" class="tab-pane" style="display:none;">
              <div class="db-table-card">
                <div class="db-table-header">
                  <h3 class="db-table-title">User Account Database</h3>
                  <span style="font-size:12px; color:var(--color-text-muted); font-weight:600;"><?php echo count($users); ?> standard users registered</span>
                </div>
                <div style="overflow-x:auto;">
                  <table class="db-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>User Profile</th>
                        <th>Email Address</th>
                        <th>Registration Date</th>
                        <th>Account Status</th>
                        <th>Premium Status</th>
                        <th>Moderate Account</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php if (empty($users)): ?>
                        <tr><td colspan="7" style="text-align:center; padding: 20px;">No standard users registered yet.</td></tr>
                      <?php else: ?>
                        <?php foreach ($users as $u): ?>
                          <tr>
                            <td style="font-family:var(--font-mono); font-size:12px;"><?php echo $u['id']; ?></td>
                            <td style="font-weight:700;"><?php echo htmlspecialchars($u['name']); ?></td>
                            <td><?php echo htmlspecialchars($u['email']); ?></td>
                            <td><?php echo $u['created_date']; ?></td>
                            <td>
                              <?php if ($u['status'] === 'active'): ?>
                                <span class="badge-history-status status-active" style="background-color: #D1FAE5; color: #10B981; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;">ACTIVE</span>
                              <?php else: ?>
                                <span class="badge-history-status status-inactive" style="background-color: #FEE2E2; color: #EF4444; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;">INACTIVE</span>
                              <?php endif; ?>
                            </td>
                            <td>
                              <?php if ($u['is_premium']): ?>
                                <span class="badge-history-status status-done" style="font-size:10px; background-color: #EDE9FE; color: #8B5CF6; padding: 4px 8px; border-radius: 4px; font-weight: 700;">PREMIUM</span>
                              <?php else: ?>
                                <span class="badge-history-status status-inactive" style="font-size:10px; background-color: #F3F4F6; color: #6B7280; padding: 4px 8px; border-radius: 4px; font-weight: 700;">STANDARD</span>
                              <?php endif; ?>
                            </td>
                            <td>
                              <div style="display:inline-flex; align-items:center; gap:8px;">
                                <!-- Status Toggle Form -->
                                <form action="" method="POST" style="display:inline-block; margin:0;">
                                  <input type="hidden" name="action" value="toggle_status">
                                  <input type="hidden" name="user_id" value="<?php echo $u['id']; ?>">
                                  <input type="hidden" name="status" value="<?php echo $u['status'] === 'active' ? 'inactive' : 'active'; ?>">
                                  <button type="submit" class="btn <?php echo $u['status'] === 'active' ? 'btn-danger' : 'btn-secondary'; ?> btn-sm" style="min-height:28px; padding: 2px 8px; font-size:11px; border-radius: var(--radius-sm);">
                                    <?php echo $u['status'] === 'active' ? 'Deactivate' : 'Activate'; ?>
                                  </button>
                                </form>
                                <!-- Premium Toggle Form -->
                                <form action="" method="POST" style="display:inline-block; margin:0;">
                                  <input type="hidden" name="action" value="toggle_premium">
                                  <input type="hidden" name="user_id" value="<?php echo $u['id']; ?>">
                                  <input type="hidden" name="is_premium" value="<?php echo $u['is_premium'] ? '0' : '1'; ?>">
                                  <button type="submit" class="btn <?php echo $u['is_premium'] ? 'btn-secondary' : 'btn-primary'; ?> btn-sm" style="min-height:28px; padding: 2px 8px; font-size:11px; border-radius: var(--radius-sm);">
                                    <?php echo $u['is_premium'] ? 'Revoke Premium' : 'Grant Premium'; ?>
                                  </button>
                                </form>
                              </div>
                            </td>
                          </tr>
                        <?php endforeach; ?>
                      <?php endif; ?>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

             <!-- TAB 3: TELEMETRY -->
            <div id="tab-telemetry" class="tab-pane" style="display:none;">
              <div class="db-table-card">
                <div class="db-table-header">
                  <h3 class="db-table-title">Tool Execution Telemetry</h3>
                  <span style="font-size:12px; color:var(--color-text-muted); font-weight:600;">Overall active registers</span>
                </div>
                <div style="overflow-x:auto;">
                  <table class="db-table">
                    <thead>
                      <tr>
                        <th>ID / Alias</th>
                        <th>Friendly Name</th>
                        <th>Category</th>
                        <th>Total Executions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php foreach ($toolsTelemetry as $t): ?>
                        <tr>
                          <td style="font-family:var(--font-mono); font-size:12px;"><?php echo htmlspecialchars($t['id']); ?></td>
                          <td style="font-weight:700;"><?php echo htmlspecialchars($t['name']); ?></td>
                          <td><span class="badge-history-status" style="font-size:10px; background-color: var(--color-primary-light); color: var(--color-primary);"><?php echo htmlspecialchars(strtoupper($t['category'])); ?></span></td>
                          <td style="font-family:var(--font-mono); font-weight:800; font-size:15px;"><?php echo $t['use_count']; ?></td>
                        </tr>
                      <?php endforeach; ?>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- TAB 4: JOB LOGS -->
            <div id="tab-jobs" class="tab-pane" style="display:none;">
              <div class="db-table-card">
                <div class="db-table-header">
                  <h3 class="db-table-title">File Job History Log</h3>
                  <span style="font-size:12px; color:var(--color-text-muted); font-weight:600;">Showing last 100 entries</span>
                </div>
                <div style="overflow-x:auto;">
                  <table class="db-table">
                    <thead>
                      <tr>
                        <th>Job ID</th>
                        <th>User Details</th>
                        <th>Applied Utility</th>
                        <th>Input File</th>
                        <th>Output Result</th>
                        <th>Size</th>
                        <th>Status</th>
                        <th>Processed Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php if (empty($jobs)): ?>
                        <tr>
                          <td colspan="8" style="text-align:center; padding:30px; color:var(--color-text-secondary);">No processing logs exist.</td>
                        </tr>
                      <?php else: ?>
                        <?php foreach ($jobs as $j): ?>
                          <tr>
                            <td style="font-family:var(--font-mono); font-size:12px;"><?php echo $j['id']; ?></td>
                            <td>
                              <div style="font-weight:700;"><?php echo htmlspecialchars($j['user_name']); ?></div>
                              <div style="font-size:10px; color:var(--color-text-muted);"><?php echo htmlspecialchars($j['user_email']); ?></div>
                            </td>
                            <td><strong style="color:var(--color-primary);"><?php echo htmlspecialchars($j['tool_name']); ?></strong></td>
                            <td style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:var(--font-mono); font-size:11px;" title="<?php echo htmlspecialchars($j['original_file']); ?>"><?php echo htmlspecialchars($j['original_file']); ?></td>
                            <td style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:var(--font-mono); font-size:11px;" title="<?php echo htmlspecialchars($j['output_file']); ?>"><?php echo htmlspecialchars($j['output_file']); ?></td>
                            <td style="font-family:var(--font-mono); font-size:12px;"><?php echo $j['size_mb']; ?> MB</td>
                            <td>
                              <span class="badge-history-status status-<?php echo ($j['status'] === 'done') ? 'done' : 'fail'; ?>">
                                <?php echo htmlspecialchars(strtoupper($j['status'])); ?>
                              </span>
                            </td>
                            <td style="font-size:12px; color:var(--color-text-secondary);"><?php echo $j['created_time']; ?></td>
                          </tr>
                        <?php endforeach; ?>
                      <?php endif; ?>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- TAB 5: CONTACT INBOX -->
            <div id="tab-messages" class="tab-pane" style="display:none;">
              <div class="db-table-card">
                <div class="db-table-header">
                  <h3 class="db-table-title">Customer Support Queries</h3>
                  <span style="font-size:12px; color:var(--color-text-muted); font-weight:600;"><?php echo count($messages); ?> contact records</span>
                </div>
                <div style="overflow-x:auto;">
                  <table class="db-table">
                    <thead>
                      <tr>
                        <th>Sender Name</th>
                        <th>Email Link</th>
                        <th>Sent Time</th>
                        <th>Message Narrative</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php if (empty($messages)): ?>
                        <tr>
                          <td colspan="5" style="text-align:center; padding:30px; color:var(--color-text-secondary);">No support tickets or feedback messages received yet.</td>
                        </tr>
                      <?php else: ?>
                        <?php foreach ($messages as $m): ?>
                          <tr>
                            <td style="font-weight:700; white-space:nowrap;"><?php echo htmlspecialchars($m['name']); ?></td>
                            <td><a href="mailto:<?php echo htmlspecialchars($m['email']); ?>" style="color:var(--color-primary); text-decoration:none;"><?php echo htmlspecialchars($m['email']); ?></a></td>
                            <td style="font-size:12px; color:var(--color-text-secondary); white-space:nowrap;"><?php echo $m['sent_time']; ?></td>
                            <td style="font-size:13px; line-height:1.4; color:var(--color-text-secondary); min-width:280px; max-width:400px; word-wrap:break-word;"><?php echo nl2br(htmlspecialchars($m['message'])); ?></td>
                            <td>
                              <form action="" method="POST" onsubmit="return confirm('Are you sure you want to delete this message record?');">
                                <input type="hidden" name="action" value="delete_msg">
                                <input type="hidden" name="msg_id" value="<?php echo $m['id']; ?>">
                                <button type="submit" class="btn btn-danger btn-sm" style="min-height:28px; padding: 2px 8px; font-size:11px; border-radius: var(--radius-sm);"><i data-lucide="trash-2" style="width:12px; height:12px;"></i> Delete</button>
                              </form>
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
          <div class="footer-copy">&copy; <?php echo date('Y'); ?> GXA Technologies. All rights reserved. GXA Toolbox administration console.</div>
        </div>
      </div>
    </footer>
  </div>

  <script>
    // Lucide icons initialization
    lucide.createIcons();

    // Responsive navigation tab toggler
    function switchTab(tabId) {
        // Toggle menu active statuses
        const links = document.querySelectorAll('.db-sidebar-link');
        links.forEach(link => {
            if (link.getAttribute('href') === '#' + tabId || link.getAttribute('onclick').includes(tabId)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Hide all panels
        const panes = document.querySelectorAll('.tab-pane');
        panes.forEach(pane => {
            pane.style.display = 'none';
        });

        // Show targets
        const activePane = document.getElementById('tab-' + tabId);
        if (activePane) {
            activePane.style.display = 'block';
        }

        // Set title header dynamically
        const titles = {
            'overview': 'Admin Console Overview',
            'users': 'User Accounts Management',
            'telemetry': 'Tool Telemetry Logs',
            'jobs': 'File Job Processing History',
            'messages': 'Support Mailbox Messages'
        };
        document.getElementById('page-content-title').innerText = titles[tabId] || 'Admin Dashboard';
    }

    // Direct routing setup via URL anchors on load
    window.addEventListener('DOMContentLoaded', () => {
        const hash = window.location.hash.substring(1);
        if (hash && ['overview', 'users', 'telemetry', 'jobs', 'messages'].includes(hash)) {
            switchTab(hash);
        }
    });
  </script>
</body>
</html>
