-- ============================================================
-- DDL: Generic IVR Engine Tables
-- Database: MSSQL (ivr_platform)
-- No constraints or indexes (prototyping mode)
-- ============================================================

-- IvrFlows: Configurable flow definitions per domain
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='IvrFlows' AND xtype='U')
CREATE TABLE IvrFlows (
  FlowId uniqueidentifier DEFAULT NEWID() NOT NULL,
  DomainId uniqueidentifier NOT NULL,
  FlowCode nvarchar(100) NOT NULL,
  FlowName nvarchar(200) NOT NULL,
  Description nvarchar(500) NULL,
  IsEntryFlow bit DEFAULT 0 NOT NULL,
  FlowVersion int DEFAULT 1 NOT NULL,
  IsActive bit DEFAULT 1 NOT NULL,
  CreatedAt datetime2 DEFAULT GETUTCDATE() NOT NULL,
  UpdatedAt datetime2 DEFAULT GETUTCDATE() NOT NULL
);
GO

-- IvrFlowNodes: Steps/menus in a flow
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='IvrFlowNodes' AND xtype='U')
CREATE TABLE IvrFlowNodes (
  NodeId uniqueidentifier DEFAULT NEWID() NOT NULL,
  FlowId uniqueidentifier NOT NULL,
  NodeCode nvarchar(100) NOT NULL,
  NodeType nvarchar(60) NOT NULL,
  NodeLabel nvarchar(200) NULL,
  PromptText nvarchar(max) NULL,
  SortOrder int DEFAULT 0 NOT NULL,
  NextNodeCode nvarchar(100) NULL,
  BranchConfig nvarchar(max) NULL,
  TimeoutSeconds int DEFAULT 30 NULL,
  MaxRetries int DEFAULT 3 NULL,
  MetadataJson nvarchar(max) NULL,
  IsActive bit DEFAULT 1 NOT NULL,
  CreatedAt datetime2 DEFAULT GETUTCDATE() NOT NULL
);
GO

-- IvrNodeActions: Actions triggered at each node
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='IvrNodeActions' AND xtype='U')
CREATE TABLE IvrNodeActions (
  ActionId uniqueidentifier DEFAULT NEWID() NOT NULL,
  NodeId uniqueidentifier NOT NULL,
  ActionType nvarchar(60) NOT NULL,
  ActionOrder int DEFAULT 0 NOT NULL,
  ToolName nvarchar(120) NULL,
  EndpointId uniqueidentifier NULL,
  RequestMapping nvarchar(max) NULL,
  ResponseMapping nvarchar(max) NULL,
  FallbackResponse nvarchar(max) NULL,
  IsActive bit DEFAULT 1 NOT NULL,
  CreatedAt datetime2 DEFAULT GETUTCDATE() NOT NULL
);
GO

-- DomainApiEndpoints: External API registry per domain
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DomainApiEndpoints' AND xtype='U')
CREATE TABLE DomainApiEndpoints (
  EndpointId uniqueidentifier DEFAULT NEWID() NOT NULL,
  DomainId uniqueidentifier NOT NULL,
  EndpointCode nvarchar(100) NOT NULL,
  EndpointName nvarchar(200) NOT NULL,
  HttpMethod nvarchar(10) DEFAULT 'GET' NOT NULL,
  BaseUrl nvarchar(500) NOT NULL,
  Path nvarchar(500) NOT NULL,
  HeadersJson nvarchar(max) NULL,
  AuthType nvarchar(60) DEFAULT 'none' NOT NULL,
  AuthConfig nvarchar(max) NULL,
  TimeoutMs int DEFAULT 30000 NULL,
  RetryCount int DEFAULT 2 NULL,
  IsActive bit DEFAULT 1 NOT NULL,
  CreatedAt datetime2 DEFAULT GETUTCDATE() NOT NULL,
  UpdatedAt datetime2 DEFAULT GETUTCDATE() NOT NULL
);
GO

-- ErrorLogs: Centralized error tracking
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ErrorLogs' AND xtype='U')
CREATE TABLE ErrorLogs (
  ErrorLogId uniqueidentifier DEFAULT NEWID() NOT NULL,
  DomainId uniqueidentifier NULL,
  ConversationId uniqueidentifier NULL,
  ErrorSource nvarchar(100) NOT NULL,
  ErrorCode nvarchar(60) NULL,
  ErrorMessage nvarchar(max) NOT NULL,
  RequestJson nvarchar(max) NULL,
  ResponseJson nvarchar(max) NULL,
  StackTrace nvarchar(max) NULL,
  Severity nvarchar(30) DEFAULT 'error' NOT NULL,
  CreatedAt datetime2 DEFAULT GETUTCDATE() NOT NULL
);
GO
