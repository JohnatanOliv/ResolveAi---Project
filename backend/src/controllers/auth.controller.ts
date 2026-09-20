import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { Role } from "../types/domain";

export async function register(req: Request, res: Response, next: NextFunction) {
    try {
        const { name, email, password, role = "SOLICITANTE" } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: "Nome, e-mail e senha são obrigatórios" });
        if (!["SOLICITANTE", "GESTOR"].includes(role)) return res.status(400).json({ message: "Perfil inválido" });
        return res.status(201).json(await authService.register(name, email, password, role as Role));
    } catch (error) {
        if (error instanceof Error && error.message === "E-mail já cadastrado") return res.status(409).json({ message: error.message });
        next(error);
    }
}

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        return res.json(await authService.login(req.body.email, req.body.password));
    } catch (error) {
        if (error instanceof Error && error.message === "E-mail ou senha inválidos") return res.status(401).json({ message: error.message });
        next(error);
    }
}
