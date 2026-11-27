-- up
CREATE TABLE student_groups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO student_groups (name) SELECT DISTINCT group_name FROM students;

ALTER TABLE students
  ADD CONSTRAINT fk_students_group FOREIGN KEY (group_name) REFERENCES student_groups (name) ON UPDATE CASCADE;

-- down
ALTER TABLE students DROP FOREIGN KEY fk_students_group;
DROP TABLE student_groups;
