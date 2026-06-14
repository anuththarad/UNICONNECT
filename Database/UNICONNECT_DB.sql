CREATE DATABASE UNICONNECT;

USE UNICONNECT;

CREATE TABLE University (
    university_id INT IDENTITY(1,1) PRIMARY KEY,
    university_name NVARCHAR(255) NOT NULL,
    location NVARCHAR(255)
);

CREATE TABLE [User] (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    full_name NVARCHAR(255) NOT NULL,
    email NVARCHAR(255) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    role NVARCHAR(50) CHECK (role IN ('student','organizer','staff','admin')) NOT NULL,
    university_id INT,
    faculty_name NVARCHAR(255),
    department_name NVARCHAR(255),
    contact_number NVARCHAR(20),

    FOREIGN KEY (university_id) REFERENCES University(university_id)
        ON DELETE SET NULL
);

CREATE TABLE Interest (
    interest_id INT IDENTITY(1,1) PRIMARY KEY,
    interest_name NVARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE User_Interest (
    user_id INT,
    interest_id INT,
    PRIMARY KEY (user_id, interest_id),

    FOREIGN KEY (user_id) REFERENCES [User](user_id)
        ON DELETE CASCADE,
    FOREIGN KEY (interest_id) REFERENCES Interest(interest_id)
        ON DELETE CASCADE
);

CREATE TABLE Event (
    event_id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    event_date DATE,
    event_time TIME,
    venue NVARCHAR(255),
    category NVARCHAR(100),
    organizer_id INT,
    university_id INT,
    status NVARCHAR(50) CHECK (status IN ('upcoming','completed','cancelled')) DEFAULT 'upcoming',

    FOREIGN KEY (organizer_id) REFERENCES [User](user_id)
        ON DELETE SET NULL,
    FOREIGN KEY (university_id) REFERENCES University(university_id)
        ON DELETE CASCADE
);

CREATE TABLE Participant_Registration (
    registration_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    event_id INT,
    registration_date DATETIME DEFAULT GETDATE(),
    status NVARCHAR(50) CHECK (status IN ('pending','confirmed','cancelled')) DEFAULT 'pending',
    participant_type NVARCHAR(100),

    FOREIGN KEY (user_id) REFERENCES [User](user_id)
        ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES Event(event_id)
        ON DELETE CASCADE
);

CREATE TABLE Organizer_Registration (
    organizer_reg_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    event_id INT,
    role NVARCHAR(100),
    assigned_date DATE,

    FOREIGN KEY (user_id) REFERENCES [User](user_id)
        ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES Event(event_id)
        ON DELETE CASCADE
);

CREATE TABLE Volunteer (
    volunteer_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    event_id INT,
    role NVARCHAR(100),
    task NVARCHAR(MAX),
    status NVARCHAR(50) CHECK (status IN ('assigned','completed','inactive')) DEFAULT 'assigned',

    FOREIGN KEY (user_id) REFERENCES [User](user_id)
        ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES Event(event_id)
        ON DELETE CASCADE
);

CREATE TABLE Attendance (
    attendance_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    event_id INT,
    status NVARCHAR(50) CHECK (status IN ('present','absent')) NOT NULL,

    FOREIGN KEY (user_id) REFERENCES [User](user_id)
        ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES Event(event_id)
        ON DELETE CASCADE
);

CREATE TABLE Feedback (
    feedback_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    event_id INT,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comments NVARCHAR(MAX),
    feedback_date DATE,

    FOREIGN KEY (user_id) REFERENCES [User](user_id)
        ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES Event(event_id)
        ON DELETE CASCADE
);

CREATE TABLE Budget (
    budget_id INT IDENTITY(1,1) PRIMARY KEY,
    event_id INT,
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    description NVARCHAR(MAX),

    FOREIGN KEY (event_id) REFERENCES Event(event_id)
        ON DELETE CASCADE
);

CREATE TABLE Notification (
    notification_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    message NVARCHAR(MAX),
    type NVARCHAR(100),
    date_sent DATETIME DEFAULT GETDATE(),
    status NVARCHAR(50) CHECK (status IN ('read','unread')) DEFAULT 'unread',

    FOREIGN KEY (user_id) REFERENCES [User](user_id)
        ON DELETE CASCADE
);

CREATE TABLE Event_Image (
    image_id INT IDENTITY(1,1) PRIMARY KEY,
    event_id INT,
    image_url NVARCHAR(500),

    FOREIGN KEY (event_id) REFERENCES Event(event_id)
        ON DELETE CASCADE
);

SELECT * FROM Participant_Registration;

SELECT * FROM Event;

ALTER TABLE Volunteer
ADD CONSTRAINT skills;

SELECT * FROM Event;
SELECT * FROM Users;


DELETE FROM Event
WHERE event_id = 6030;

ALTER TABLE Participant_Registration
ADD role NVARCHAR(50) DEFAULT 'participant';


ALTER TABLE volunteer
ADD
    skills NVARCHAR(255);



DELETE FROM Users
WHERE user_id = 7060;

DELETE FROM Event;

ALTER TABLE Event
DROP CONSTRAINT FK__Event__universit__????;

SELECT TOP 5 * FROM [Event]

ALTER TABLE [Event]
DROP organizer_id INT;

SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
ORDER BY TABLE_NAME;

SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Users';

ALTER TABLE Participant_Registration
ADD role NVARCHAR(50) DEFAULT 'participant';

ALTER TABLE Participant_Registration
ADD
    faculty NVARCHAR(255),
   university_name NVARCHAR(255),
    contact_no NVARCHAR(50),
    notes NVARCHAR(MAX);
    role NVARCHAR(100);

    SELECT *  FROM Event;

    ALTER TABLE Volunteer
ADD task NVARCHAR(MAX);

SELECT *
FROM Event
WHERE organizer_id = 5

ALTER TABLE Users
ADD profile_image NVARCHAR(MAX);

ALTER TABLE Users
ADD profile_bio NVARCHAR(MAX);

SELECT *  FROM Volunteer;

SELECT *  FROM participant_Registration;

SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Participant_Registration';

EXEC sp_rename 
'Participant_Registration.faculty', 
'faculty_name', 
'COLUMN';

CREATE TABLE PasswordResetOTP ( 
id INT IDENTITY PRIMARY KEY, 
user_id INT, otp VARCHAR(6), 
expires_at DATETIME, 
channel VARCHAR(10) );


IF OBJECT_ID('dbo.Notification', 'U') IS NOT NULL
    DROP TABLE dbo.Notification;
GO

/* =========================================================
   0. DATABASE
========================================================= */

IF DB_ID('UNICONNECT') IS NULL
BEGIN
    CREATE DATABASE UNICONNECT;
END
GO

USE UNICONNECT;
GO

/* =========================================================
   1. NOTIFICATION TABLE
========================================================= */

CREATE TABLE dbo.Notification (
    notification_id   INT            IDENTITY(1,1) PRIMARY KEY,
    user_id           INT            NOT NULL,

    title             NVARCHAR(255)  NOT NULL DEFAULT 'Notification',
    message           NVARCHAR(MAX)  NOT NULL,

    type              NVARCHAR(100)  NOT NULL
        CHECK (type IN (
            'event_created',
            'event_updated',
            'event_cancelled',
            'event_reminder_24h',
            'event_reminder_1h',
            'event_full',
            'event_slots_low',
            'registration_confirmed',
            'registration_cancelled',
            'registration_waitlisted',
            'volunteer_accepted',
            'volunteer_rejected',
            'profile_updated',
            'admin_announcement',
            'general'
        )),

    ref_type          NVARCHAR(50)   NULL,
    ref_id            INT            NULL,

    sent_in_app       BIT            NOT NULL DEFAULT 1,
    sent_sms          BIT            NOT NULL DEFAULT 0,
    sms_status        NVARCHAR(50)   NULL,
    sms_sid           NVARCHAR(255)  NULL,

    status            NVARCHAR(50)   NOT NULL DEFAULT 'unread'
        CHECK (status IN ('read', 'unread')),
    read_at           DATETIME       NULL,

    date_sent         DATETIME       NOT NULL DEFAULT GETDATE(),
    created_by        INT            NULL,

    FOREIGN KEY (user_id) REFERENCES dbo.[Users](user_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES dbo.[Users](user_id) ON DELETE NO ACTION
);
GO

CREATE INDEX IX_Notification_UserId_Status
ON dbo.Notification (user_id, status, date_sent DESC);
GO

/* =========================================================
   2. USER CONTACT (ENCRYPTED PHONE STORAGE)
========================================================= */

IF OBJECT_ID('dbo.UserContact', 'U') IS NOT NULL
    DROP TABLE dbo.UserContact;
GO

CREATE TABLE dbo.UserContact (
    contact_id        INT            IDENTITY(1,1) PRIMARY KEY,
    user_id           INT            NOT NULL UNIQUE,

    phone_encrypted   NVARCHAR(512)  NULL,
    phone_iv          NVARCHAR(64)   NULL,
    phone_hmac        NVARCHAR(128)  NULL,

    sms_opt_in        BIT            NOT NULL DEFAULT 1,
    verified          BIT            NOT NULL DEFAULT 0,
    verified_at       DATETIME       NULL,

    created_at        DATETIME       NOT NULL DEFAULT GETDATE(),
    updated_at        DATETIME       NOT NULL DEFAULT GETDATE(),

    FOREIGN KEY (user_id) REFERENCES dbo.[Users](user_id) ON DELETE CASCADE
);
GO

/* =========================================================
   3. NOTIFICATION PREFERENCES
========================================================= */

IF OBJECT_ID('dbo.NotificationPreference', 'U') IS NOT NULL
    DROP TABLE dbo.NotificationPreference;
GO

CREATE TABLE dbo.NotificationPreference (
    pref_id               INT  IDENTITY(1,1) PRIMARY KEY,
    user_id               INT  NOT NULL UNIQUE,

    inapp_event_created        BIT NOT NULL DEFAULT 1,
    inapp_event_updated        BIT NOT NULL DEFAULT 1,
    inapp_event_cancelled      BIT NOT NULL DEFAULT 1,
    inapp_event_reminder       BIT NOT NULL DEFAULT 1,
    inapp_registration         BIT NOT NULL DEFAULT 1,
    inapp_volunteer            BIT NOT NULL DEFAULT 1,
    inapp_profile              BIT NOT NULL DEFAULT 1,
    inapp_announcements        BIT NOT NULL DEFAULT 1,

    sms_event_created          BIT NOT NULL DEFAULT 0,
    sms_event_updated          BIT NOT NULL DEFAULT 0,
    sms_event_cancelled        BIT NOT NULL DEFAULT 1,
    sms_event_reminder         BIT NOT NULL DEFAULT 1,
    sms_registration           BIT NOT NULL DEFAULT 1,
    sms_volunteer              BIT NOT NULL DEFAULT 0,
    sms_profile                BIT NOT NULL DEFAULT 0,
    sms_announcements          BIT NOT NULL DEFAULT 0,

    FOREIGN KEY (user_id) REFERENCES dbo.[Users](user_id) ON DELETE CASCADE
);
GO

/* =========================================================
   4. NOTIFICATION QUEUE
========================================================= */

IF OBJECT_ID('dbo.NotificationQueue', 'U') IS NOT NULL
    DROP TABLE dbo.NotificationQueue;
GO

CREATE TABLE dbo.NotificationQueue (
    queue_id      INT            IDENTITY(1,1) PRIMARY KEY,
    user_id       INT            NOT NULL,
    event_id      INT            NULL,
    type          NVARCHAR(100)  NOT NULL,
    fire_at       DATETIME       NOT NULL,
    payload       NVARCHAR(MAX)  NULL,

    status        NVARCHAR(20)   NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),

    attempts      INT            NOT NULL DEFAULT 0,
    last_attempt  DATETIME       NULL,
    created_at    DATETIME       NOT NULL DEFAULT GETDATE(),

    FOREIGN KEY (user_id) REFERENCES dbo.[UserS](user_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES dbo.Event(event_id) ON DELETE NO ACTION
);
GO

CREATE INDEX IX_NotificationQueue_FireAt
ON dbo.NotificationQueue (fire_at, status);
GO

PRINT 'UNICONNECT database and notification schema installed successfully';
GO


-- ============================================================
--  UniConnect – Budget Table Migration
--  Run this ONCE against your existing database.
--  Safe to run on a live table – uses IF NOT EXISTS guards.
-- ============================================================

/* 1. category column */
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Budget' AND COLUMN_NAME = 'category'
)
BEGIN
  ALTER TABLE Budget
    ADD category NVARCHAR(100) NOT NULL DEFAULT 'Other';
  PRINT 'Column [category] added to Budget.';
END
ELSE
  PRINT 'Column [category] already exists – skipped.';
GO

/* 2. notes column */
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Budget' AND COLUMN_NAME = 'notes'
)
BEGIN
  ALTER TABLE Budget
    ADD notes NVARCHAR(MAX) NULL;
  PRINT 'Column [notes] added to Budget.';
