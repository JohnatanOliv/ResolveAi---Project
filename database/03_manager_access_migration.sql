DO $$
DECLARE
    role_check RECORD;
BEGIN
    FOR role_check IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%role%'
    LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', role_check.conname);
    END LOOP;
END;
$$;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('SOLICITANTE', 'GESTOR', 'ADMIN'));

CREATE TABLE IF NOT EXISTS manager_access_requests
(
    id UUID PRIMARY KEY,
    requester_id UUID NOT NULL REFERENCES users (id),
    reason VARCHAR(1000) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADO', 'RECUSADO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES users (id),
    decision_note VARCHAR(1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_manager_access_requests_pending_requester
    ON manager_access_requests (requester_id)
    WHERE status = 'PENDENTE';
