ALTER TABLE occurrences
    ALTER COLUMN image_url TYPE TEXT;

INSERT INTO occurrence_status_history
    (id, occurrence_id, previous_status, new_status, note, changed_by, changed_at)
SELECT
    gen_random_uuid(),
    o.id,
    NULL,
    o.status,
    'Estado atual registrado durante a atualização do sistema',
    o.requester_id,
    o.updated_at
FROM occurrences o
WHERE NOT EXISTS
(
    SELECT 1
    FROM occurrence_status_history h
    WHERE h.occurrence_id = o.id
);
