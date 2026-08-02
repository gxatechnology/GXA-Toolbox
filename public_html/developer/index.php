<?php
/* ==========================================================================
   GXA TOOLBOX DEVELOPER DASHBOARD PORTAL - SERVER SIDE SUPER-ADMIN
   ========================================================================== */
session_start();

// 1. Enforce super-admin developer role verification
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'developer') {
    header('Location: /index.php');
    exit;
}

require_once '../config/database.php';

$developerName = $_SESSION['user_name'];
$developerId = intval($_SESSION['user_id']);
$successMessage = '';
$errorMessage = '';

// 2. Process Super-Admin actions
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    $action = $_POST['action'];
    
    // Action: Toggle Premium Status of User
    if ($action === 'toggle_premium') {
        $targetUserId = intval($_POST['user_id'] ?? 0);
        $isPremium = intval($_POST['is_premium'] ?? 0);
        if ($targetUserId > 0) {
            try {
                $stmt = $pdo->prepare("UPDATE users SET is_premium = ? WHERE id = ?");
                $stmt->execute([$isPremium, $targetUserId]);
                $successMessage = "Successfully updated user premium access.";
            } catch (PDOException $e) {
                $errorMessage = "Failed to update premium access: " . $e->getMessage();
            }
        }
    }
    
    // Action: Toggle User Active/Inactive Status
    if ($action === 'toggle_status') {
        $targetUserId = intval($_POST['user_id'] ?? 0);
        $newStatus = trim($_POST['status'] ?? 'active');
        if ($targetUserId > 0 && in_array($newStatus, ['active', 'inactive'])) {
            try {
                // Prevent deactivating self
                if ($targetUserId === $developerId) {
                    $errorMessage = "You cannot deactivate your own account.";
                } else {
                    $stmt = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
                    $stmt->execute([$newStatus, $targetUserId]);
                    $successMessage = "Successfully updated user status to " . htmlspecialchars(ucfirst($newStatus));
                }
            } catch (PDOException $e) {
                $errorMessage = "Failed to update status: " . $e->getMessage();
            }
        }
    }

    // Action: Delete User Account
    if ($action === 'delete_user') {
        $targetUserId = intval($_POST['user_id'] ?? 0);
        if ($targetUserId > 0) {
            try {
                if ($targetUserId === $developerId) {
                    $errorMessage = "You cannot delete your own account.";
                } else {
                    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
                    $stmt->execute([$targetUserId]);
                    $successMessage = "User account deleted successfully.";
                }
            } catch (PDOException $e) {
                $errorMessage = "Failed to delete user: " . $e->getMessage();
            }
        }
    }

    // Action: Create User/Admin Account
    if ($action === 'create_user') {
        $name = trim($_POST['name'] ?? '');
        $email = trim($_POST['email'] ?? '');
        $password = trim($_POST['password'] ?? '');
        $role = trim($_POST['role'] ?? 'user');
        
        if (!empty($name) && !empty($email) && !empty($password) && in_array($role, ['admin', 'user'])) {
            try {
                // Email uniqueness validation
                $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
                $stmt->execute([$email]);
                if ($stmt->fetch()) {
                    $errorMessage = "This email address is already registered.";
                } else {
                    $hashed = password_hash($password, PASSWORD_BCRYPT);
                    // Standard insertion
                    $insert = $pdo->prepare("INSERT INTO users (name, email, password, role, is_premium, status) VALUES (?, ?, ?, ?, ?, 'active')");
                    $insert->execute([$name, $email, $hashed, $role, ($role === 'admin' ? 1 : 0)]);
                    $successMessage = "Successfully created new " . htmlspecialchars($role) . " account.";
                }
            } catch (PDOException $e) {
                $errorMessage = "Failed to create user: " . $e->getMessage();
            }
        } else {
            $errorMessage = "Please fill in all user creation fields.";
        }
    }

    // Action: Reset User Password
    if ($action === 'reset_password') {
        $targetUserId = intval($_POST['user_id'] ?? 0);
        $newPassword = trim($_POST['password'] ?? '');
        if ($targetUserId > 0 && strlen($newPassword) >= 6) {
            try {
                $hashed = password_hash($newPassword, PASSWORD_BCRYPT);
                $stmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
                $stmt->execute([$hashed, $targetUserId]);
                $successMessage = "Successfully reset user password.";
            } catch (PDOException $e) {
                $errorMessage = "Failed to reset password: " . $e->getMessage();
            }
        } else {
            $errorMessage = "Password must be at least 6 characters.";
        }
    }

    // Action: Toggle dynamic tool premium gating
    if ($action === 'toggle_tool_premium') {
        $toolId = trim($_POST['tool_id'] ?? '');
        $isPremium = intval($_POST['is_premium'] ?? 0);
        if (!empty($toolId)) {
            try {
                $stmt = $pdo->prepare("UPDATE tools SET is_premium = ? WHERE id = ?");
                $stmt->execute([$isPremium, $toolId]);
                $successMessage = "Successfully updated tool premium status.";
            } catch (PDOException $e) {
                $errorMessage = "Failed to update tool premium: " . $e->getMessage();
            }
        }
    }

    // Action: Delete Contact message
    if ($action === 'delete_msg') {
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
}