END
ELSE
  PRINT 'Column [notes] already exists – skipped.';
GO

/* 3. created_at column */
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Budget' AND COLUMN_NAME = 'created_at'
)
BEGIN
  ALTER TABLE Budget
    ADD created_at DATETIME NOT NULL DEFAULT GETDATE();
  PRINT 'Column [created_at] added to Budget.';
END
ELSE
  PRINT 'Column [created_at] already exists – skipped.';
GO

/* 4. updated_at column */
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Budget' AND COLUMN_NAME = 'updated_at'
)
BEGIN
  ALTER TABLE Budget
    ADD updated_at DATETIME NULL;
  PRINT 'Column [updated_at] added to Budget.';
END
ELSE
  PRINT 'Column [updated_at] already exists – skipped.';
GO

/* 5. image_url on Event (needed by the budget tracker frontend) */
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Event' AND COLUMN_NAME = 'image_url'
)
BEGIN
  ALTER TABLE [Event]
    ADD image_url NVARCHAR(500) NULL;
  PRINT 'Column [image_url] added to Event.';
END
ELSE
  PRINT 'Column [image_url] already exists – skipped.';
GO

/* 6. Backfill existing rows with a sensible default category */
UPDATE Budget
SET category = 'Other'
WHERE category IS NULL OR category = '';
GO

