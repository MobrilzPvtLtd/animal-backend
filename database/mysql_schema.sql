-- =========================================================
-- Animal Click Backend - Complete MySQL Database Schema
-- Compatible with XAMPP MySQL / MariaDB / MySQL 5.7 / MySQL 8.0+
-- =========================================================

CREATE DATABASE IF NOT EXISTS `animal_backend` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `animal_backend`;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------
-- 1. Table: permissions
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
    `permission_id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL UNIQUE,
    `description` TEXT NULL,
    `resource` VARCHAR(100) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 2. Table: roles
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
    `role_id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL UNIQUE,
    `description` TEXT NULL,
    `is_system_role` BOOLEAN DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 3. Table: role_permissions
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions` (
    `role_id` INT NOT NULL,
    `permission_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`role_id`, `permission_id`),
    CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`permission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 4. Table: users
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
    `user_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(255) NULL UNIQUE,
    `name` VARCHAR(255) NULL,
    `surname` VARCHAR(255) NULL,
    `password` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `device_type` VARCHAR(50) NULL,
    `profile_image_url` TEXT NULL,
    `auth_user_id` VARCHAR(100) NULL,
    `is_verified` BOOLEAN DEFAULT FALSE,
    `is_deleted` BOOLEAN DEFAULT FALSE,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 5. Table: user_roles
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `user_roles`;
CREATE TABLE `user_roles` (
    `user_id` BIGINT NOT NULL,
    `role_id` INT NOT NULL,
    `vet_id` BIGINT NULL,
    `breeder_id` BIGINT NULL,
    `pet_friendly_place_id` BIGINT NULL,
    `service_provider_id` BIGINT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `role_id`),
    CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 6. Table: service_categories
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `service_categories`;
CREATE TABLE `service_categories` (
    `service_category_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `icon` VARCHAR(255) NULL,
    `color` VARCHAR(50) NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `sort_order` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 7. Table: animal_types
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `animal_types`;
CREATE TABLE `animal_types` (
    `animal_type_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `icon` VARCHAR(255) NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `sort_order` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 8. Table: breeds
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `breeds`;
CREATE TABLE `breeds` (
    `breed_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `animal_type_id` BIGINT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_breeds_animal_type` FOREIGN KEY (`animal_type_id`) REFERENCES `animal_types` (`animal_type_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 9. Table: vets (Veterinarians)
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `vets`;
CREATE TABLE `vets` (
    `vet_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `emergency_number` VARCHAR(50) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `zip_code` VARCHAR(20) NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 10. Table: breeders
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `breeders`;
CREATE TABLE `breeders` (
    `breeder_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 11. Table: breeder_breeds
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `breeder_breeds`;
CREATE TABLE `breeder_breeds` (
    `breeder_id` BIGINT NOT NULL,
    `breed_id` BIGINT NOT NULL,
    PRIMARY KEY (`breeder_id`, `breed_id`),
    CONSTRAINT `fk_breeder_breeds_breeder` FOREIGN KEY (`breeder_id`) REFERENCES `breeders` (`breeder_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_breeder_breeds_breed` FOREIGN KEY (`breed_id`) REFERENCES `breeds` (`breed_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 12. Table: pet_friendly_places
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `pet_friendly_places`;
CREATE TABLE `pet_friendly_places` (
    `place_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NULL,
    `address` TEXT NULL,
    `phone` VARCHAR(50) NULL,
    `website` VARCHAR(255) NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 13. Table: pet_friendly_place_animals
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `pet_friendly_place_animals`;
CREATE TABLE `pet_friendly_place_animals` (
    `place_id` BIGINT NOT NULL,
    `animal_type_id` BIGINT NOT NULL,
    PRIMARY KEY (`place_id`, `animal_type_id`),
    CONSTRAINT `fk_place_animals_place` FOREIGN KEY (`place_id`) REFERENCES `pet_friendly_places` (`place_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_place_animals_type` FOREIGN KEY (`animal_type_id`) REFERENCES `animal_types` (`animal_type_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 14. Table: locations
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `locations`;
CREATE TABLE `locations` (
    `location_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `address` TEXT NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 15. Table: event_categories
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `event_categories`;
CREATE TABLE `event_categories` (
    `event_category_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 16. Table: events
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `events`;
CREATE TABLE `events` (
    `event_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `event_category_id` BIGINT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `start_date` DATETIME NULL,
    `end_date` DATETIME NULL,
    `location` TEXT NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_events_category` FOREIGN KEY (`event_category_id`) REFERENCES `event_categories` (`event_category_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 17. Table: boost_packages
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `boost_packages`;
CREATE TABLE `boost_packages` (
    `package_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `price` DECIMAL(10,2) NOT NULL,
    `duration_days` INT NOT NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------
-- 18. Table: transactions
-- ---------------------------------------------------------
DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
    `transaction_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT NULL,
    `amount` DECIMAL(10,2) NOT NULL,
    `status` VARCHAR(50) DEFAULT 'pending',
    `payment_method` VARCHAR(50) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- SEED DATA (Default Permissions, Roles, and Categories)
-- =========================================================

-- Insert Permissions
INSERT INTO `permissions` (`name`, `description`, `resource`, `action`) VALUES
('dashboard.view', 'View dashboard', 'dashboard', 'read'),
('users.view', 'View users list', 'users', 'read'),
('users.create', 'Create new users', 'users', 'create'),
('users.update', 'Update user information', 'users', 'update'),
('users.delete', 'Delete users', 'users', 'delete'),
('users.manage_roles', 'Manage user roles', 'users', 'manage_roles'),
('breeders.view', 'View breeders', 'breeders', 'read'),
('breeders.create', 'Create breeders', 'breeders', 'create'),
('breeders.update', 'Update breeders', 'breeders', 'update'),
('breeders.delete', 'Delete breeders', 'breeders', 'delete'),
('vets.view', 'View vets', 'vets', 'read'),
('vets.create', 'Create vets', 'vets', 'create'),
('vets.update', 'Update vets', 'vets', 'update'),
('vets.delete', 'Delete vets', 'vets', 'delete'),
('service_providers.view', 'View service providers', 'service_providers', 'read'),
('service_providers.create', 'Create service providers', 'service_providers', 'create'),
('service_providers.update', 'Update service providers', 'service_providers', 'update'),
('service_providers.delete', 'Delete service providers', 'service_providers', 'delete');

-- Insert System Roles
INSERT INTO `roles` (`name`, `description`, `is_system_role`) VALUES
('super_admin', 'Super Administrator with full access', TRUE),
('admin', 'Administrator with management access', TRUE),
('vet', 'Veterinarian User', TRUE),
('breeder', 'Breeder User', TRUE),
('pet_friendly_place', 'Pet Friendly Place Manager', TRUE),
('service_provider', 'Service Provider User', TRUE),
('user', 'Regular End User', TRUE);

-- Insert Service Categories
INSERT INTO `service_categories` (`name`, `description`, `icon`, `color`, `sort_order`) VALUES
('Veterinary Services', 'Medical care and health services for animals', '🏥', '#10B981', 1),
('Pet Grooming', 'Professional grooming and styling services', '✂️', '#3B82F6', 2),
('Pet Training', 'Behavioral training and obedience classes', '🎓', '#8B5CF6', 3),
('Pet Boarding', 'Temporary care and accommodation services', '🏠', '#F59E0B', 4),
('Pet Transportation', 'Safe transport services for pets', '🚗', '#EF4444', 5),
('Pet Photography', 'Professional photography services', '📸', '#EC4899', 6);

SET FOREIGN_KEY_CHECKS = 1;
