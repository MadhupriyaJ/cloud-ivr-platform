USE [ivr_platform];
GO

DECLARE @DomainId UNIQUEIDENTIFIER;

SELECT @DomainId = DomainId
FROM dbo.Domains
WHERE DomainCode = 'hospital';

IF @DomainId IS NULL
BEGIN
    SET @DomainId = NEWID();

    INSERT INTO dbo.Domains (
        DomainId,
        DomainCode,
        DisplayName,
        OrganizationName,
        IndustryType,
        DefaultLanguage,
        DefaultVoice,
        WelcomeMessage,
        FallbackMessage,
        EscalationMessage,
        IsActive,
        CreatedAt,
        UpdatedAt
    )
    VALUES (
        @DomainId,
        'hospital',
        'Hospital IVR',
        'Meenakshi Mission Hospital',
        'healthcare',
        'English',
        'alloy',
        'Welcome to Meenakshi Mission Hospital. Please tell me how I can help you today.',
        'I can help with appointments, billing, lab reports, reschedule, and cancellation.',
        'Connecting you to a hospital operator.',
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE DepartmentCode = 'cardiology')
BEGIN
    INSERT INTO dbo.Departments (DepartmentId, DomainId, DepartmentCode, DepartmentName, IsActive, CreatedAt, UpdatedAt)
    VALUES (NEWID(), (SELECT DomainId FROM dbo.Domains WHERE DomainCode = 'hospital'), 'cardiology', 'Cardiology', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE DepartmentCode = 'neurology')
BEGIN
    INSERT INTO dbo.Departments (DepartmentId, DomainId, DepartmentCode, DepartmentName, IsActive, CreatedAt, UpdatedAt)
    VALUES (NEWID(), (SELECT DomainId FROM dbo.Domains WHERE DomainCode = 'hospital'), 'neurology', 'Neurology', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE DepartmentCode = 'orthopedics')
BEGIN
    INSERT INTO dbo.Departments (DepartmentId, DomainId, DepartmentCode, DepartmentName, IsActive, CreatedAt, UpdatedAt)
    VALUES (NEWID(), (SELECT DomainId FROM dbo.Domains WHERE DomainCode = 'hospital'), 'orthopedics', 'Orthopedics', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE DepartmentCode = 'pediatrics')
BEGIN
    INSERT INTO dbo.Departments (DepartmentId, DomainId, DepartmentCode, DepartmentName, IsActive, CreatedAt, UpdatedAt)
    VALUES (NEWID(), (SELECT DomainId FROM dbo.Domains WHERE DomainCode = 'hospital'), 'pediatrics', 'Pediatrics', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Doctors WHERE DoctorCode = 'DOC-CAR-001')
