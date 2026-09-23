import { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { AuthUser, Comment, Occurrence, Priority, Role, Status, StatusHistory, User } from "../types/domain";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

function iso(value: Date | string) { return new Date(value).toISOString(); }

function mapUser(row: Record<string, any>): User {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role as Role,
        createdAt: iso(row.created_at),
    };
}

function mapComment(row: Record<string, any>): Comment {
    return { id: row.id, text: row.text, authorId: row.author_id, createdAt: iso(row.created_at) };
}

function mapHistory(row: Record<string, any>): StatusHistory {
    return {
        id: row.id,
        previousStatus: row.previous_status as Status | null,
        newStatus: row.new_status as Status,
        note: row.note || undefined,
        changedBy: row.changed_by,
        changedAt: iso(row.changed_at),
    };
}

function mapOccurrence(row: Record<string, any>, comments: Comment[] = [], history: StatusHistory[] = []): Occurrence {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        location: row.location,
        imageUrl: row.image_url || undefined,
        priority: row.priority as Priority,
        status: row.status as Status,
        requesterId: row.requester_id,
        assigneeId: row.assignee_id || undefined,
        solution: row.solution || undefined,
        rating: row.rating === null || row.rating === undefined ? undefined : Number(row.rating),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        comments,
        history,
    };
}

export class PostgresRepository {
    async findUserById(id: string) {
        const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        return result.rows[0] ? mapUser(result.rows[0]) : undefined;
    }

    async findUserByEmail(email: string) {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        return result.rows[0] ? mapUser(result.rows[0]) : undefined;
    }

    async saveUser(user: User) {
        const result = await pool.query(
            `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
            [user.id, user.name, user.email, user.passwordHash, user.role, user.createdAt],
        );
        return mapUser(result.rows[0]);
    }

    private async hydrate(id: string, client: Pool | PoolClient = pool) {
        const occurrenceResult = await client.query(
            `SELECT o.*, r.rating
             FROM occurrences o
             LEFT JOIN occurrence_ratings r ON r.occurrence_id = o.id
             WHERE o.id = $1`,
            [id],
        );
        const row = occurrenceResult.rows[0];
        if (!row) return undefined;
        const [commentsResult, historyResult] = await Promise.all([
            client.query("SELECT * FROM occurrence_comments WHERE occurrence_id = $1 ORDER BY created_at ASC", [id]),
            client.query("SELECT * FROM occurrence_status_history WHERE occurrence_id = $1 ORDER BY changed_at ASC", [id]),
        ]);
        return mapOccurrence(row, commentsResult.rows.map(mapComment), historyResult.rows.map(mapHistory));
    }

    async findOccurrenceById(id: string) { return this.hydrate(id); }

    async listOccurrences(user: AuthUser, filters: { category?: unknown; status?: unknown; priority?: unknown }) {
        const values: unknown[] = [];
        const conditions = [];
        if (user.role !== "GESTOR") {
            values.push(user.id);
            conditions.push(`o.requester_id = $${values.length}`);
        }
        if (filters.category) { values.push(filters.category); conditions.push(`o.category = $${values.length}`); }
        if (filters.status) { values.push(filters.status); conditions.push(`o.status = $${values.length}`); }
        if (filters.priority) { values.push(filters.priority); conditions.push(`o.priority = $${values.length}`); }
        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query(
            `SELECT o.*, r.rating FROM occurrences o
             LEFT JOIN occurrence_ratings r ON r.occurrence_id = o.id
             ${where} ORDER BY o.created_at DESC`,
            values,
        );
        return Promise.all(result.rows.map(async (row) => {
            const [commentsResult, historyResult] = await Promise.all([
                pool.query("SELECT * FROM occurrence_comments WHERE occurrence_id = $1 ORDER BY created_at ASC", [row.id]),
                pool.query("SELECT * FROM occurrence_status_history WHERE occurrence_id = $1 ORDER BY changed_at ASC", [row.id]),
            ]);
            return mapOccurrence(row, commentsResult.rows.map(mapComment), historyResult.rows.map(mapHistory));
        }));
    }

    async saveOccurrence(occurrence: Occurrence) {
        await pool.query(
            `INSERT INTO occurrences
             (id, title, description, category, location, image_url, priority, status, requester_id, assignee_id, solution, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [occurrence.id, occurrence.title, occurrence.description, occurrence.category, occurrence.location,
                occurrence.imageUrl || null, occurrence.priority, occurrence.status, occurrence.requesterId,
                occurrence.assigneeId || null, occurrence.solution || null, occurrence.createdAt, occurrence.updatedAt],
        );
        return occurrence;
    }

    async updateOccurrence(occurrence: Occurrence, history?: StatusHistory) {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(
                `UPDATE occurrences SET status = $2, priority = $3, assignee_id = $4, solution = $5, updated_at = $6 WHERE id = $1`,
                [occurrence.id, occurrence.status, occurrence.priority, occurrence.assigneeId || null, occurrence.solution || null, occurrence.updatedAt],
            );
            if (history) {
                await client.query(
                    `INSERT INTO occurrence_status_history
                     (id, occurrence_id, previous_status, new_status, note, changed_by, changed_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [history.id, occurrence.id, history.previousStatus, history.newStatus, history.note || null, history.changedBy, history.changedAt],
                );
            }
            await client.query("COMMIT");
            return occurrence;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    async addComment(occurrenceId: string, userId: string, text: string) {
        const comment = { id: randomUUID(), text, authorId: userId, createdAt: new Date().toISOString() };
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(
                "INSERT INTO occurrence_comments (id, occurrence_id, author_id, text, created_at) VALUES ($1, $2, $3, $4, $5)",
                [comment.id, occurrenceId, userId, text, comment.createdAt],
            );
            await client.query("UPDATE occurrences SET updated_at = $2 WHERE id = $1", [occurrenceId, comment.createdAt]);
            await client.query("COMMIT");
            return comment;
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    async rate(occurrenceId: string, requesterId: string, rating: number) {
        await pool.query(
            `INSERT INTO occurrence_ratings (id, occurrence_id, requester_id, rating)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (occurrence_id) DO UPDATE SET rating = EXCLUDED.rating, requester_id = EXCLUDED.requester_id`,
            [randomUUID(), occurrenceId, requesterId, rating],
        );
        return { rating };
    }

    async dashboard() {
        const [total, statuses, priorities, rating] = await Promise.all([
            pool.query("SELECT COUNT(*)::int AS count FROM occurrences"),
            pool.query("SELECT status, COUNT(*)::int AS count FROM occurrences GROUP BY status"),
            pool.query("SELECT priority, COUNT(*)::int AS count FROM occurrences GROUP BY priority"),
            pool.query("SELECT COALESCE(AVG(rating), 0)::float AS average FROM occurrence_ratings"),
        ]);
        const byStatus = Object.fromEntries(statuses.rows.map((row) => [row.status, row.count]));
        const byPriority = Object.fromEntries(priorities.rows.map((row) => [row.priority, row.count]));
        return { total: total.rows[0].count, byStatus, byPriority, averageRating: rating.rows[0].average };
    }
}

export const postgresRepository = new PostgresRepository();
