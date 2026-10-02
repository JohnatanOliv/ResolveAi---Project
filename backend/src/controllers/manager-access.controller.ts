import { NextFunction, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { managerAccessService } from "../services/manager-access.service";

export async function getOwnRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        res.json({ data: await managerAccessService.getOwnRequest(req.user!.id) });
    } catch (error) {
        next(error);
    }
}

export async function request(req: AuthRequest, res: Response, next: NextFunction) {
    const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    if (reason.length < 20) return res.status(400).json({ message: "Explique o motivo do pedido em pelo menos 20 caracteres" });
    if (reason.length > 1000) return res.status(400).json({ message: "O motivo deve ter no máximo 1000 caracteres" });
    try {
        res.status(201).json({ data: await managerAccessService.request(req.user!.id, reason) });
    } catch (error) {
        if (error instanceof Error && (error.message === "Você já tem um pedido de acesso pendente" || error.message === "Somente solicitantes podem pedir acesso de gestor")) {
            return res.status(409).json({ message: error.message });
        }
        next(error);
    }
}

export async function list(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
        res.json({ data: await managerAccessService.list() });
    } catch (error) {
        next(error);
    }
}

export async function decide(req: AuthRequest, res: Response, next: NextFunction) {
    const { decision, decisionNote } = req.body;
    if (decision !== "APROVADO" && decision !== "RECUSADO") {
        return res.status(400).json({ message: "Decisão inválida" });
    }
    if (decisionNote !== undefined && (typeof decisionNote !== "string" || decisionNote.length > 1000)) {
        return res.status(400).json({ message: "A observação deve ter no máximo 1000 caracteres" });
    }
    try {
        const result = await managerAccessService.decide(String(req.params.id), req.user!.id, decision, decisionNote);
        if (!result) return res.status(404).json({ message: "Pedido não encontrado" });
        res.json({ data: result });
    } catch (error) {
        if (error instanceof Error && (error.message === "Este pedido já foi decidido" || error.message === "A conta não está mais elegível para acesso de gestor")) {
            return res.status(409).json({ message: error.message });
        }
        next(error);
    }
}