BEGIN
    INSERT INTO dbo.Doctors (DoctorId, DomainId, DepartmentId, DoctorCode, DoctorName, Qualification, Specialization, AvailabilityStatus, ConsultationFee, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        NEWID(),
        (SELECT DomainId FROM dbo.Domains WHERE DomainCode = 'hospital'),
        (SELECT DepartmentId FROM dbo.Departments WHERE DepartmentCode = 'cardiology'),
        'DOC-CAR-001',
        'Dr. Ravi Kumar',
        'MBBS, MD',
        'Cardiologist',
        'available',
        500.00,
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Doctors WHERE DoctorCode = 'DOC-CAR-002')
BEGIN
    INSERT INTO dbo.Doctors (DoctorId, DomainId, DepartmentId, DoctorCode, DoctorName, Qualification, Specialization, AvailabilityStatus, ConsultationFee, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        NEWID(),
        (SELECT DomainId FROM dbo.Domains WHERE DomainCode = 'hospital'),
        (SELECT DepartmentId FROM dbo.Departments WHERE DepartmentCode = 'cardiology'),
        'DOC-CAR-002',
        'Dr. Anita Shah',
        'MBBS, DM',
        'Interventional Cardiologist',
        'available',
        500.00,
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Doctors WHERE DoctorCode = 'DOC-NEU-001')
BEGIN
    INSERT INTO dbo.Doctors (DoctorId, DomainId, DepartmentId, DoctorCode, DoctorName, Qualification, Specialization, AvailabilityStatus, ConsultationFee, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        NEWID(),
        (SELECT DomainId FROM dbo.Domains WHERE DomainCode = 'hospital'),
        (SELECT DepartmentId FROM dbo.Departments WHERE DepartmentCode = 'neurology'),
        'DOC-NEU-001',
        'Dr. Priya Raman',
        'MBBS, DM',
        'Neurologist',
        'available',
        500.00,
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Doctors WHERE DoctorCode = 'DOC-ORT-001')
BEGIN
    INSERT INTO dbo.Doctors (DoctorId, DomainId, DepartmentId, DoctorCode, DoctorName, Qualification, Specialization, AvailabilityStatus, ConsultationFee, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        NEWID(),
        (SELECT DomainId FROM dbo.Domains WHERE DomainCode = 'hospital'),
        (SELECT DepartmentId FROM dbo.Departments WHERE DepartmentCode = 'orthopedics'),
        'DOC-ORT-001',
        'Dr. Manoj Kumar',
        'MBBS, MS',
        'Orthopedic Surgeon',
        'available',
        500.00,
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Doctors WHERE DoctorCode = 'DOC-PED-001')
BEGIN
    INSERT INTO dbo.Doctors (DoctorId, DomainId, DepartmentId, DoctorCode, DoctorName, Qualification, Specialization, AvailabilityStatus, ConsultationFee, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        NEWID(),
        (SELECT DomainId FROM dbo.Domains WHERE DomainCode = 'hospital'),
        (SELECT DepartmentId FROM dbo.Departments WHERE DepartmentCode = 'pediatrics'),
        'DOC-PED-001',
        'Dr. Meera Nair',
        'MBBS, MD',
        'Pediatrician',
        'available',
        500.00,
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;
GO

;WITH TargetDates AS (
    SELECT CAST(GETDATE() AS DATE) AS ScheduleDate
    UNION ALL
    SELECT DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
    UNION ALL
    SELECT DATEADD(DAY, 2, CAST(GETDATE() AS DATE))
    UNION ALL
    SELECT DATEADD(DAY, 3, CAST(GETDATE() AS DATE))
    UNION ALL
    SELECT DATEADD(DAY, 4, CAST(GETDATE() AS DATE))
    UNION ALL
    SELECT DATEADD(DAY, 5, CAST(GETDATE() AS DATE))
    UNION ALL
    SELECT DATEADD(DAY, 6, CAST(GETDATE() AS DATE))
),
TargetTimes AS (
    SELECT CAST('09:00:00' AS TIME) AS StartTime, CAST('10:00:00' AS TIME) AS EndTime
    UNION ALL
    SELECT CAST('10:00:00' AS TIME), CAST('11:00:00' AS TIME)
    UNION ALL
    SELECT CAST('16:00:00' AS TIME), CAST('17:00:00' AS TIME)
)
INSERT INTO dbo.DoctorSchedules (
    ScheduleId,
    DoctorId,
    ScheduleDate,
    StartTime,
    EndTime,
    MaxSlots,
    AvailableSlots,
    Status,
    CreatedAt,
    UpdatedAt
)
SELECT
    NEWID(),
    d.DoctorId,
    td.ScheduleDate,
    tt.StartTime,
    tt.EndTime,
    5,
    5,
    'open',
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
FROM dbo.Doctors d
CROSS JOIN TargetDates td
CROSS JOIN TargetTimes tt
WHERE d.DoctorCode IN ('DOC-CAR-001', 'DOC-CAR-002', 'DOC-NEU-001', 'DOC-ORT-001', 'DOC-PED-001')
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.DoctorSchedules s
      WHERE s.DoctorId = d.DoctorId
        AND s.ScheduleDate = td.ScheduleDate
        AND s.StartTime = tt.StartTime
  );
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Patients WHERE PatientCode = 'PAT-DEMO-001')
BEGIN
    INSERT INTO dbo.Patients (PatientId, PatientCode, FullName, PhoneNumber, Email, Gender, CreatedAt, UpdatedAt)
    VALUES (NEWID(), 'PAT-DEMO-001', 'Suresh Kumar', '9876543210', 'suresh@example.com', 'male', SYSUTCDATETIME(), SYSUTCDATETIME());
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Patients WHERE PatientCode = 'PAT-DEMO-002')
BEGIN
    INSERT INTO dbo.Patients (PatientId, PatientCode, FullName, PhoneNumber, Email, Gender, CreatedAt, UpdatedAt)
    VALUES (NEWID(), 'PAT-DEMO-002', 'Lakshmi Devi', '9876543211', 'lakshmi@example.com', 'female', SYSUTCDATETIME(), SYSUTCDATETIME());
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Patients WHERE PatientCode = 'PAT-DEMO-003')
BEGIN
    INSERT INTO dbo.Patients (PatientId, PatientCode, FullName, PhoneNumber, Email, Gender, CreatedAt, UpdatedAt)
    VALUES (NEWID(), 'PAT-DEMO-003', 'Arun Prakash', '9876543212', 'arun@example.com', 'male', SYSUTCDATETIME(), SYSUTCDATETIME());
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Appointments WHERE AppointmentCode = 'APT-DEMO-001')
BEGIN
    INSERT INTO dbo.Appointments (
        AppointmentId, AppointmentCode, PatientId, DoctorId, DepartmentId,
        AppointmentDate, AppointmentTime, ReasonForVisit, AppointmentStatus,
        BookedChannel, CreatedAt, UpdatedAt
    )
    VALUES (
        NEWID(),
        'APT-DEMO-001',
        (SELECT PatientId FROM dbo.Patients WHERE PatientCode = 'PAT-DEMO-001'),
        (SELECT DoctorId FROM dbo.Doctors WHERE DoctorCode = 'DOC-CAR-001'),
        (SELECT DepartmentId FROM dbo.Departments WHERE DepartmentCode = 'cardiology'),
        CAST(GETDATE() AS DATE), CAST('09:00:00' AS TIME), 'Chest pain follow-up', 'booked',
        'ivr', SYSUTCDATETIME(), SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Appointments WHERE AppointmentCode = 'APT-DEMO-002')
