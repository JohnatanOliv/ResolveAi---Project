CREATE TABLE IF NOT EXISTS companies
(
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    manager_id UUID NOT NULL REFERENCES users (id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, manager_id)
);

CREATE INDEX IF NOT EXISTS ix_companies_active_name ON companies (name) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS ix_companies_manager ON companies (manager_id);

CREATE TABLE IF NOT EXISTS company_locations
(
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id),
    name VARCHAR(80) NOT NULL,
    address VARCHAR(200) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, company_id)
);

CREATE INDEX IF NOT EXISTS ix_company_locations_company ON company_locations (company_id, name) WHERE active = TRUE;

ALTER TABLE occurrences
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies (id),
    ADD COLUMN IF NOT EXISTS location_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_occurrence_company_location_pair'
          AND conrelid = 'occurrences'::regclass
    ) THEN
        ALTER TABLE occurrences
            ADD CONSTRAINT ck_occurrence_company_location_pair
            CHECK ((company_id IS NULL) = (location_id IS NULL));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_occurrence_company_location'
          AND conrelid = 'occurrences'::regclass
    ) THEN
        ALTER TABLE occurrences
            ADD CONSTRAINT fk_occurrence_company_location
            FOREIGN KEY (location_id, company_id)
            REFERENCES company_locations (id, company_id);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS ix_occurrences_company_location ON occurrences (company_id, location_id);

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
    rating.rating,
    company.name AS company_name,
    location.name AS location_name,
    location.address AS location_address
FROM occurrences o
INNER JOIN users requester ON requester.id = o.requester_id
LEFT JOIN users assignee ON assignee.id = o.assignee_id
LEFT JOIN occurrence_ratings rating ON rating.occurrence_id = o.id
LEFT JOIN companies company ON company.id = o.company_id
LEFT JOIN company_locations location ON location.id = o.location_id;
