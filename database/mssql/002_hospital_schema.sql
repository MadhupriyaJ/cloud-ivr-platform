IF OBJECT_ID('dbo.LabReports', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LabReports (
        LabReportId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_LabReports PRIMARY KEY DEFAULT NEWID(),
        PatientId UNIQUEIDENTIFIER NOT NULL,
        AppointmentId UNIQUEIDENTIFIER NULL,
        ReportNumber NVARCHAR(40) NOT NULL,
        TestName NVARCHAR(120) NOT NULL,
        ReportStatus NVARCHAR(40) NOT NULL,
        ResultSummary NVARCHAR(500) NULL,
        ReportDate DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_LabReports_ReportNumber UNIQUE (ReportNumber)
    );
END;
GO

IF OBJECT_ID('dbo.Billing', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Billing (
        BillingId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_Billing PRIMARY KEY DEFAULT NEWID(),
        PatientId UNIQUEIDENTIFIER NOT NULL,
        AppointmentId UNIQUEIDENTIFIER NULL,
        InvoiceNumber NVARCHAR(40) NOT NULL,
        TotalAmount DECIMAL(12, 2) NOT NULL,
        PaidAmount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        BillingStatus NVARCHAR(40) NOT NULL,
        DueDate DATE NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_Billing_PaidAmount CHECK (PaidAmount >= 0),
        CONSTRAINT CK_Billing_TotalAmount CHECK (TotalAmount >= 0),
        CONSTRAINT UQ_Billing_InvoiceNumber UNIQUE (InvoiceNumber)
    );
END;
GO

IF OBJECT_ID('dbo.Appointments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Appointments (
        AppointmentId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_Appointments PRIMARY KEY DEFAULT NEWID(),
        AppointmentCode NVARCHAR(30) NOT NULL,
        PatientId UNIQUEIDENTIFIER NOT NULL,
        DoctorId UNIQUEIDENTIFIER NOT NULL,
        DepartmentId UNIQUEIDENTIFIER NOT NULL,
        AppointmentDate DATE NOT NULL,
        AppointmentTime TIME NOT NULL,
        ReasonForVisit NVARCHAR(500) NULL,
        AppointmentStatus NVARCHAR(40) NOT NULL,
        BookedChannel NVARCHAR(40) NOT NULL DEFAULT 'ivr',
        ConversationId UNIQUEIDENTIFIER NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Appointments_AppointmentCode UNIQUE (AppointmentCode)
    );
END;
GO

IF OBJECT_ID('dbo.DoctorSchedules', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DoctorSchedules (
        ScheduleId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_DoctorSchedules PRIMARY KEY DEFAULT NEWID(),
        DoctorId UNIQUEIDENTIFIER NOT NULL,
        ScheduleDate DATE NOT NULL,
        StartTime TIME NOT NULL,
        EndTime TIME NOT NULL,
        MaxSlots INT NOT NULL,
        AvailableSlots INT NOT NULL,
        Status NVARCHAR(40) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_DoctorSchedules_Slots CHECK (
            MaxSlots >= 0
            AND AvailableSlots >= 0
            AND AvailableSlots <= MaxSlots
        ),
        CONSTRAINT UQ_DoctorSchedules_DoctorDateTime UNIQUE (DoctorId, ScheduleDate, StartTime)
    );
END;
GO

IF OBJECT_ID('dbo.Patients', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Patients (
        PatientId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_Patients PRIMARY KEY DEFAULT NEWID(),
        PatientCode NVARCHAR(30) NOT NULL,
        FullName NVARCHAR(120) NOT NULL,
        PhoneNumber NVARCHAR(30) NOT NULL,
        Email NVARCHAR(180) NULL,
        DateOfBirth DATE NULL,
        Gender NVARCHAR(20) NULL,
        AddressLine NVARCHAR(255) NULL,
        EmergencyContact NVARCHAR(120) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Patients_PatientCode UNIQUE (PatientCode)
    );
END;
GO

IF OBJECT_ID('dbo.Doctors', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Doctors (
        DoctorId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_Doctors PRIMARY KEY DEFAULT NEWID(),
        DomainId UNIQUEIDENTIFIER NOT NULL,
        DepartmentId UNIQUEIDENTIFIER NOT NULL,
        DoctorCode NVARCHAR(50) NOT NULL,
        DoctorName NVARCHAR(120) NOT NULL,
        Qualification NVARCHAR(200) NULL,
        Specialization NVARCHAR(120) NULL,
        AvailabilityStatus NVARCHAR(40) NOT NULL,
        ConsultationFee DECIMAL(12, 2) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Doctors_DoctorCode UNIQUE (DoctorCode)
    );
END;
GO

IF OBJECT_ID('dbo.Departments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Departments (
        DepartmentId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_Departments PRIMARY KEY DEFAULT NEWID(),
        DomainId UNIQUEIDENTIFIER NOT NULL,
        DepartmentCode NVARCHAR(50) NOT NULL,
        DepartmentName NVARCHAR(120) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Departments_DomainCode UNIQUE (DomainId, DepartmentCode)
    );
END;
GO

IF OBJECT_ID('dbo.FK_Departments_Domains', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Departments
    ADD CONSTRAINT FK_Departments_Domains
        FOREIGN KEY (DomainId) REFERENCES dbo.Domains(DomainId);
END;
GO

IF OBJECT_ID('dbo.FK_Doctors_Domains', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Doctors
    ADD CONSTRAINT FK_Doctors_Domains
        FOREIGN KEY (DomainId) REFERENCES dbo.Domains(DomainId);
END;
GO

IF OBJECT_ID('dbo.FK_Doctors_Departments', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Doctors
    ADD CONSTRAINT FK_Doctors_Departments
        FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(DepartmentId);
END;
GO

IF OBJECT_ID('dbo.FK_DoctorSchedules_Doctors', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.DoctorSchedules
    ADD CONSTRAINT FK_DoctorSchedules_Doctors
        FOREIGN KEY (DoctorId) REFERENCES dbo.Doctors(DoctorId);
END;
GO

IF OBJECT_ID('dbo.FK_Appointments_Patients', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Appointments
    ADD CONSTRAINT FK_Appointments_Patients
        FOREIGN KEY (PatientId) REFERENCES dbo.Patients(PatientId);
END;
GO

IF OBJECT_ID('dbo.FK_Appointments_Doctors', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Appointments
    ADD CONSTRAINT FK_Appointments_Doctors
        FOREIGN KEY (DoctorId) REFERENCES dbo.Doctors(DoctorId);
END;
GO

IF OBJECT_ID('dbo.FK_Appointments_Departments', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Appointments
    ADD CONSTRAINT FK_Appointments_Departments
        FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(DepartmentId);
END;
GO

IF OBJECT_ID('dbo.FK_Appointments_Conversations', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Appointments
    ADD CONSTRAINT FK_Appointments_Conversations
        FOREIGN KEY (ConversationId) REFERENCES dbo.Conversations(ConversationId);
END;
GO

IF OBJECT_ID('dbo.FK_Billing_Patients', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Billing
    ADD CONSTRAINT FK_Billing_Patients
        FOREIGN KEY (PatientId) REFERENCES dbo.Patients(PatientId);
END;
GO

IF OBJECT_ID('dbo.FK_Billing_Appointments', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Billing
    ADD CONSTRAINT FK_Billing_Appointments
        FOREIGN KEY (AppointmentId) REFERENCES dbo.Appointments(AppointmentId);
END;
GO

IF OBJECT_ID('dbo.FK_LabReports_Patients', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.LabReports
    ADD CONSTRAINT FK_LabReports_Patients
        FOREIGN KEY (PatientId) REFERENCES dbo.Patients(PatientId);
END;
GO

IF OBJECT_ID('dbo.FK_LabReports_Appointments', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.LabReports
    ADD CONSTRAINT FK_LabReports_Appointments
        FOREIGN KEY (AppointmentId) REFERENCES dbo.Appointments(AppointmentId);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Doctors_DepartmentId_IsActive'
      AND object_id = OBJECT_ID('dbo.Doctors')
)
BEGIN
    CREATE INDEX IX_Doctors_DepartmentId_IsActive
        ON dbo.Doctors (DepartmentId, IsActive, AvailabilityStatus);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_DoctorSchedules_DoctorDate'
      AND object_id = OBJECT_ID('dbo.DoctorSchedules')
)
BEGIN
    CREATE INDEX IX_DoctorSchedules_DoctorDate
        ON dbo.DoctorSchedules (DoctorId, ScheduleDate, AvailableSlots);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Patients_PhoneNumber'
      AND object_id = OBJECT_ID('dbo.Patients')
)
BEGIN
    CREATE INDEX IX_Patients_PhoneNumber
        ON dbo.Patients (PhoneNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Appointments_Patient_Status_Date'
      AND object_id = OBJECT_ID('dbo.Appointments')
)
BEGIN
    CREATE INDEX IX_Appointments_Patient_Status_Date
        ON dbo.Appointments (PatientId, AppointmentStatus, AppointmentDate, AppointmentTime);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Billing_Patient_Status'
      AND object_id = OBJECT_ID('dbo.Billing')
)
BEGIN
    CREATE INDEX IX_Billing_Patient_Status
        ON dbo.Billing (PatientId, BillingStatus);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_LabReports_Patient_Status'
      AND object_id = OBJECT_ID('dbo.LabReports')
)
BEGIN
    CREATE INDEX IX_LabReports_Patient_Status
        ON dbo.LabReports (PatientId, ReportStatus);
END;
GO
