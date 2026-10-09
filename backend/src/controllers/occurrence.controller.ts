import { NextFunction, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { occurrenceService, validPriorities } from "../services/occurrence.service";
import { Priority, Status } from "../types/domain";

async function getOccurrence(req: AuthRequest, res: Response) {
    const occurrence = await occurrenceService.find(String(req.params.id));
    if (!occurrence) { res.status(404).json({ message: "Ocorrência não encontrada" }); return undefined; }
    return occurrence;
}

async function canAccess(req: AuthRequest, occurrence: { id: string; requesterId: string }) {
    if (req.user?.role === "ADMIN" || req.user?.id === occurrence.requesterId) return true;
    return req.user?.role === "GESTOR" ? occurrenceService.managerOwnsOccurrence(req.user.id, occurrence.id) : false;
}

export async function list(req: AuthRequest, res: Response) { const data = await occurrenceService.list(req.user!, req.query); res.json({ data, total: data.length }); }

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
    const { title, description, category, location, companyId, locationId, imageUrl, priority = "MEDIA" } = req.body;
    if (!title || !description || !category || !companyId || !locationId) return res.status(400).json({ message: "Título, descrição, categoria, empresa e endereço são obrigatórios" });
    if (!validPriorities.includes(priority)) return res.status(400).json({ message: "Prioridade inválida" });
    if (imageUrl !== undefined && imageUrl !== null) {
        const dataUrlMatch = typeof imageUrl === "string"
            ? imageUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/)
            : null;
        const isSecureUrl = typeof imageUrl === "string" && (() => {
            try { return new URL(imageUrl).protocol === "https:"; } catch { return false; }
        })();
        if (!dataUrlMatch && !isSecureUrl) return res.status(400).json({ message: "A imagem deve ser PNG, JPEG, WebP ou uma URL HTTPS" });
        if (dataUrlMatch && Buffer.from(dataUrlMatch[2], "base64").byteLength > 1_000_000) {
            return res.status(413).json({ message: "A imagem deve ter no máximo 1 MB" });
        }
    }
    try {
        res.status(201).json(await occurrenceService.create(req.user!.id, { title, description, category, location: location || "", companyId, locationId, imageUrl, priority }));
    } catch (error) {
        if (error instanceof Error && ["Selecione a empresa e o endereço", "O endereço selecionado não pertence a esta empresa"].includes(error.message)) {
            return res.status(400).json({ message: error.message });
        }
        return next(error);
    }
}

export async function getById(req: AuthRequest, res: Response) {
    const occurrence = await getOccurrence(req, res);
    if (!occurrence) return;
    if (!(await canAccess(req, occurrence))) return res.status(403).json({ message: "Sem permissão para visualizar esta ocorrência" });
    res.json(occurrence);
}

export async function update(req: AuthRequest, res: Response) {
    const occurrence = await getOccurrence(req, res);
    if (!occurrence) return;
    if (req.user?.role !== "ADMIN" && !(req.user?.role === "GESTOR" && await occurrenceService.managerOwnsOccurrence(req.user.id, occurrence.id))) {
        return res.status(403).json({ message: "Sem permissão para atualizar esta ocorrência" });
    }
    try {
        if (req.body.priority !== undefined && !validPriorities.includes(req.body.priority)) return res.status(400).json({ message: "Prioridade inválida" });
        res.json(await occurrenceService.update(occurrence.id, req.user!.id, req.body));
    } catch (error) { res.status(400).json({ message: error instanceof Error ? error.message : "Não foi possível atualizar" }); }
}

export async function addComment(req: AuthRequest, res: Response) {
    const occurrence = await getOccurrence(req, res);
    if (!occurrence) return;
    if (!(await canAccess(req, occurrence))) return res.status(403).json({ message: "Sem permissão para comentar nesta ocorrência" });
    if (!req.body.text) return res.status(400).json({ message: "Texto do comentário é obrigatório" });
    res.status(201).json(await occurrenceService.addComment(occurrence.id, req.user!.id, req.body.text));
}

export async function rate(req: AuthRequest, res: Response) {
    const occurrence = await getOccurrence(req, res);
    if (!occurrence) return;
    if (occurrence.requesterId !== req.user!.id || occurrence.status !== "RESOLVIDA") return res.status(403).json({ message: "Apenas o solicitante pode avaliar uma ocorrência resolvida" });
    if (!Number.isInteger(req.body.rating) || req.body.rating < 1 || req.body.rating > 5) return res.status(400).json({ message: "A avaliação deve ser um número de 1 a 5" });
    res.json(await occurrenceService.rate(occurrence.id, req.user!.id, req.body.rating));
}

export async function dashboard(req: AuthRequest, res: Response) { res.json(await occurrenceService.dashboard(req.user!)); }