PRINT '=== Migration complete. ===';


ALTER TABLE Users
    ADD faculty_name    NVARCHAR(255) NULL,
        department_name NVARCHAR(255) NULL,
        interest        NVARCHAR(100) NULL;

        ALTER TABLE Users
    ADD interest NVARCHAR(100) NULL;

    SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'university_id';

-- Only run this if university_id column is INT type
ALTER TABLE Users
    ALTER COLUMN university_id NVARCHAR(50) NULL;

    SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'UNICONNECT'
ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT DATABASE();

SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_CATALOG = 'UNICONNECT'
ORDER BY TABLE_NAME, ORDINAL_POSITION;

DROP TABLE Organizer_registration;

SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Volunteer'

SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Feedbacks'
ORDER BY ORDINAL_POSITION

SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Users'
ORDER BY ORDINAL_POSITION;

SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Users'
ORDER BY ORDINAL_POSITION;

-- notifications_table.sql
-- Run this ONCE in your SQL Server database (MSSQL)
-- Safe to run multiple times — IF NOT EXISTS prevents errors

IF NOT EXISTS (
  SELECT * FROM sysobjects
  WHERE name = 'notifications' AND xtype = 'U'
)
BEGIN
  CREATE TABLE notifications (
    notification_id  INT           IDENTITY(1,1) PRIMARY KEY,
    user_id          INT           NOT NULL,
    message          NVARCHAR(MAX) NOT NULL,
    type             VARCHAR(50)   NOT NULL DEFAULT 'general',
    event_id         INT           NULL,
    is_read          BIT           NOT NULL DEFAULT 0,
    created_at       DATETIME      NOT NULL DEFAULT GETDATE()
  );

  -- Indexes for fast lookups
  CREATE INDEX idx_notif_user_id    ON notifications(user_id);
  CREATE INDEX idx_notif_is_read    ON notifications(is_read);
  CREATE INDEX idx_notif_created_at ON notifications(created_at DESC);

  PRINT 'notifications table created successfully.';
