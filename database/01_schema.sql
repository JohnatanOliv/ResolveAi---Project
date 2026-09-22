/*
    Resolve Ai - SQL Server schema
    Execute once in a new database from SQL Server Management Studio.
*/

IF DB_ID(N'ResolveAi') IS NULL
BEGIN
    CREATE DATABASE ResolveAi;
END;
GO

USE ResolveAi;
GO

CREATE TABLE dbo.Users
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Users PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Name NVARCHAR(120) NOT NULL,
    Email NVARCHAR(254) NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    Role VARCHAR(20) NOT NULL CONSTRAINT CK_Users_Role CHECK (Role IN ('SOLICITANTE', 'GESTOR')),
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_Users_Email ON dbo.Users (Email);
GO

CREATE TABLE dbo.Occurrences
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Occurrences PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Title NVARCHAR(160) NOT NULL,
    Description NVARCHAR(MAX) NOT NULL,
    Category NVARCHAR(80) NOT NULL,
    Location NVARCHAR(240) NOT NULL,
    ImageUrl NVARCHAR(2048) NULL,
    Priority VARCHAR(20) NOT NULL CONSTRAINT DF_Occurrences_Priority DEFAULT 'MEDIA',
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Occurrences_Status DEFAULT 'ABERTA',
    RequesterId UNIQUEIDENTIFIER NOT NULL,
    AssigneeId UNIQUEIDENTIFIER NULL,
    Solution NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Occurrences_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Occurrences_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Occurrences_Priority CHECK (Priority IN ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE')),
    CONSTRAINT CK_Occurrences_Status CHECK (Status IN ('ABERTA', 'EM_ANALISE', 'EM_ATENDIMENTO', 'RESOLVIDA', 'CANCELADA')),
    CONSTRAINT FK_Occurrences_Requester FOREIGN KEY (RequesterId) REFERENCES dbo.Users (Id),
    CONSTRAINT FK_Occurrences_Assignee FOREIGN KEY (AssigneeId) REFERENCES dbo.Users (Id)
);
GO

CREATE INDEX IX_Occurrences_RequesterId ON dbo.Occurrences (RequesterId);
CREATE INDEX IX_Occurrences_Status_Priority ON dbo.Occurrences (Status, Priority);
CREATE INDEX IX_Occurrences_Category ON dbo.Occurrences (Category);
CREATE INDEX IX_Occurrences_CreatedAt ON dbo.Occurrences (CreatedAt DESC);
GO

CREATE TABLE dbo.OccurrenceStatusHistory
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_OccurrenceStatusHistory PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    OccurrenceId UNIQUEIDENTIFIER NOT NULL,
    PreviousStatus VARCHAR(20) NULL,
    NewStatus VARCHAR(20) NOT NULL,
    Note NVARCHAR(500) NULL,
    ChangedBy UNIQUEIDENTIFIER NOT NULL,
    ChangedAt DATETIME2(3) NOT NULL CONSTRAINT DF_StatusHistory_ChangedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_StatusHistory_PreviousStatus CHECK (PreviousStatus IS NULL OR PreviousStatus IN ('ABERTA', 'EM_ANALISE', 'EM_ATENDIMENTO', 'RESOLVIDA', 'CANCELADA')),
    CONSTRAINT CK_StatusHistory_NewStatus CHECK (NewStatus IN ('ABERTA', 'EM_ANALISE', 'EM_ATENDIMENTO', 'RESOLVIDA', 'CANCELADA')),
    CONSTRAINT FK_StatusHistory_Occurrence FOREIGN KEY (OccurrenceId) REFERENCES dbo.Occurrences (Id),
    CONSTRAINT FK_StatusHistory_User FOREIGN KEY (ChangedBy) REFERENCES dbo.Users (Id)
);
GO

CREATE INDEX IX_StatusHistory_Occurrence_Date ON dbo.OccurrenceStatusHistory (OccurrenceId, ChangedAt DESC);
GO

CREATE TABLE dbo.OccurrenceComments
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_OccurrenceComments PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    OccurrenceId UNIQUEIDENTIFIER NOT NULL,
    AuthorId UNIQUEIDENTIFIER NOT NULL,
    Text NVARCHAR(2000) NOT NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Comments_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Comments_Occurrence FOREIGN KEY (OccurrenceId) REFERENCES dbo.Occurrences (Id),
    CONSTRAINT FK_Comments_Author FOREIGN KEY (AuthorId) REFERENCES dbo.Users (Id)
);
GO

CREATE INDEX IX_Comments_Occurrence_Date ON dbo.OccurrenceComments (OccurrenceId, CreatedAt ASC);
GO

CREATE TABLE dbo.OccurrenceRatings
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_OccurrenceRatings PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    OccurrenceId UNIQUEIDENTIFIER NOT NULL,
    RequesterId UNIQUEIDENTIFIER NOT NULL,
    Rating TINYINT NOT NULL,
    CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Ratings_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Ratings_Rating CHECK (Rating BETWEEN 1 AND 5),
    CONSTRAINT UQ_Ratings_Occurrence UNIQUE (OccurrenceId),
    CONSTRAINT FK_Ratings_Occurrence FOREIGN KEY (OccurrenceId) REFERENCES dbo.Occurrences (Id),
    CONSTRAINT FK_Ratings_Requester FOREIGN KEY (RequesterId) REFERENCES dbo.Users (Id)
);
GO

CREATE VIEW dbo.vw_OccurrenceSummary
AS
SELECT
    o.Id,
    o.Title,
    o.Category,
    o.Location,
    o.Priority,
    o.Status,
    o.RequesterId,
    requester.Name AS RequesterName,
    o.AssigneeId,
    assignee.Name AS AssigneeName,
    o.CreatedAt,
    o.UpdatedAt,
    rating.Rating
FROM dbo.Occurrences o
INNER JOIN dbo.Users requester ON requester.Id = o.RequesterId
LEFT JOIN dbo.Users assignee ON assignee.Id = o.AssigneeId
LEFT JOIN dbo.OccurrenceRatings rating ON rating.OccurrenceId = o.Id;
GO

PRINT 'ResolveAi database schema created successfully.';
GO
