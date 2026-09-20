import bcrypt from "bcrypt";
import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

dotenv.config();

type Role = "SOLICITANTE" | "GESTOR";
type Status = "ABERTA" | "EM_ANALISE" | "EM_ATENDIMENTO" | "RESOLVIDA" | "CANCELADA";
type Priority = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

interface User {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
    createdAt: string;
}

interface StatusHistory {
    id: string;
    previousStatus: Status | null;
    newStatus: Status;
    note?: string;
    changedBy: string;
    changedAt: string;
}

interface Comment {
    id: string;
    text: string;
    authorId: string;
    createdAt: string;
}

interface Occurrence {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    imageUrl?: string;
    priority: Priority;
    status: Status;
    requesterId: string;
    assigneeId?: string;
    solution?: string;
    rating?: number;
    createdAt: string;
    updatedAt: string;
    comments: Comment[];
    history: StatusHistory[];
}

interface AuthRequest extends Request {
    user?: Pick<User, "id" | "role" | "name" | "email">;
}

const users: User[] = [];
const occurrences: Occurrence[] = [];
const JWT_SECRET = process.env.JWT_SECRET || "resolve-ai-development-secret";
const validStatuses: Status[] = ["ABERTA", "EM_ANALISE", "EM_ATENDIMENTO", "RESOLVIDA", "CANCELADA"];
const transitions: Record<Status, Status[]> = {
    ABERTA: ["EM_ANALISE", "CANCELADA"],
    EM_ANALISE: ["EM_ATENDIMENTO", "CANCELADA"],
    EM_ATENDIMENTO: ["RESOLVIDA", "CANCELADA"],
    RESOLVIDA: [],
    CANCELADA: [],
};

function publicUser(user: User) {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
}

function signToken(user: User) {
    return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Token de autenticação obrigatório" });
    }

    try {
        const payload = jwt.verify(authorization.slice(7), JWT_SECRET) as jwt.JwtPayload;
        const user = users.find((candidate) => candidate.id === payload.sub);
        if (!user) return res.status(401).json({ message: "Usuário não encontrado" });
        req.user = { id: user.id, role: user.role, name: user.name, email: user.email };
        next();
    } catch {
        return res.status(401).json({ message: "Token inválido ou expirado" });
    }
}

function requireManager(req: AuthRequest, res: Response, next: NextFunction) {
    if (req.user?.role !== "GESTOR") {
        return res.status(403).json({ message: "Acesso restrito a gestores" });
    }
    next();
}

function findOccurrence(id: string) {
    return occurrences.find((occurrence) => occurrence.id === id);
}

function canSeeOccurrence(req: AuthRequest, occurrence: Occurrence) {
    return req.user?.role === "GESTOR" || occurrence.requesterId === req.user?.id;
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/auth/register", async (req, res, next) => {
    try {
        const { name, email, password, role = "SOLICITANTE" } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: "Nome, e-mail e senha são obrigatórios" });
        if (!["SOLICITANTE", "GESTOR"].includes(role)) return res.status(400).json({ message: "Perfil inválido" });
        if (users.some((user) => user.email === String(email).toLowerCase())) return res.status(409).json({ message: "E-mail já cadastrado" });

        const user: User = {
            id: randomUUID(),
            name,
            email: String(email).toLowerCase(),
            passwordHash: await bcrypt.hash(password, 10),
            role,
            createdAt: new Date().toISOString(),
        };
        users.push(user);
        return res.status(201).json({ user: publicUser(user), token: signToken(user) });
    } catch (error) {
        next(error);
    }
});

app.post("/api/auth/login", async (req, res, next) => {
    try {
        const user = users.find((candidate) => candidate.email === String(req.body.email).toLowerCase());
        if (!user || !(await bcrypt.compare(req.body.password || "", user.passwordHash))) {
            return res.status(401).json({ message: "E-mail ou senha inválidos" });
        }
        return res.json({ user: publicUser(user), token: signToken(user) });
    } catch (error) {
        next(error);
    }
});

app.get("/api/me", requireAuth, (req: AuthRequest, res) => res.json({ user: req.user }));

app.get("/api/occurrences", requireAuth, (req: AuthRequest, res) => {
    const { category, status, priority } = req.query;
    const result = occurrences.filter((occurrence) =>
        canSeeOccurrence(req, occurrence) &&
        (!category || occurrence.category === category) &&
        (!status || occurrence.status === status) &&
        (!priority || occurrence.priority === priority),
    );
    res.json({ data: result, total: result.length });
});

