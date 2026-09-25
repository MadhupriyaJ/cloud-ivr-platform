/*
  Migration 004 - Escalation lifecycle + telephony (phone number -> IVR)

  Idempotent: safe to run repeatedly against an existing database.
  Run with:  node backend-nestjs/scripts/migrate.mjs database/mssql/004_escalation_telephony.sql
*/

/* ─────────────────────────────────────────────────────────────
   1. Escalations: full lifecycle columns
   ───────────────────────────────────────────────────────────── */
IF COL_LENGTH('Escalations', 'DomainId') IS NULL
    ALTER TABLE Escalations ADD DomainId UNIQUEIDENTIFIER NULL;
GO
IF COL_LENGTH('Escalations', 'Status') IS NULL
    ALTER TABLE Escalations ADD Status NVARCHAR(40) NOT NULL CONSTRAINT DF_Escalations_Status DEFAULT 'pending';
GO
IF COL_LENGTH('Escalations', 'Priority') IS NULL
    ALTER TABLE Escalations ADD Priority NVARCHAR(20) NOT NULL CONSTRAINT DF_Escalations_Priority DEFAULT 'normal';
GO
IF COL_LENGTH('Escalations', 'Channel') IS NULL
    ALTER TABLE Escalations ADD Channel NVARCHAR(30) NOT NULL CONSTRAINT DF_Escalations_Channel DEFAULT 'queue';
GO
IF COL_LENGTH('Escalations', 'QueueName') IS NULL
    ALTER TABLE Escalations ADD QueueName NVARCHAR(120) NULL;
GO
IF COL_LENGTH('Escalations', 'SkillGroup') IS NULL
    ALTER TABLE Escalations ADD SkillGroup NVARCHAR(120) NULL;
GO
IF COL_LENGTH('Escalations', 'CallerIdentifier') IS NULL
    ALTER TABLE Escalations ADD CallerIdentifier NVARCHAR(180) NULL;
GO
IF COL_LENGTH('Escalations', 'CallSid') IS NULL
    ALTER TABLE Escalations ADD CallSid NVARCHAR(120) NULL;
GO
IF COL_LENGTH('Escalations', 'TransferTarget') IS NULL
    ALTER TABLE Escalations ADD TransferTarget NVARCHAR(60) NULL;
GO
IF COL_LENGTH('Escalations', 'ContextSummary') IS NULL
    ALTER TABLE Escalations ADD ContextSummary NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('Escalations', 'ResolutionNotes') IS NULL
    ALTER TABLE Escalations ADD ResolutionNotes NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('Escalations', 'AssignedAt') IS NULL
    ALTER TABLE Escalations ADD AssignedAt DATETIME2 NULL;
GO
IF COL_LENGTH('Escalations', 'UpdatedAt') IS NULL
    ALTER TABLE Escalations ADD UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Escalations_UpdatedAt DEFAULT SYSUTCDATETIME();
GO

/* Backfill status for rows created before this migration. */
UPDATE Escalations
   SET Status = CASE
                  WHEN ClosedAt   IS NOT NULL THEN 'resolved'
                  WHEN AcceptedAt IS NOT NULL THEN 'accepted'
                  WHEN AssignedAgentId IS NOT NULL THEN 'assigned'
                  ELSE 'pending'
                END
 WHERE Status = 'pending' AND (ClosedAt IS NOT NULL OR AcceptedAt IS NOT NULL OR AssignedAgentId IS NOT NULL);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Escalations_Status' AND object_id = OBJECT_ID('Escalations'))
    CREATE INDEX IX_Escalations_Status ON Escalations (Status, EscalatedAt DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Escalations_Conversation' AND object_id = OBJECT_ID('Escalations'))
    CREATE INDEX IX_Escalations_Conversation ON Escalations (ConversationId);
GO

/* ─────────────────────────────────────────────────────────────
   2. Agents: presence + concurrent-load tracking
   ───────────────────────────────────────────────────────────── */
IF COL_LENGTH('Agents', 'ActiveEscalations') IS NULL
    ALTER TABLE Agents ADD ActiveEscalations INT NOT NULL CONSTRAINT DF_Agents_ActiveEscalations DEFAULT 0;
GO
IF COL_LENGTH('Agents', 'MaxConcurrent') IS NULL
    ALTER TABLE Agents ADD MaxConcurrent INT NOT NULL CONSTRAINT DF_Agents_MaxConcurrent DEFAULT 1;
GO
IF COL_LENGTH('Agents', 'PhoneNumber') IS NULL
    ALTER TABLE Agents ADD PhoneNumber NVARCHAR(32) NULL;
GO
IF COL_LENGTH('Agents', 'LastSeenAt') IS NULL
    ALTER TABLE Agents ADD LastSeenAt DATETIME2 NULL;
GO

/* ─────────────────────────────────────────────────────────────
   3. Telephony: phone number -> domain routing
   ───────────────────────────────────────────────────────────── */
IF OBJECT_ID('PhoneNumbers', 'U') IS NULL
CREATE TABLE PhoneNumbers (
    PhoneNumberId        UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    PhoneNumber          NVARCHAR(32)  NOT NULL UNIQUE,   -- E.164, e.g. +14155550123
    FriendlyName         NVARCHAR(120) NULL,
    DomainId             UNIQUEIDENTIFIER NOT NULL,
    Provider             NVARCHAR(40)  NOT NULL DEFAULT 'twilio',
    EscalationNumber     NVARCHAR(32)  NULL,              -- human fallback for live transfer
    EscalationSkillGroup NVARCHAR(120) NULL,
    GreetingOverride     NVARCHAR(500) NULL,
    IsActive             BIT NOT NULL DEFAULT 1,
    CreatedAt            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PhoneNumbers_Domains FOREIGN KEY (DomainId) REFERENCES Domains(DomainId)
);
GO

/* ─────────────────────────────────────────────────────────────
   4. Telephony: per-call log
   ───────────────────────────────────────────────────────────── */
IF OBJECT_ID('CallSessions', 'U') IS NULL
CREATE TABLE CallSessions (
    CallId          UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    CallSid         NVARCHAR(120) NOT NULL UNIQUE,
    ConversationId  UNIQUEIDENTIFIER NULL,
    DomainId        UNIQUEIDENTIFIER NULL,
    FromNumber      NVARCHAR(32) NULL,
    ToNumber        NVARCHAR(32) NULL,
    Direction       NVARCHAR(20) NOT NULL DEFAULT 'inbound',
    CallStatus      NVARCHAR(40) NOT NULL DEFAULT 'ringing',
    EscalationId    UNIQUEIDENTIFIER NULL,
    StartedAt       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    AnsweredAt      DATETIME2 NULL,
    EndedAt         DATETIME2 NULL,
    DurationSeconds INT NULL,
    HangupCause     NVARCHAR(80) NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CallSessions_StartedAt' AND object_id = OBJECT_ID('CallSessions'))
    CREATE INDEX IX_CallSessions_StartedAt ON CallSessions (StartedAt DESC);
GO
