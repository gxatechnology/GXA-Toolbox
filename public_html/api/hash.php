<?php
echo password_hash('ChangeMe@123', PASSWORD_BCRYPT);
unlink(__FILE__);