BEGIN
    INSERT INTO dbo.Appointments (
        AppointmentId, AppointmentCode, PatientId, DoctorId, DepartmentId,
        AppointmentDate, AppointmentTime, ReasonForVisit, AppointmentStatus,
        BookedChannel, CreatedAt, UpdatedAt
    )
    VALUES (
        NEWID(),
        'APT-DEMO-002',
        (SELECT PatientId FROM dbo.Patients WHERE PatientCode = 'PAT-DEMO-002'),
        (SELECT DoctorId FROM dbo.Doctors WHERE DoctorCode = 'DOC-NEU-001'),
        (SELECT DepartmentId FROM dbo.Departments WHERE DepartmentCode = 'neurology'),
        DATEADD(DAY, 1, CAST(GETDATE() AS DATE)), CAST('10:00:00' AS TIME), 'Migraine review', 'booked',
        'ivr', SYSUTCDATETIME(), SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Appointments WHERE AppointmentCode = 'APT-DEMO-003')
BEGIN
    INSERT INTO dbo.Appointments (
        AppointmentId, AppointmentCode, PatientId, DoctorId, DepartmentId,
        AppointmentDate, AppointmentTime, ReasonForVisit, AppointmentStatus,
        BookedChannel, CreatedAt, UpdatedAt
    )
    VALUES (
        NEWID(),
        'APT-DEMO-003',
        (SELECT PatientId FROM dbo.Patients WHERE PatientCode = 'PAT-DEMO-003'),
        (SELECT DoctorId FROM dbo.Doctors WHERE DoctorCode = 'DOC-PED-001'),
        (SELECT DepartmentId FROM dbo.Departments WHERE DepartmentCode = 'pediatrics'),
        DATEADD(DAY, 2, CAST(GETDATE() AS DATE)), CAST('16:00:00' AS TIME), 'Routine fever consultation', 'booked',
        'ivr', SYSUTCDATETIME(), SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Billing WHERE InvoiceNumber = 'INV-DEMO-001')
BEGIN
    INSERT INTO dbo.Billing (BillingId, PatientId, AppointmentId, InvoiceNumber, TotalAmount, PaidAmount, BillingStatus, DueDate, CreatedAt, UpdatedAt)
    VALUES (
        NEWID(),
        (SELECT PatientId FROM dbo.Patients WHERE PatientCode = 'PAT-DEMO-001'),
        (SELECT AppointmentId FROM dbo.Appointments WHERE AppointmentCode = 'APT-DEMO-001'),
        'INV-DEMO-001',
        1500.00,
        500.00,
        'partially_paid',
        DATEADD(DAY, 3, CAST(GETDATE() AS DATE)),
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Billing WHERE InvoiceNumber = 'INV-DEMO-002')
BEGIN
    INSERT INTO dbo.Billing (BillingId, PatientId, AppointmentId, InvoiceNumber, TotalAmount, PaidAmount, BillingStatus, DueDate, CreatedAt, UpdatedAt)
    VALUES (
        NEWID(),
        (SELECT PatientId FROM dbo.Patients WHERE PatientCode = 'PAT-DEMO-002'),
        (SELECT AppointmentId FROM dbo.Appointments WHERE AppointmentCode = 'APT-DEMO-002'),
        'INV-DEMO-002',
        2200.00,
        2200.00,
        'paid',
        NULL,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LabReports WHERE ReportNumber = 'LAB-DEMO-001')
BEGIN
    INSERT INTO dbo.LabReports (LabReportId, PatientId, AppointmentId, ReportNumber, TestName, ReportStatus, ResultSummary, ReportDate, CreatedAt, UpdatedAt)
    VALUES (
        NEWID(),
        (SELECT PatientId FROM dbo.Patients WHERE PatientCode = 'PAT-DEMO-001'),
        (SELECT AppointmentId FROM dbo.Appointments WHERE AppointmentCode = 'APT-DEMO-001'),
        'LAB-DEMO-001',
        'ECG',
        'ready',
        'Sinus rhythm observed.',
        SYSUTCDATETIME(),
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.LabReports WHERE ReportNumber = 'LAB-DEMO-002')
BEGIN
    INSERT INTO dbo.LabReports (LabReportId, PatientId, AppointmentId, ReportNumber, TestName, ReportStatus, ResultSummary, ReportDate, CreatedAt, UpdatedAt)
    VALUES (
        NEWID(),
        (SELECT PatientId FROM dbo.Patients WHERE PatientCode = 'PAT-DEMO-003'),
        (SELECT AppointmentId FROM dbo.Appointments WHERE AppointmentCode = 'APT-DEMO-003'),
        'LAB-DEMO-002',
        'CBC',
        'processing',
        'Sample received and under analysis.',
        NULL,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;
GO
