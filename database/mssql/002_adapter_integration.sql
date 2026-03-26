-- ============================================================
-- Migration 002: Adapter Integration Layer
-- Adds tables for domain adapter configuration, tool execution
-- logging, escalation tracking, and session analytics.
-- ============================================================

-- ── Domain Adapter Configurations ─────────────────────────────

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DomainAdapterConfigs')
BEGIN
    CREATE TABLE DomainAdapterConfigs (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        DomainId        NVARCHAR(64)   NOT NULL,
        AdapterType     NVARCHAR(50)   NOT NULL,
        OrganizationName NVARCHAR(200) NOT NULL DEFAULT '',
        ApiBaseUrl      NVARCHAR(500)  NOT NULL DEFAULT '',
        ApiKey          NVARCHAR(500)  NOT NULL DEFAULT '',
        AuthType        NVARCHAR(20)   NOT NULL DEFAULT 'none',
        AuthConfig      NVARCHAR(MAX)  NOT NULL DEFAULT '{}',
        CustomSettings  NVARCHAR(MAX)  NOT NULL DEFAULT '{}',
        TimeoutSeconds  INT            NOT NULL DEFAULT 30,
        MaxRetries      INT            NOT NULL DEFAULT 3,
        IsActive        BIT            NOT NULL DEFAULT 1,
        CreatedAt       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT UQ_DomainAdapterConfigs_DomainId UNIQUE (DomainId)
    );

    CREATE INDEX IX_DomainAdapterConfigs_AdapterType
        ON DomainAdapterConfigs (AdapterType);
END
GO

-- ── Tool Execution Logs ───────────────────────────────────────

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ToolExecutionLogs')
BEGIN
    CREATE TABLE ToolExecutionLogs (
        Id              BIGINT IDENTITY(1,1) PRIMARY KEY,
        SessionId       NVARCHAR(50)   NOT NULL,
        DomainId        NVARCHAR(64)   NOT NULL,
        ToolName        NVARCHAR(100)  NOT NULL,
        Arguments       NVARCHAR(MAX)  NOT NULL DEFAULT '{}',
        ResponseOk      BIT            NOT NULL DEFAULT 0,
        ResponseStatus  NVARCHAR(20)   NOT NULL DEFAULT 'unknown',
        ResponseData    NVARCHAR(MAX)  NULL,
        ErrorMessage    NVARCHAR(MAX)  NULL,
        AttemptCount    INT            NOT NULL DEFAULT 1,
        DurationMs      INT            NOT NULL DEFAULT 0,
        CreatedAt       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),

        INDEX IX_ToolExecutionLogs_DomainId (DomainId),
        INDEX IX_ToolExecutionLogs_SessionId (SessionId),
        INDEX IX_ToolExecutionLogs_CreatedAt (CreatedAt DESC)
    );
END
GO

-- ── Escalation Tracking ──────────────────────────────────────

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EscalationRecords')
BEGIN
    CREATE TABLE EscalationRecords (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        EscalationId    NVARCHAR(50)   NOT NULL,
        SessionId       NVARCHAR(50)   NOT NULL,
        DomainId        NVARCHAR(64)   NOT NULL,
        CallerPhone     NVARCHAR(20)   NOT NULL DEFAULT '',
        Reason          NVARCHAR(500)  NOT NULL DEFAULT '',
        Department      NVARCHAR(100)  NOT NULL DEFAULT 'general',
        Priority        NVARCHAR(20)   NOT NULL DEFAULT 'normal',
        Channel         NVARCHAR(20)   NOT NULL DEFAULT 'queue',
        Status          NVARCHAR(20)   NOT NULL DEFAULT 'pending',
        ContextSummary  NVARCHAR(MAX)  NULL,
        CreatedAt       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
        ResolvedAt      DATETIME2      NULL,

        CONSTRAINT UQ_EscalationRecords_EscalationId UNIQUE (EscalationId),
        INDEX IX_EscalationRecords_DomainId (DomainId),
        INDEX IX_EscalationRecords_Status (Status)
    );
END
GO

-- ── Session Analytics ────────────────────────────────────────

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SessionAnalytics')
BEGIN
    CREATE TABLE SessionAnalytics (
        Id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        SessionId           NVARCHAR(50)   NOT NULL,
        DomainId            NVARCHAR(64)   NOT NULL,
        CallerPhone         NVARCHAR(20)   NOT NULL DEFAULT '',
        StartedAt           DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
        EndedAt             DATETIME2      NULL,
        DurationSeconds     DECIMAL(10,1)  NOT NULL DEFAULT 0,
        IntentsDetected     NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        ToolsCalled         NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        ToolSuccessCount    INT            NOT NULL DEFAULT 0,
        ToolFailureCount    INT            NOT NULL DEFAULT 0,
        Escalated           BIT            NOT NULL DEFAULT 0,
        EscalationReason    NVARCHAR(500)  NULL,
        Resolution          NVARCHAR(20)   NOT NULL DEFAULT 'unknown',

        CONSTRAINT UQ_SessionAnalytics_SessionId UNIQUE (SessionId),
        INDEX IX_SessionAnalytics_DomainId (DomainId),
        INDEX IX_SessionAnalytics_StartedAt (StartedAt DESC)
    );
END
GO

-- ── Intent Classification Cache ──────────────────────────────

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IntentClassificationCache')
BEGIN
    CREATE TABLE IntentClassificationCache (
        Id              BIGINT IDENTITY(1,1) PRIMARY KEY,
        DomainId        NVARCHAR(64)   NOT NULL,
        InputText       NVARCHAR(500)  NOT NULL,
        InputHash       NVARCHAR(64)   NOT NULL,
        ClassifiedIntent NVARCHAR(100) NULL,
        InScope         BIT            NOT NULL DEFAULT 0,
        Confidence      DECIMAL(3,2)   NOT NULL DEFAULT 0,
        ClassifiedBy    NVARCHAR(20)   NOT NULL DEFAULT 'ai',
        CreatedAt       DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),

        INDEX IX_IntentClassificationCache_Lookup (DomainId, InputHash)
    );
END
GO

PRINT 'Migration 002: Adapter Integration tables created successfully.';
GO
