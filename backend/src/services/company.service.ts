import { postgresRepository } from "../repositories/postgres.repository";
import { AuthUser } from "../types/domain";

function canManage(user: AuthUser) {
    return user.role === "GESTOR" || user.role === "ADMIN";
}

export class CompanyService {
    listCompanies(user: AuthUser) {
        return postgresRepository.listCompanies(user);
    }

    async listManagedCompanies(user: AuthUser) {
        if (!canManage(user)) throw new Error("Acesso restrito a gestores");
        return postgresRepository.listManagedCompanies(user);
    }

    async createCompany(user: AuthUser, rawName: string) {
        if (!canManage(user)) throw new Error("Acesso restrito a gestores");
        const name = rawName.trim();
        if (!name) throw new Error("Informe o nome da empresa");
        if (name.length > 120) throw new Error("O nome da empresa deve ter no máximo 120 caracteres");
        return postgresRepository.createCompany(user.id, name);
    }

    listLocations(user: AuthUser, companyId: string) {
        return postgresRepository.listLocations(user, companyId);
    }

    async findLocationForCompany(companyId: string, locationId: string) {
        return postgresRepository.findLocationForCompany(companyId, locationId);
    }

    async addLocation(user: AuthUser, companyId: string, rawName: string, rawAddress: string) {
        if (!canManage(user)) throw new Error("Acesso restrito a gestores");
        const name = rawName.trim();
        const address = rawAddress.trim();
        if (!name || !address) throw new Error("Informe um nome curto e o endereço do local");
        if (name.length > 80 || address.length > 200) throw new Error("O nome ou endereço excede o limite permitido");
        if (user.role !== "ADMIN" && !(await postgresRepository.managerOwnsCompany(user.id, companyId))) {
            throw new Error("Você não administra esta empresa");
        }
        return postgresRepository.createLocation(companyId, name, address);
    }
}

export const companyService = new CompanyService();
