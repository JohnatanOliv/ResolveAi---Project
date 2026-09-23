import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { postgresRepository } from "../repositories/postgres.repository";
import { AuthUser } from "../types/domain";

export interface AuthRequest extends Request {
    user?: AuthUser;
}

function jwtSecret() {
    return process.env.JWT_SECRET || "resolve-ai-development-secret";
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Token de autenticação obrigatório" });
    }

    try {
        const payload = jwt.verify(authorization.slice(7), jwtSecret()) as jwt.JwtPayload;
        const user = await postgresRepository.findUserById(String(payload.sub));
        if (!user) return res.status(401).json({ message: "Usuário não encontrado" });
        req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
        next();
    } catch {
        return res.status(401).json({ message: "Token inválido ou expirado" });
    }
}

export function requireManager(req: AuthRequest, res: Response, next: NextFunction) {
    if (req.user?.role !== "GESTOR") return res.status(403).json({ message: "Acesso restrito a gestores" });
    next();
}
