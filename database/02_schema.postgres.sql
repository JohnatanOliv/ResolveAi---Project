CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users
(
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('SOLICITANTE', 'GESTOR')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS occurrences
(
    id UUID PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(80) NOT NULL,
    location VARCHAR(240) NOT NULL,
    image_url VARCHAR(2048),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIA' CHECK (priority IN ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE')),
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'EM_ANALISE', 'EM_ATENDIMENTO', 'RESOLVIDA', 'CANCELADA')),
    requester_id UUID NOT NULL REFERENCES users (id),
    assignee_id UUID REFERENCES users (id),
    solution TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_occurrences_requester_id ON occurrences (requester_id);
CREATE INDEX IF NOT EXISTS ix_occurrences_status_priority ON occurrences (status, priority);
CREATE INDEX IF NOT EXISTS ix_occurrences_category ON occurrences (category);
CREATE INDEX IF NOT EXISTS ix_occurrences_created_at ON occurrences (created_at DESC);

CREATE TABLE IF NOT EXISTS occurrence_status_history
(
    id UUID PRIMARY KEY,
    occurrence_id UUID NOT NULL REFERENCES occurrences (id) ON DELETE CASCADE,
    previous_status VARCHAR(20) CHECK (previous_status IS NULL OR previous_status IN ('ABERTA', 'EM_ANALISE', 'EM_ATENDIMENTO', 'RESOLVIDA', 'CANCELADA')),
    new_status VARCHAR(20) NOT NULL CHECK (new_status IN ('ABERTA', 'EM_ANALISE', 'EM_ATENDIMENTO', 'RESOLVIDA', 'CANCELADA')),
    note VARCHAR(500),
    changed_by UUID NOT NULL REFERENCES users (id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_status_history_occurrence_date ON occurrence_status_history (occurrence_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS occurrence_comments
(
    id UUID PRIMARY KEY,
    occurrence_id UUID NOT NULL REFERENCES occurrences (id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users (id),
    text VARCHAR(2000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_comments_occurrence_date ON occurrence_comments (occurrence_id, created_at ASC);

CREATE TABLE IF NOT EXISTS occurrence_ratings
(
    id UUID PRIMARY KEY,
    occurrence_id UUID NOT NULL UNIQUE REFERENCES occurrences (id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users (id),
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE VIEW occurrence_summary AS
SELECT
    o.id,
    o.title,
    o.category,
    o.location,
    o.priority,
    o.status,
    o.requester_id,
    requester.name AS requester_name,
    o.assignee_id,
    assignee.name AS assignee_name,
    o.created_at,
    o.updated_at,
    rating.rating
FROM occurrences o
INNER JOIN users requester ON requester.id = o.requester_id
LEFT JOIN users assignee ON assignee.id = o.assignee_id
LEFT JOIN occurrence_ratings rating ON rating.occurrence_id = o.id;
