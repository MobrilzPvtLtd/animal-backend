-- =========================================================
-- Super Admin Seed SQL Script (With Hashed Password)
-- Run this in phpMyAdmin or MySQL Workbench
-- =========================================================

USE `animal_backend`;

-- 1. Ensure super_admin role exists (Role ID 1)
INSERT INTO `roles` (`role_id`, `name`, `description`, `is_system_role`)
VALUES (1, 'super_admin', 'Super Administrator with full access', TRUE)
ON DUPLICATE KEY UPDATE `name` = 'super_admin';

-- 2. Insert / Update Super Admin User with Bcrypt Hashed Password
-- Note: 'Admin@123' bcrypt hash: '$2b$10$LZw2qKeDdRlXSN12RKS3cOTIdz0xCjdX9UdUEOBn3dbg9NJYgG2qG'
INSERT INTO `users` (`email`, `name`, `surname`, `password`, `phone`, `is_verified`, `is_active`)
VALUES ('superadmin@animal.com', 'Super', 'Admin', '$2b$10$LZw2qKeDdRlXSN12RKS3cOTIdz0xCjdX9UdUEOBn3dbg9NJYgG2qG', '1234567890', TRUE, TRUE)
ON DUPLICATE KEY UPDATE 
    `password` = '$2b$10$LZw2qKeDdRlXSN12RKS3cOTIdz0xCjdX9UdUEOBn3dbg9NJYgG2qG',
    `is_active` = TRUE,
    `is_verified` = TRUE;

-- 3. Assign super_admin role to Super Admin User in user_roles
INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`)
SELECT `user_id`, 1 FROM `users` WHERE `email` = 'superadmin@animal.com';

SELECT u.user_id, u.email, u.name, u.password AS hashed_password, r.name AS role_name
FROM users u
JOIN user_roles ur ON u.user_id = ur.user_id
JOIN roles r ON ur.role_id = r.role_id
WHERE u.email = 'superadmin@animal.com';
