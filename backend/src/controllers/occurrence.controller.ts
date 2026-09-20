import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { occurrenceService, validPriorities } from "../services/occurrence.service";
import { Priority, Status } from "../types/domain";

function getOccurrence(req: AuthRequest, res: Response) {
    const occurrence = occurrenceService.find(String(req.params.id));
    if (!occurrence) { res.status(404).json({ message: "Ocorrência não encontrada" }); return undefined; }
    return occurrence;
}

function canAccess(req: AuthRequest, requesterId: string) { return req.user?.role === "GESTOR" || req.user?.id === requesterId; }

export function list(req: AuthRequest, res: Response) { const data = occurrenceService.list(req.user!, req.query); res.json({ data, total: data.length }); }

export function create(req: AuthRequest, res: Response) {
    const { title, description, category, location, imageUrl, priority = "MEDIA" } = req.body;
    if (!title || !description || !category || !location) return res.status(400).json({ message: "Título, descrição, categoria e localização são obrigatórios" });
    if (!validPriorities.includes(priority)) return res.status(400).json({ message: "Prioridade inválida" });
    res.status(201).json(occurrenceService.create(req.user!.id, { title, description, category, location, imageUrl, priority }));
}

export function getById(req: AuthRequest, res: Response) {
    const occurrence = getOccurrence(req, res);
    if (!occurrence) return;
    if (!canAccess(req, occurrence.requesterId)) return res.status(403).json({ message: "Sem permissão para visualizar esta ocorrência" });
    res.json(occurrence);
}

export function update(req: AuthRequest, res: Response) {
    const occurrence = getOccurrence(req, res);
    if (!occurrence) return;
    try {
        if (req.body.priority !== undefined && !validPriorities.includes(req.body.priority)) return res.status(400).json({ message: "Prioridade inválida" });
        res.json(occurrenceService.update(occurrence.id, req.user!.id, req.body));
    } catch (error) { res.status(400).json({ message: error instanceof Error ? error.message : "Não foi possível atualizar" }); }
}

export function addComment(req: AuthRequest, res: Response) {
    const occurrence = getOccurrence(req, res);
    if (!occurrence) return;
    if (!canAccess(req, occurrence.requesterId)) return res.status(403).json({ message: "Sem permissão para comentar nesta ocorrência" });
    if (!req.body.text) return res.status(400).json({ message: "Texto do comentário é obrigatório" });
    res.status(201).json(occurrenceService.addComment(occurrence.id, req.user!.id, req.body.text));
}

export function rate(req: AuthRequest, res: Response) {
    const occurrence = getOccurrence(req, res);
    if (!occurrence) return;
    if (occurrence.requesterId !== req.user!.id || occurrence.status !== "RESOLVIDA") return res.status(403).json({ message: "Apenas o solicitante pode avaliar uma ocorrência resolvida" });
    if (!Number.isInteger(req.body.rating) || req.body.rating < 1 || req.body.rating > 5) return res.status(400).json({ message: "A avaliação deve ser um número de 1 a 5" });
    occurrence.rating = req.body.rating;
    res.json({ rating: occurrence.rating });
}

export function dashboard(_req: AuthRequest, res: Response) { res.json(occurrenceService.dashboard()); }