app.post("/api/occurrences", requireAuth, (req: AuthRequest, res) => {
    const { title, description, category, location, imageUrl, priority = "MEDIA" } = req.body;
    if (!title || !description || !category || !location) {
        return res.status(400).json({ message: "Título, descrição, categoria e localização são obrigatórios" });
    }
    if (!["BAIXA", "MEDIA", "ALTA", "URGENTE"].includes(priority)) return res.status(400).json({ message: "Prioridade inválida" });

    const now = new Date().toISOString();
    const occurrence: Occurrence = {
        id: randomUUID(), title, description, category, location, imageUrl, priority, status: "ABERTA",
        requesterId: req.user!.id, createdAt: now, updatedAt: now, comments: [], history: [],
    };
    occurrences.push(occurrence);
    res.status(201).json(occurrence);
});

app.get("/api/occurrences/:id", requireAuth, (req: AuthRequest, res) => {
    const occurrence = findOccurrence(String(req.params.id));
    if (!occurrence) return res.status(404).json({ message: "Ocorrência não encontrada" });
    if (!canSeeOccurrence(req, occurrence)) return res.status(403).json({ message: "Sem permissão para visualizar esta ocorrência" });
    res.json(occurrence);
});

app.patch("/api/occurrences/:id", requireAuth, requireManager, (req: AuthRequest, res) => {
    const occurrence = findOccurrence(String(req.params.id));
    if (!occurrence) return res.status(404).json({ message: "Ocorrência não encontrada" });
    const { status, priority, assigneeId, solution, note } = req.body;

    if (status !== undefined) {
        if (!validStatuses.includes(status) || !transitions[occurrence.status].includes(status)) {
            return res.status(400).json({ message: `Transição inválida: ${occurrence.status} -> ${status}` });
        }
        occurrence.history.push({ id: randomUUID(), previousStatus: occurrence.status, newStatus: status, note, changedBy: req.user!.id, changedAt: new Date().toISOString() });
        occurrence.status = status;
    }
    if (priority !== undefined) {
        if (!["BAIXA", "MEDIA", "ALTA", "URGENTE"].includes(priority)) return res.status(400).json({ message: "Prioridade inválida" });
        occurrence.priority = priority;
    }
    if (assigneeId !== undefined) occurrence.assigneeId = assigneeId;
    if (solution !== undefined) occurrence.solution = solution;
    occurrence.updatedAt = new Date().toISOString();
    res.json(occurrence);
});

app.get("/api/dashboard", requireAuth, requireManager, (_req, res) => {
    const byStatus = validStatuses.reduce<Record<Status, number>>((summary, status) => {
        summary[status] = occurrences.filter((occurrence) => occurrence.status === status).length;
        return summary;
    }, {} as Record<Status, number>);
    const byPriority = ["BAIXA", "MEDIA", "ALTA", "URGENTE"].reduce<Record<string, number>>((summary, priority) => {
        summary[priority] = occurrences.filter((occurrence) => occurrence.priority === priority).length;
        return summary;
    }, {});

    res.json({
        total: occurrences.length,
        byStatus,
        byPriority,
        averageRating: occurrences.filter((occurrence) => occurrence.rating !== undefined).reduce((sum, occurrence, _index, rated) => sum + (occurrence.rating || 0) / rated.length, 0),
    });
});

app.post("/api/occurrences/:id/comments", requireAuth, (req: AuthRequest, res) => {
    const occurrence = findOccurrence(String(req.params.id));
    if (!occurrence) return res.status(404).json({ message: "Ocorrência não encontrada" });
    if (!canSeeOccurrence(req, occurrence)) return res.status(403).json({ message: "Sem permissão para comentar nesta ocorrência" });
    if (!req.body.text) return res.status(400).json({ message: "Texto do comentário é obrigatório" });
    const comment: Comment = { id: randomUUID(), text: req.body.text, authorId: req.user!.id, createdAt: new Date().toISOString() };
    occurrence.comments.push(comment);
    occurrence.updatedAt = comment.createdAt;
    res.status(201).json(comment);
});

app.post("/api/occurrences/:id/rating", requireAuth, (req: AuthRequest, res) => {
    const occurrence = findOccurrence(String(req.params.id));
    if (!occurrence) return res.status(404).json({ message: "Ocorrência não encontrada" });
    if (occurrence.requesterId !== req.user!.id || occurrence.status !== "RESOLVIDA") return res.status(403).json({ message: "Apenas o solicitante pode avaliar uma ocorrência resolvida" });
    if (!Number.isInteger(req.body.rating) || req.body.rating < 1 || req.body.rating > 5) return res.status(400).json({ message: "A avaliação deve ser um número de 1 a 5" });
    occurrence.rating = req.body.rating;
    res.json({ rating: occurrence.rating });
});

app.use((_req, res) => res.status(404).json({ message: "Rota não encontrada" }));
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ message: "Erro interno do servidor" });
});

const PORT = Number(process.env.PORT) || 3333;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));