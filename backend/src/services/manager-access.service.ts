import { postgresRepository } from "../repositories/postgres.repository";

export class ManagerAccessService {
    async getOwnRequest(userId: string) {
        return postgresRepository.getManagerAccessRequest(userId);
    }

    async request(userId: string, reason: string) {
        const user = await postgresRepository.findUserById(userId);
        if (!user) throw new Error("Usuário não encontrado");
        if (user.role !== "SOLICITANTE") throw new Error("Somente solicitantes podem pedir acesso de gestor");
        try {
            return await postgresRepository.createManagerAccessRequest(userId, reason.trim());
        } catch (error) {
            if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
                throw new Error("Você já tem um pedido de acesso pendente");
            }
            throw error;
        }
    }

    list() {
        return postgresRepository.listManagerAccessRequests();
    }

    decide(requestId: string, adminId: string, decision: "APROVADO" | "RECUSADO", decisionNote?: string) {
        return postgresRepository.decideManagerAccessRequest(requestId, adminId, decision, decisionNote?.trim());
    }
}

export const managerAccessService = new ManagerAccessService();
