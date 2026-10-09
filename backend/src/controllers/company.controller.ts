import { NextFunction, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { companyService } from "../services/company.service";

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        res.json({ data: await companyService.listCompanies(req.user!) });
    } catch (error) {
        next(error);
    }
}

export async function listManaged(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        res.json({ data: await companyService.listManagedCompanies(req.user!) });
    } catch (error) {
        next(error);
    }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
    const name = typeof req.body.name === "string" ? req.body.name : "";
    try {
        const company = await companyService.createCompany(req.user!, name);
        res.status(201).json({ data: company });
    } catch (error) {
        if (error instanceof Error && (error.message === "Informe o nome da empresa" || error.message === "O nome da empresa deve ter no máximo 120 caracteres")) {
            return res.status(400).json({ message: error.message });
        }
        next(error);
    }
}

export async function listLocations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        res.json({ data: await companyService.listLocations(req.user!, String(req.params.companyId)) });
    } catch (error) {
        next(error);
    }
}

export async function addLocation(req: AuthRequest, res: Response, next: NextFunction) {
    const name = typeof req.body.name === "string" ? req.body.name : "";
    const address = typeof req.body.address === "string" ? req.body.address : "";
    try {
        res.status(201).json({ data: await companyService.addLocation(req.user!, String(req.params.companyId), name, address) });
    } catch (error) {
        if (error instanceof Error && [
            "Acesso restrito a gestores",
            "Você não administra esta empresa",
            "Informe um nome curto e o endereço do local",
            "O nome ou endereço excede o limite permitido",
        ].includes(error.message)) {
            return res.status(error.message === "Acesso restrito a gestores" ? 403 : 400).json({ message: error.message });
        }
        next(error);
    }
}