try {
    // 3. Aggregate Overview Stats
    $totalUsers = intval($pdo->query("SELECT COUNT(*) FROM users")->fetchColumn());
    $adminUsers = intval($pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn());
    $premiumUsers = intval($pdo->query("SELECT COUNT(*) FROM users WHERE is_premium = 1")->fetchColumn());
    $totalJobs = intval($pdo->query("SELECT COUNT(*) FROM file_jobs")->fetchColumn());
    $totalMessages = intval($pdo->query("SELECT COUNT(*) FROM contact_messages")->fetchColumn());

    // 4. Gather detailed datasets
    // A. All Users
    $users = $pdo->query("SELECT id, name, email, role, is_premium, status, DATE_FORMAT(created_at, '%Y-%m-%d') as created_date FROM users ORDER BY id DESC")->fetchAll();

    // B. Tools table
    $tools = $pdo->query("SELECT id, name, category, use_count, is_premium FROM tools ORDER BY category, name")->fetchAll();

    // C. Recent user activity feed
    $recentActivity = $pdo->query("SELECT name, email, role, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as created_time FROM users ORDER BY id DESC LIMIT 5")->fetchAll();

    // D. Support mailbox messages
    $messages = $pdo->query("SELECT id, name, email, message, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as sent_time FROM contact_messages ORDER BY id DESC")->fetchAll();

    // E. System settings calculation
    $gdSupport = extension_loaded('gd') ? 'Installed (v' . (gd_info()['GD Version'] ?? 'Unknown') . ')' : 'Not Installed';
    $uploadDirSize = 0;
    $processedDirSize = 0;
    
    if (is_dir('../uploads')) {
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator('../uploads')) as $file) {
            if ($file->isFile()) $uploadDirSize += $file->getSize();
        }
    }
    if (is_dir('../processed')) {
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator('../processed')) as $file) {
            if ($file->isFile()) $processedDirSize += $file->getSize();
        }
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
  <title>Developer Portal | GXA Toolbox</title>
  <meta name="description" content="GXA Toolbox developer management portal.">
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
    <header class="header-nav" aria-label="GXA Toolbox developer navigation">
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
        
        <!-- Action notifications -->
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
              <div class="avatar" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%);">D</div>
              <div class="user-profile-name"><?php echo htmlspecialchars($developerName); ?></div>
              <div class="user-profile-tier" style="background-color: #D1FAE5; color: #059669;">Developer Super-Admin</div>
            </div>
            <ul class="db-sidebar-menu">
              <li><a href="#overview" class="db-sidebar-link active" onclick="switchTab('overview')"><i data-lucide="layout-dashboard"></i> Overview</a></li>
              <li><a href="#users" class="db-sidebar-link" onclick="switchTab('users')"><i data-lucide="users"></i> User Accounts</a></li>
              <li><a href="#tools" class="db-sidebar-link" onclick="switchTab('tools')"><i data-lucide="sliders"></i> Premium Tools</a></li>
              <li><a href="#settings" class="db-sidebar-link" onclick="switchTab('settings')"><i data-lucide="settings"></i> System Settings</a></li>
              <li><a href="#messages" class="db-sidebar-link" onclick="switchTab('messages')"><i data-lucide="mail"></i> Contact Inbox</a></li>
            </ul>
          </aside>

          <!-- Content Wrapper -->
          <div class="dashboard-content">
            <div class="db-title-bar" style="display:flex; justify-content:space-between; align-items:center;">
              <h2 class="db-title" id="page-content-title">Developer Console Overview</h2>
              <div style="font-family: var(--font-mono); font-size:12px; color: var(--color-text-secondary);">Super-Admin Console</div>
            </div>

            <!-- TAB 1: OVERVIEW -->
            <div id="tab-overview" class="tab-pane">
              <!-- Stats Widget Grid -->
              <div class="db-stats-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                <div class="db-stat-card">
                  <div class="db-stat-icon" style="background-color: var(--color-primary-light); color: var(--color-primary);"><i data-lucide="users"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $totalUsers; ?></div>
                    <div class="db-stat-label">Total Users</div>
                  </div>
                </div>

                <div class="db-stat-card">
                  <div class="db-stat-icon" style="background-color: #EDE9FE; color: #8B5CF6;"><i data-lucide="shield"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $adminUsers; ?></div>
                    <div class="db-stat-label">Admin Users</div>
                  </div>
                </div>

                <div class="db-stat-card">
                  <div class="db-stat-icon" style="background-color: #D1FAE5; color: #10B981;"><i data-lucide="award"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $premiumUsers; ?></div>
                    <div class="db-stat-label">Premium Users</div>
                  </div>
                </div>

                <div class="db-stat-card">
                  <div class="db-stat-icon" style="background-color: var(--color-accent-light); color: var(--color-accent);"><i data-lucide="activity"></i></div>
                  <div class="db-stat-info">
                    <div class="db-stat-num"><?php echo $totalJobs; ?></div>
                    <div class="db-stat-label">Files Processed</div>
                  </div>
                </div>
              </div>

              <!-- Quick Registration Activity feed -->
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top:20px;">
                <div class="db-table-card">
                  <div class="db-table-header">
                    <h3 class="db-table-title">Recent Registration Activity</h3>
                  </div>
                  <table class="db-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php foreach ($recentActivity as $act): ?>
                        <tr>
                          <td style="font-weight:700;"><?php echo htmlspecialchars($act['name']); ?></td>
                          <td><?php echo htmlspecialchars($act['email']); ?></td>
                          <td><span style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--color-primary);"><?php echo $act['role']; ?></span></td>
                          <td style="font-size:11px; color:var(--color-text-secondary);"><?php echo $act['created_time']; ?></td>
                        </tr>
                      <?php endforeach; ?>
                    </tbody>
                  </table>
                </div>

                <!-- Inbox Preview -->
                <div class="db-table-card">
                  <div class="db-table-header">
                    <h3 class="db-table-title">Recent Contact Queries</h3>
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
            </div>

            <!-- TAB 2: USER MANAGEMENT -->
            <div id="tab-users" class="tab-pane" style="display:none;">
              <!-- User Creation Card -->
              <div class="db-table-card" style="padding:20px; margin-bottom:25px;">
                <h3 class="db-table-title" style="margin-bottom:15px;">Create User or Administrator Account</h3>
                <form action="" method="POST" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; align-items:end;">
                  <input type="hidden" name="action" value="create_user">
                  <div class="form-group" style="margin:0;">
                    <label class="form-label" style="font-size:12px;">Full Name</label>
                    <input type="text" name="name" class="form-input-text" placeholder="John Doe" required>
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label class="form-label" style="font-size:12px;">Email Address</label>
                    <input type="email" name="email" class="form-input-text" placeholder="john@example.com" required>
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label class="form-label" style="font-size:12px;">Initial Password</label>
                    <input type="password" name="password" class="form-input-text" placeholder="Min 6 characters" required>
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label class="form-label" style="font-size:12px;">Assigned Role</label>
                    <select name="role" class="plan-select" style="width:100%; height:42px;">
                      <option value="user">Standard User</option>
                      <option value="admin">System Admin</option>
                    </select>
                  </div>
                  <div>
                    <button type="submit" class="btn btn-primary" style="height:42px; width:100%;">Create Account</button>
                  </div>
                </form>
              </div>

              <!-- Users List Table -->
              <div class="db-table-card">
                <div class="db-table-header">
                  <h3 class="db-table-title">Full User Registry List</h3>
                  <span style="font-size:12px; color:var(--color-text-muted); font-weight:600;"><?php echo count($users); ?> records total</span>
                </div>
                <div style="overflow-x:auto;">
                  <table class="db-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>User Profile</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Premium</th>
                        <th>Password Reset</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php foreach ($users as $u): ?>
                        <tr>
                          <td style="font-family:var(--font-mono); font-size:12px;"><?php echo $u['id']; ?></td>
                          <td style="font-weight:700;"><?php echo htmlspecialchars($u['name']); ?></td>
                          <td><?php echo htmlspecialchars($u['email']); ?></td>
                          <td>
                            <span class="badge-history-status" style="font-size:10px; background-color:<?php echo $u['role'] === 'developer' ? '#D1FAE5; color:#059669;' : ($u['role'] === 'admin' ? '#EDE9FE; color:#8B5CF6;' : 'var(--color-border); color:var(--color-text-secondary);'); ?>">
                              <?php echo strtoupper($u['role']); ?>
                            </span>
                          </td>
                          <td>
                            <form action="" method="POST" style="margin:0;">
                              <input type="hidden" name="action" value="toggle_status">
                              <input type="hidden" name="user_id" value="<?php echo $u['id']; ?>">
                              <input type="hidden" name="status" value="<?php echo $u['status'] === 'active' ? 'inactive' : 'active'; ?>">
                              <button type="submit" class="btn <?php echo $u['status'] === 'active' ? 'btn-secondary' : 'btn-danger'; ?> btn-sm" style="min-height:26px; padding:2px 8px; font-size:10px; border-radius:var(--radius-sm);" <?php echo $u['id'] === $developerId ? 'disabled' : ''; ?>>
                                <?php echo $u['status'] === 'active' ? 'Deactivate' : 'Activate'; ?>
                              </button>
                            </form>
                          </td>
                          <td>
                            <?php if ($u['role'] === 'user'): ?>
                              <form action="" method="POST" style="margin:0;">
                                <input type="hidden" name="action" value="toggle_premium">
                                <input type="hidden" name="user_id" value="<?php echo $u['id']; ?>">
                                <input type="hidden" name="is_premium" value="<?php echo $u['is_premium'] ? '0' : '1'; ?>">
                                <button type="submit" class="btn <?php echo $u['is_premium'] ? 'btn-secondary' : 'btn-primary'; ?> btn-sm" style="min-height:26px; padding:2px 8px; font-size:10px; border-radius:var(--radius-sm);">
                                  <?php echo $u['is_premium'] ? 'Revoke Premium' : 'Grant Premium'; ?>
                                </button>
                              </form>
                            <?php else: ?>
                              <span style="font-size:11px; color:var(--color-text-muted);">Granted</span>
                            <?php endif; ?>
                          </td>
                          <td>
                            <!-- Reset Password Form -->
                            <form action="" method="POST" style="display:inline-flex; align-items:center; gap:4px; margin:0;" onsubmit="return confirm('Reset password for <?php echo htmlspecialchars($u['name']); ?>?');">
                              <input type="hidden" name="action" value="reset_password">
                              <input type="hidden" name="user_id" value="<?php echo $u['id']; ?>">
                              <input type="password" name="password" placeholder="New pass" style="height:26px; font-size:11px; padding:2px 6px; width:90px; border:1px solid var(--color-border); border-radius:var(--radius-sm); background:var(--color-bg);" required>
                              <button type="submit" class="btn btn-secondary btn-sm" style="min-height:26px; padding:2px 6px; font-size:10px; border-radius:var(--radius-sm);">Apply</button>
                            </form>
                          </td>
                          <td>
                            <!-- Delete User -->
                            <form action="" method="POST" style="margin:0;" onsubmit="return confirm('Are you sure you want to permanently delete this account? This cannot be undone.');">
                              <input type="hidden" name="action" value="delete_user">
                              <input type="hidden" name="user_id" value="<?php echo $u['id']; ?>">
                              <button type="submit" class="btn btn-danger btn-sm" style="min-height:26px; padding:2px 8px; font-size:10px; border-radius:var(--radius-sm);" <?php echo $u['id'] === $developerId ? 'disabled' : ''; ?>>
                                <i data-lucide="trash-2" style="width:10px; height:10px; display:inline-block; vertical-align:middle; margin-right:2px;"></i> Delete
                              </button>
                            </form>
                          </td>
                        </tr>
                      <?php endforeach; ?>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- TAB 3: PREMIUM TOOLS MANAGEMENT -->
            <div id="tab-tools" class="tab-pane" style="display:none;">
              <div class="db-table-card">
                <div class="db-table-header">
                  <h3 class="db-table-title">Premium Tool Access Gatekeeper</h3>
                  <span style="font-size:12px; color:var(--color-text-muted); font-weight:600;">Check to mark as premium tool (guests & standard users blocked)</span>
                </div>
                <div style="overflow-x:auto;">
                  <table class="db-table">
                    <thead>
                      <tr>
                        <th>Tool Name</th>
                        <th>Category Filter</th>
                        <th>Usage Log Count</th>
                        <th>Tool Access Tier</th>
                        <th>Moderate Access</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php foreach ($tools as $t): ?>
                        <tr>
                          <td style="font-weight:700;"><?php echo htmlspecialchars($t['name']); ?></td>
                          <td><span class="badge-history-status" style="font-size:10px; text-transform:uppercase;"><?php echo htmlspecialchars($t['category']); ?></span></td>
                          <td style="font-family:var(--font-mono); font-size:13px; font-weight:700;"><?php echo $t['use_count']; ?> times</td>
                          <td>
                            <?php if ($t['is_premium']): ?>
                              <span class="badge-history-status status-done" style="background-color:#EDE9FE; color:#8B5CF6; font-size:10px; font-weight:700;">PREMIUM (RESTRICTED)</span>
                            <?php else: ?>
                              <span class="badge-history-status status-active" style="background-color:#D1FAE5; color:#10B981; font-size:10px; font-weight:700;">STANDARD (PUBLIC)</span>
                            <?php endif; ?>
                          </td>
                          <td>
                            <form action="" method="POST" style="margin:0;">
                              <input type="hidden" name="action" value="toggle_tool_premium">
                              <input type="hidden" name="tool_id" value="<?php echo htmlspecialchars($t['id']); ?>">
                              <input type="hidden" name="is_premium" value="<?php echo $t['is_premium'] ? '0' : '1'; ?>">
                              <button type="submit" class="btn <?php echo $t['is_premium'] ? 'btn-secondary' : 'btn-primary'; ?> btn-sm" style="min-height:28px; padding: 2px 8px; font-size:11px; border-radius: var(--radius-sm);">
                                <?php echo $t['is_premium'] ? 'Make Public' : 'Make Premium'; ?>
                              </button>
                            </form>
                          </td>
                        </tr>
                      <?php endforeach; ?>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- TAB 4: SYSTEM SETTINGS -->
            <div id="tab-settings" class="tab-pane" style="display:none;">
              <div class="db-table-card" style="padding: 24px;">
                <h3 class="db-table-title" style="margin-bottom:20px; border-bottom:1px solid var(--color-border); padding-bottom:10px;">Server Telemetry & Performance Metrics</h3>
                
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:30px;">
                  <div>
                    <h4 style="font-weight:700; margin-bottom:12px; color:var(--color-primary);">PHP Environment</h4>
                    <ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:8px; font-size:13px;">
                      <li><strong>PHP Version:</strong> <?php echo PHP_VERSION; ?></li>
                      <li><strong>Operating System:</strong> <?php echo PHP_OS; ?></li>
                      <li><strong>GD Graphics Engine:</strong> <?php echo $gdSupport; ?></li>
                      <li><strong>Memory Limit:</strong> <?php echo ini_get('memory_limit'); ?></li>
                      <li><strong>Max Upload Limit:</strong> <?php echo ini_get('upload_max_filesize'); ?></li>
                    </ul>
                  </div>

                  <div>
                    <h4 style="font-weight:700; margin-bottom:12px; color:var(--color-primary);">Storage Directory Sizes</h4>
                    <ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:8px; font-size:13px;">
                      <li><strong>Temporary Uploads Folder:</strong> <?php echo number_format($uploadDirSize / (1024 * 1024), 2); ?> MB</li>
                      <li><strong>Processed Output Folder:</strong> <?php echo number_format($processedDirSize / (1024 * 1024), 2); ?> MB</li>
                    </ul>
                  </div>

                  <div>
                    <h4 style="font-weight:700; margin-bottom:12px; color:var(--color-primary);">Database Health Metrics</h4>
                    <ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:8px; font-size:13px;">
                      <li><strong>DB Connection Status:</strong> Connected (MySQL via PDO)</li>
                      <li><strong>Active Telemetry Registered:</strong> <?php echo $totalJobs; ?> entries</li>
                      <li><strong>Support Message Logs:</strong> <?php echo $totalMessages; ?> records</li>
                    </ul>
                  </div>
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
          <div class="footer-copy">&copy; <?php echo date('Y'); ?> GXA Technologies. All rights reserved. GXA Toolbox developer management console.</div>
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
            'overview': 'Developer Console Overview',
            'users': 'User Accounts Management',
            'tools': 'Premium Tools Gating Management',
            'settings': 'Server Telemetry Logs',
            'messages': 'Support Mailbox Messages'
        };
        document.getElementById('page-content-title').innerText = titles[tabId] || 'Developer Dashboard';
    }

    // Direct routing setup via URL anchors on load
    window.addEventListener('DOMContentLoaded', () => {
        const hash = window.location.hash.substring(1);
        if (hash && ['overview', 'users', 'tools', 'settings', 'messages'].includes(hash)) {
            switchTab(hash);
        }
    });
  </script>
</body>
</html>
