CREATE TABLE IF NOT EXISTS company_operators
(
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies (id),
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(40),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, company_id)
);

CREATE INDEX IF NOT EXISTS ix_company_operators_company
    ON company_operators (company_id, name)
    WHERE active = TRUE;

ALTER TABLE occurrences
    ADD COLUMN IF NOT EXISTS operator_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_occurrence_operator_company'
          AND conrelid = 'occurrences'::regclass
    ) THEN
        ALTER TABLE occurrences
            ADD CONSTRAINT ck_occurrence_operator_company
            CHECK (operator_id IS NULL OR company_id IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_occurrence_operator_company'
          AND conrelid = 'occurrences'::regclass
    ) THEN
        ALTER TABLE occurrences
            ADD CONSTRAINT fk_occurrence_operator_company
            FOREIGN KEY (operator_id, company_id)
            REFERENCES company_operators (id, company_id);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS ix_occurrences_operator ON occurrences (operator_id) WHERE operator_id IS NOT NULL;

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
    location.address AS location_address,
    operator.name AS operator_name,
    operator.phone AS operator_phone
FROM occurrences o
INNER JOIN users requester ON requester.id = o.requester_id
LEFT JOIN users assignee ON assignee.id = o.assignee_id
LEFT JOIN occurrence_ratings rating ON rating.occurrence_id = o.id
LEFT JOIN companies company ON company.id = o.company_id
LEFT JOIN company_locations location ON location.id = o.location_id
LEFT JOIN company_operators operator ON operator.id = o.operator_id;
