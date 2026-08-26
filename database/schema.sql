-- Smart Class Management System - Complete Database Schema
-- Database: thusithaedu_db
-- User: smartclass
 
-- 1. Core User Management
CREATE TABLE IF NOT EXISTS Users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Teacher', 'Counter Person', 'Parent', 'Student')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.1 Base Academic Entities
CREATE TABLE IF NOT EXISTS Subjects (
    subject_id SERIAL PRIMARY KEY,
    subject_name VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS Halls (
    hall_id SERIAL PRIMARY KEY,
    hall_name VARCHAR(255) NOT NULL,
    capacity INT NOT NULL
);

-- 2. Profiles
CREATE TABLE IF NOT EXISTS Parents (
    parent_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(user_id) ON DELETE CASCADE,
    parent_name VARCHAR(255) NOT NULL,
    parent_phone VARCHAR(20) UNIQUE NOT NULL,
    address TEXT
);

CREATE TABLE IF NOT EXISTS Students (
    student_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(user_id) ON DELETE CASCADE,
    parent_id INT REFERENCES Parents(parent_id) ON DELETE SET NULL,
    student_name VARCHAR(255) NOT NULL,
    school VARCHAR(255),
    grade VARCHAR(50),
    address TEXT,
    qr_code_key VARCHAR(255) UNIQUE NOT NULL,
    profile_photo_path TEXT,
    face_encoding JSONB, -- Stores the 128D face vector
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Teachers ( -- Unified table for all teaching staff
    teacher_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(user_id) ON DELETE CASCADE,
    teacher_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    specialization VARCHAR(255),
    qualifications TEXT,
    bio TEXT,
    profile_photo_path TEXT
);

CREATE TABLE IF NOT EXISTS Counter_Person ( -- Administrative profile
    counter_person_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(user_id) ON DELETE CASCADE,
    staff_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255) UNIQUE,
    joined_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS Courses (
    course_id SERIAL PRIMARY KEY,
    subject_id INT REFERENCES Subjects(subject_id) ON DELETE CASCADE,
    teacher_id INT REFERENCES Teachers(teacher_id) ON DELETE CASCADE,
    course_name VARCHAR(255) NOT NULL,
    monthly_fee DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS Class_Schedules (
    schedule_id SERIAL PRIMARY KEY,
    course_id INT REFERENCES Courses(course_id) ON DELETE CASCADE,
    hall_id INT REFERENCES Halls(hall_id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
    -- capacity removed (get from Halls), class_name removed (get from Courses)
);

CREATE TABLE IF NOT EXISTS Course_Enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES Students(student_id) ON DELETE CASCADE,
    course_id INT REFERENCES Courses(course_id) ON DELETE CASCADE,
    enrollment_status VARCHAR(50) DEFAULT 'Enrolled',
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

-- 4. Attendance & AI Verification
CREATE TABLE IF NOT EXISTS Student_Attendance_Logs (
    log_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES Students(student_id) ON DELETE CASCADE,
    course_id INT REFERENCES Courses(course_id) ON DELETE CASCADE,
    attendance_status VARCHAR(50) CHECK (attendance_status IN ('Present', 'Late')),
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Attendance_Master (
    session_id INT PRIMARY KEY REFERENCES Class_Schedules(schedule_id) ON DELETE CASCADE,
    qr_count INT DEFAULT 0,
    ai_headcount INT DEFAULT 0,
    zone_details JSONB,
    mismatch_detected BOOLEAN DEFAULT FALSE,
    verification_data JSONB,
    validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Camera_Zones (
    zone_id SERIAL PRIMARY KEY,
    hall_id INT REFERENCES Halls(hall_id) ON DELETE CASCADE,
    zone_name VARCHAR(255) NOT NULL,
    camera_url TEXT NOT NULL,
    position INT NOT NULL, -- Front=1, Middle=2, Back=3
    calibration_factor DECIMAL(3,2) DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS Suspicious_Attendance_Logs (
    log_id SERIAL PRIMARY KEY,
    session_id INT REFERENCES Class_Schedules(schedule_id) ON DELETE CASCADE,
    qr_count INT,
    ai_headcount INT,
    zone_details JSONB,
    unverified_student_ids JSONB,
    image_paths JSONB,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Resolved')),
    resolution_comment TEXT,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Payments
CREATE TABLE IF NOT EXISTS Payments (
    payment_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES Students(student_id) ON DELETE CASCADE,
    course_id INT REFERENCES Courses(course_id) ON DELETE CASCADE,
    issued_by INT REFERENCES Users(user_id) ON DELETE SET NULL, -- Linked to specific admin/counter person user
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    for_month VARCHAR(50) NOT NULL,
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'Completed',
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmation_url VARCHAR(255),
    verification_comments TEXT
);

-- 6. Study Area Management
CREATE TABLE IF NOT EXISTS Study_Seats (
    seat_id SERIAL PRIMARY KEY,
    seat_status VARCHAR(50) DEFAULT 'Available' CHECK (seat_status IN ('Available', 'Reserved', 'Occupied'))
);

CREATE TABLE IF NOT EXISTS Study_Area_Bookings (
    booking_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES Students(student_id) ON DELETE CASCADE,
    seat_id INT REFERENCES Study_Seats(seat_id) ON DELETE CASCADE,
    expected_arrival_time TIMESTAMP NOT NULL,
    actual_arrival_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    expiry_time TIMESTAMP,
    booking_status VARCHAR(50) DEFAULT 'Pending' CHECK (booking_status IN ('Pending', 'Confirmed', 'Completed', 'Cancelled'))
);

-- 7. Exams & Results
CREATE TABLE IF NOT EXISTS Exams (
    exam_id SERIAL PRIMARY KEY,
    course_id INT REFERENCES Courses(course_id) ON DELETE CASCADE,
    exam_name VARCHAR(255) NOT NULL,
    exam_date DATE NOT NULL,
    total_marks INT DEFAULT 100,
    pass_percentage INT DEFAULT 50
);

CREATE TABLE IF NOT EXISTS Exam_Results (
    student_id INT REFERENCES Students(student_id) ON DELETE CASCADE,
    exam_id INT REFERENCES Exams(exam_id) ON DELETE CASCADE,
    marks DECIMAL(5,2) NOT NULL,
    PRIMARY KEY (student_id, exam_id)
);

-- 8. Communication & Logs
CREATE TABLE IF NOT EXISTS SMS_Logs (
    log_id SERIAL PRIMARY KEY,
    parent_id INT REFERENCES Parents(parent_id) ON DELETE SET NULL,
    parent_phone VARCHAR(20) NOT NULL,
    sms_type VARCHAR(50),
    message_body TEXT,
    status VARCHAR(50),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Contact_Messages (
    message_id SERIAL PRIMARY KEY,
    sender_name VARCHAR(255) NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    sender_phone VARCHAR(20),
    subject VARCHAR(255),
    message_text TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    is_read BOOLEAN DEFAULT FALSE,
    is_important BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Promotions (
    promo_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. System Administration
CREATE TABLE IF NOT EXISTS System_Settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS AuditLogs (
    log_id SERIAL PRIMARY KEY,
    performed_by INT REFERENCES Users(user_id) ON DELETE SET NULL,
    role VARCHAR(50),
    action_type VARCHAR(50),
    target_table VARCHAR(100),
    target_id INT,
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Safety & Congestion Tracker
CREATE TABLE IF NOT EXISTS Hall_Congestion_Tracker (
    hall_id INT PRIMARY KEY REFERENCES Halls(hall_id) ON DELETE CASCADE,
    first_detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sms_sent BOOLEAN DEFAULT FALSE,
    active_log_id INT
);

CREATE TABLE IF NOT EXISTS Hall_Congestion_Logs (
    log_id SERIAL PRIMARY KEY,
    hall_id INT REFERENCES Halls(hall_id) ON DELETE CASCADE,
    peak_count INT,
    capacity INT,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_minutes INT
);

CREATE TABLE IF NOT EXISTS PendingRegistrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    school VARCHAR(255),
    grade VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(255),
    course_interest INT REFERENCES Courses(course_id),
    status VARCHAR(50) DEFAULT 'Pending'
);

CREATE TABLE IF NOT EXISTS Learning_Materials (
    material_id SERIAL PRIMARY KEY,
    course_id INT REFERENCES Courses(course_id) ON DELETE CASCADE,
    teacher_id INT REFERENCES Teachers(teacher_id) ON DELETE CASCADE,
    material_title VARCHAR(255) NOT NULL,
    material_type VARCHAR(50) DEFAULT 'PDF',
    uploaded_file TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_student_qr ON Students(qr_code_key);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON Student_Attendance_Logs(scanned_at);
CREATE INDEX IF NOT EXISTS idx_payments_date ON Payments(payment_date);
-- 11. Announcements & Achievements
CREATE TABLE IF NOT EXISTS Announcements (
    announcement_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT REFERENCES Users(user_id) ON DELETE SET NULL,
    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Student_Achievements (
    achievement_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES Students(student_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    island_rank INT,
    achieved_year INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Password Reset OTP (used by authController forgotPassword/verifyOtp/resetWithOtp)
CREATE TABLE IF NOT EXISTS OTP_Store (
    otp_id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_username ON OTP_Store(username);
