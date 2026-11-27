-- up
CREATE TABLE students (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  group_name VARCHAR(20) NOT NULL,
  course INT NOT NULL,
  grade DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_students_group (group_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- down
DROP TABLE students;
