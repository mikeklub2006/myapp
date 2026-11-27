CREATE DATABASE IF NOT EXISTS group_401 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS group_401_api CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'student'@'localhost' IDENTIFIED BY 'student401';
GRANT ALL PRIVILEGES ON group_401.* TO 'student'@'localhost';
GRANT ALL PRIVILEGES ON group_401_api.* TO 'student'@'localhost';
FLUSH PRIVILEGES;