END
ELSE
BEGIN
  PRINT 'notifications table already exists — skipped.';
END

-- Allowed type values (for reference):
--   general
--   volunteer_approved
--   volunteer_rejected
--   volunteer_task_updated
--   volunteer_message

-- -------------------------------------------------------------
-- notification_messages table
-- Stores the back-and-forth thread for message-type notifications
-- Run this AFTER the notifications table
-- -------------------------------------------------------------
IF NOT EXISTS (
  SELECT * FROM sysobjects
  WHERE name = 'notification_messages' AND xtype = 'U'
)
BEGIN
  CREATE TABLE notification_messages (
    message_id      INT           IDENTITY(1,1) PRIMARY KEY,
    notification_id INT           NOT NULL,         -- FK to notifications
    sender_id       INT           NOT NULL DEFAULT 0,
    sender          VARCHAR(20)   NOT NULL,          -- 'organizer' | 'participant'
    sender_name     NVARCHAR(200) NOT NULL DEFAULT 'Unknown',
    message         NVARCHAR(MAX) NOT NULL,
    created_at      DATETIME      NOT NULL DEFAULT GETDATE(),

    CONSTRAINT fk_nm_notification
      FOREIGN KEY (notification_id)
      REFERENCES notifications(notification_id)
      ON DELETE CASCADE
  );

  CREATE INDEX idx_nm_notification_id ON notification_messages(notification_id);
  CREATE INDEX idx_nm_created_at      ON notification_messages(created_at ASC);

  PRINT 'notification_messages table created successfully.';
