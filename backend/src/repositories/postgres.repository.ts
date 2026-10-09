import { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { AuthUser, Comment, Company, CompanyLocation, ManagerAccessRequest, Occurrence, Priority, Role, Status, StatusHistory, User } from "../types/domain";

dotenv.config();

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
        changedByName: row.changed_by_name || undefined,
        changedAt: iso(row.changed_at),
    };
}

function mapManagerAccessRequest(row: Record<string, any>): ManagerAccessRequest {
    return {
        id: row.id,
        requesterId: row.requester_id,
        requesterName: row.requester_name,
        requesterEmail: row.requester_email,
        reason: row.reason,
        status: row.status,
        createdAt: iso(row.created_at),
        decidedAt: row.decided_at ? iso(row.decided_at) : undefined,
        decidedBy: row.decided_by || undefined,
        decisionNote: row.decision_note || undefined,
    };
}

function mapOccurrence(row: Record<string, any>, comments: Comment[] = [], history: StatusHistory[] = []): Occurrence {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        location: row.location,
        companyId: row.company_id || undefined,
        companyName: row.company_name || undefined,
        locationId: row.location_id || undefined,
        locationName: row.location_name || undefined,
        locationAddress: row.location_address || undefined,
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
    async listCompanies(_user: AuthUser): Promise<Company[]> {
        const result = await pool.query("SELECT * FROM companies WHERE active = TRUE ORDER BY name ASC");
        return result.rows.map((row) => ({ id: row.id, name: row.name, managerId: row.manager_id, createdAt: iso(row.created_at) }));
    }

    async listManagedCompanies(user: AuthUser): Promise<Company[]> {
        const result = user.role === "ADMIN"
            ? await pool.query("SELECT * FROM companies WHERE active = TRUE ORDER BY name ASC")
            : await pool.query("SELECT * FROM companies WHERE manager_id = $1 AND active = TRUE ORDER BY name ASC", [user.id]);
        return result.rows.map((row) => ({ id: row.id, name: row.name, managerId: row.manager_id, createdAt: iso(row.created_at) }));
    }

    async createCompany(managerId: string, name: string): Promise<Company> {
        const result = await pool.query(
            "INSERT INTO companies (id, name, manager_id) VALUES ($1, $2, $3) RETURNING *",
            [randomUUID(), name, managerId],
        );
        const row = result.rows[0];
        return { id: row.id, name: row.name, managerId: row.manager_id, createdAt: iso(row.created_at) };
    }

    async managerOwnsCompany(managerId: string, companyId: string) {
        const result = await pool.query("SELECT 1 FROM companies WHERE id = $1 AND manager_id = $2 AND active = TRUE", [companyId, managerId]);
        return result.rowCount === 1;
    }

    async managerOwnsOccurrence(managerId: string, occurrenceId: string) {
        const result = await pool.query(
            `SELECT 1 FROM occurrences o
             INNER JOIN companies c ON c.id = o.company_id
             WHERE o.id = $1 AND c.manager_id = $2 AND c.active = TRUE`,
            [occurrenceId, managerId],
        );
        return result.rowCount === 1;
    }

    async listLocations(_user: AuthUser, companyId: string): Promise<CompanyLocation[]> {
        const result = await pool.query(
            `SELECT l.* FROM company_locations l
             INNER JOIN companies c ON c.id = l.company_id
             WHERE l.company_id = $1 AND l.active = TRUE AND c.active = TRUE
             ORDER BY l.name ASC`,
            [companyId],
        );
        return result.rows.map((row) => ({ id: row.id, companyId: row.company_id, name: row.name, address: row.address, createdAt: iso(row.created_at) }));
    }

    async createLocation(companyId: string, name: string, address: string): Promise<CompanyLocation> {
        const result = await pool.query(
            "INSERT INTO company_locations (id, company_id, name, address) VALUES ($1, $2, $3, $4) RETURNING *",
            [randomUUID(), companyId, name, address],
        );
        const row = result.rows[0];
        return { id: row.id, companyId: row.company_id, name: row.name, address: row.address, createdAt: iso(row.created_at) };
    }

    async findLocationForCompany(companyId: string, locationId: string) {
        const result = await pool.query(
            `SELECT l.*, c.name AS company_name FROM company_locations l
             INNER JOIN companies c ON c.id = l.company_id
             WHERE l.id = $1 AND l.company_id = $2 AND l.active = TRUE AND c.active = TRUE`,
            [locationId, companyId],
        );
        const row = result.rows[0];
        return row ? { id: row.id, name: row.name, address: row.address, companyName: row.company_name } : undefined;
    }

    async findUserById(id: string) {
        const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        return result.rows[0] ? mapUser(result.rows[0]) : undefined;
    }

    async findUserByEmail(email: string) {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        return result.rows[0] ? mapUser(result.rows[0]) : undefined;
    }

    async listAssignableManagers(occurrenceId: string) {
        const result = await pool.query(
            `SELECT u.id, u.name, u.email, u.role
             FROM users u
             WHERE u.role = 'ADMIN'
                OR (u.role = 'GESTOR' AND u.id = (
                    SELECT c.manager_id FROM occurrences o
                    INNER JOIN companies c ON c.id = o.company_id
                    WHERE o.id = $1 AND c.active = TRUE
                ))
             ORDER BY u.name ASC`,
            [occurrenceId],
        );
        return result.rows.map((row) => ({ id: row.id, name: row.name, email: row.email, role: row.role as Role }));
    }

    async saveUser(user: User) {
        const result = await pool.query(
            `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
            [user.id, user.name, user.email, user.passwordHash, user.role, user.createdAt],
        );
        return mapUser(result.rows[0]);
    }

    async getManagerAccessRequest(userId: string) {
        const result = await pool.query(
            `SELECT r.*, u.name AS requester_name, u.email AS requester_email
             FROM manager_access_requests r
             INNER JOIN users u ON u.id = r.requester_id
             WHERE r.requester_id = $1
             ORDER BY r.created_at DESC LIMIT 1`,
            [userId],
        );
        return result.rows[0] ? mapManagerAccessRequest(result.rows[0]) : undefined;
    }

    async createManagerAccessRequest(userId: string, reason: string) {
        const result = await pool.query(
            `INSERT INTO manager_access_requests (id, requester_id, reason)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [randomUUID(), userId, reason],
        );
        const request = await this.getManagerAccessRequest(userId);
        return request || mapManagerAccessRequest({ ...result.rows[0], requester_name: "", requester_email: "" });
    }

    async listManagerAccessRequests() {
        const result = await pool.query(
            `SELECT r.*, u.name AS requester_name, u.email AS requester_email
             FROM manager_access_requests r
             INNER JOIN users u ON u.id = r.requester_id
             ORDER BY CASE WHEN r.status = 'PENDENTE' THEN 0 ELSE 1 END, r.created_at DESC`,
        );
        return result.rows.map(mapManagerAccessRequest);
    }

    async decideManagerAccessRequest(requestId: string, adminId: string, decision: "APROVADO" | "RECUSADO", decisionNote?: string) {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const selected = await client.query("SELECT * FROM manager_access_requests WHERE id = $1 FOR UPDATE", [requestId]);
            const request = selected.rows[0];
            if (!request) {
                await client.query("ROLLBACK");
                return undefined;
            }
            if (request.status !== "PENDENTE") throw new Error("Este pedido já foi decidido");
            if (decision === "APROVADO") {
                const promoted = await client.query(
                    "UPDATE users SET role = 'GESTOR', updated_at = NOW() WHERE id = $1 AND role = 'SOLICITANTE'",
                    [request.requester_id],
                );
                if (promoted.rowCount !== 1) throw new Error("A conta não está mais elegível para acesso de gestor");
            }
            await client.query(
                `UPDATE manager_access_requests
                 SET status = $2, decided_at = NOW(), decided_by = $3, decision_note = $4
                 WHERE id = $1`,
                [requestId, decision, adminId, decisionNote || null],
            );
            await client.query("COMMIT");
            const updated = await client.query(
                `SELECT r.*, u.name AS requester_name, u.email AS requester_email
                 FROM manager_access_requests r INNER JOIN users u ON u.id = r.requester_id WHERE r.id = $1`,
                [requestId],
            );
            return mapManagerAccessRequest(updated.rows[0]);
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    private async hydrate(id: string, client: Pool | PoolClient = pool) {
        const occurrenceResult = await client.query(
            `SELECT o.*, r.rating, c.name AS company_name, l.name AS location_name, l.address AS location_address
             FROM occurrences o
             LEFT JOIN occurrence_ratings r ON r.occurrence_id = o.id
             LEFT JOIN companies c ON c.id = o.company_id
             LEFT JOIN company_locations l ON l.id = o.location_id
             WHERE o.id = $1`,
            [id],
        );
        const row = occurrenceResult.rows[0];
        if (!row) return undefined;
        const [commentsResult, historyResult] = await Promise.all([
            client.query("SELECT * FROM occurrence_comments WHERE occurrence_id = $1 ORDER BY created_at ASC", [id]),
            client.query(
                `SELECT h.*, u.name AS changed_by_name
                 FROM occurrence_status_history h
                 INNER JOIN users u ON u.id = h.changed_by
                 WHERE h.occurrence_id = $1 ORDER BY h.changed_at ASC`,
                [id],
            ),
        ]);
        return mapOccurrence(row, commentsResult.rows.map(mapComment), historyResult.rows.map(mapHistory));
    }

    async findOccurrenceById(id: string) { return this.hydrate(id); }

    async listOccurrences(user: AuthUser, filters: { category?: unknown; status?: unknown; priority?: unknown }) {
        const values: unknown[] = [];
        const conditions = [];
        if (user.role === "SOLICITANTE") {
            values.push(user.id);
            conditions.push(`o.requester_id = $${values.length}`);
        } else if (user.role === "GESTOR") {
            values.push(user.id);
            conditions.push(`EXISTS (SELECT 1 FROM companies managed_company WHERE managed_company.id = o.company_id AND managed_company.manager_id = $${values.length} AND managed_company.active = TRUE)`);
        }
        if (filters.category) { values.push(filters.category); conditions.push(`o.category = $${values.length}`); }
        if (filters.status) { values.push(filters.status); conditions.push(`o.status = $${values.length}`); }
        if (filters.priority) { values.push(filters.priority); conditions.push(`o.priority = $${values.length}`); }
        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const result = await pool.query(
            `SELECT o.*, r.rating, c.name AS company_name, l.name AS location_name, l.address AS location_address
             FROM occurrences o
             LEFT JOIN occurrence_ratings r ON r.occurrence_id = o.id
             LEFT JOIN companies c ON c.id = o.company_id
             LEFT JOIN company_locations l ON l.id = o.location_id
             ${where} ORDER BY o.created_at DESC`,
            values,
        );
        return Promise.all(result.rows.map(async (row) => {
            const [commentsResult, historyResult] = await Promise.all([
                pool.query("SELECT * FROM occurrence_comments WHERE occurrence_id = $1 ORDER BY created_at ASC", [row.id]),
                pool.query(
                    `SELECT h.*, u.name AS changed_by_name
                     FROM occurrence_status_history h
                     INNER JOIN users u ON u.id = h.changed_by
                     WHERE h.occurrence_id = $1 ORDER BY h.changed_at ASC`,
                    [row.id],
                ),
            ]);
            return mapOccurrence(row, commentsResult.rows.map(mapComment), historyResult.rows.map(mapHistory));
        }));
    }

    async saveOccurrence(occurrence: Occurrence) {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(
                `INSERT INTO occurrences
                 (id, title, description, category, location, company_id, location_id, image_url, priority, status, requester_id, assignee_id, solution, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [occurrence.id, occurrence.title, occurrence.description, occurrence.category, occurrence.location,
                    occurrence.companyId || null, occurrence.locationId || null, occurrence.imageUrl || null,
                    occurrence.priority, occurrence.status, occurrence.requesterId, occurrence.assigneeId || null,
                    occurrence.solution || null, occurrence.createdAt, occurrence.updatedAt],
            );
            const initialHistory = occurrence.history[0];
            if (initialHistory) {
                await client.query(
                    `INSERT INTO occurrence_status_history
                     (id, occurrence_id, previous_status, new_status, note, changed_by, changed_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [initialHistory.id, occurrence.id, initialHistory.previousStatus, initialHistory.newStatus,
                        initialHistory.note || null, initialHistory.changedBy, initialHistory.changedAt],
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

    async dashboard(user: AuthUser) {
        const filters = user.role === "GESTOR"
            ? "WHERE EXISTS (SELECT 1 FROM companies c WHERE c.id = o.company_id AND c.manager_id = $1 AND c.active = TRUE)"
            : "";
        const values = user.role === "GESTOR" ? [user.id] : [];
        const [total, statuses, priorities, rating] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS count FROM occurrences o ${filters}`, values),
            pool.query(`SELECT o.status, COUNT(*)::int AS count FROM occurrences o ${filters} GROUP BY o.status`, values),
            pool.query(`SELECT o.priority, COUNT(*)::int AS count FROM occurrences o ${filters} GROUP BY o.priority`, values),
            pool.query(
                `SELECT COALESCE(AVG(r.rating), 0)::float AS average
                 FROM occurrence_ratings r INNER JOIN occurrences o ON o.id = r.occurrence_id ${filters}`,
                values,
            ),
        ]);
        const byStatus = Object.fromEntries(statuses.rows.map((row) => [row.status, row.count]));
        const byPriority = Object.fromEntries(priorities.rows.map((row) => [row.priority, row.count]));
        return { total: total.rows[0].count, byStatus, byPriority, averageRating: rating.rows[0].average };
    }
}

export const postgresRepository = new PostgresRepository();