END
ELSE
BEGIN
  PRINT 'notification_messages table already exists — skipped.';
END

-- Also add organizer_id column to notifications if it doesn't exist
-- (used so participant replies can notify the organizer)
IF NOT EXISTS (
  SELECT * FROM sys.columns
  WHERE object_id = OBJECT_ID('notifications') AND name = 'user_id'
)
BEGIN
  ALTER TABLE notifications ADD organizer_id INT NULL;
  PRINT 'organizer_id column added to notifications.';
END

SELECT * FROM Notifications;
DROP TABLE Notification;

ALTER TABLE Users
  ADD otp                VARCHAR(6)   NULL,
      otp_expiry         DATETIME     NULL,
      reset_token        VARCHAR(64)  NULL,
      reset_token_expiry DATETIME     NULL;

      ALTER TABLE Volunteer
ADD group_name NVARCHAR(20) NULL;

ALTER TABLE Volunteer
ADD approved_at DATETIME NULL;

SELECT* FROM Event;

DELETE FROM Users
WHERE user_id = 11067;

SELECT * FROM Users;

DELETE FROM Users
WHERE user_id = 11066;

-- Step 1: delete the user's tickets
DELETE FROM dbo.Tickets WHERE user_id = 11066;

-- Step 2: now delete the user
DELETE FROM dbo.Users WHERE user_id = 11066;


-- ============================================================
--  UniConnect — Payment Module Migration
--  Run once against the UNICONNECT database
-- ============================================================

USE UNICONNECT;
GO

-- 1. Add slip upload column to dbo.Payments (bank transfer evidence)
ALTER TABLE dbo.Payments
  ADD payment_slip_url  NVARCHAR(MAX) NULL,
      slip_uploaded_at  DATETIME      NULL,
      verified_by       INT           NULL,   -- organiser user_id who approved
      verified_at       DATETIME      NULL,
      rejection_reason  NVARCHAR(500) NULL;
GO

-- 2. FK for verified_by
ALTER TABLE dbo.Payments
  ADD CONSTRAINT FK_Payments_VerifiedBy
  FOREIGN KEY (verified_by) REFERENCES dbo.Users(user_id);
GO

-- 3. Index for quick lookups by ticket / event
CREATE INDEX IX_Payments_ticket  ON dbo.Payments(ticket_id);
CREATE INDEX IX_Payments_event   ON dbo.Payments(event_id);
CREATE INDEX IX_Payments_status  ON dbo.Payments(payment_status);
GO

PRINT 'Migration complete.';


ALTER LOGIN uniconnect WITH PASSWORD = 'YourNewPassword123!' MUST_CHANGE = OFF;

ALTER LOGIN uniconnect 
WITH PASSWORD = 'uniconnect2026',
     CHECK_EXPIRATION = OFF,
     CHECK_POLICY = OFF;

     SELECT * FROM participant_Registration;

     SELECT TOP 1 *
FROM Users;



SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Event'
ORDER BY ORDINAL_POSITION;

SELECT event_id, COUNT(*) as total 
FROM Participant_Registration 
GROUP BY event_id