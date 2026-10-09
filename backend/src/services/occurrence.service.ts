import { randomUUID } from "node:crypto";
import { AuthUser, Comment, Occurrence, Priority, Status, StatusHistory } from "../types/domain";
import { postgresRepository } from "../repositories/postgres.repository";

export const validStatuses: Status[] = ["ABERTA", "EM_ANALISE", "EM_ATENDIMENTO", "RESOLVIDA", "CANCELADA"];
export const validPriorities: Priority[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
const transitions: Record<Status, Status[]> = {
    ABERTA: ["EM_ANALISE", "CANCELADA"], EM_ANALISE: ["EM_ATENDIMENTO", "CANCELADA"],
    EM_ATENDIMENTO: ["RESOLVIDA", "CANCELADA"], RESOLVIDA: [], CANCELADA: [],
};

export class OccurrenceService {
    list(user: AuthUser, filters: { category?: unknown; status?: unknown; priority?: unknown }) {
        return postgresRepository.listOccurrences(user, filters);
    }

    find(id: string) { return postgresRepository.findOccurrenceById(id); }

    managerOwnsOccurrence(managerId: string, occurrenceId: string) {
        return postgresRepository.managerOwnsOccurrence(managerId, occurrenceId);
    }

    async create(userId: string, input: { title: string; description: string; category: string; location: string; companyId?: string; locationId?: string; imageUrl?: string; priority: Priority }) {
        const now = new Date().toISOString();
        let location = input.location;
        if (input.companyId || input.locationId) {
            if (!input.companyId || !input.locationId) throw new Error("Selecione a empresa e o endereço");
            const selectedLocation = await postgresRepository.findLocationForCompany(input.companyId, input.locationId);
            if (!selectedLocation) throw new Error("O endereço selecionado não pertence a esta empresa");
            location = `${selectedLocation.name} — ${selectedLocation.address}`;
        }
        const initialHistory: StatusHistory = {
            id: randomUUID(),
            previousStatus: null,
            newStatus: "ABERTA",
            note: "Ocorrência registrada",
            changedBy: userId,
            changedAt: now,
        };
        const occurrence: Occurrence = { id: randomUUID(), ...input, location, status: "ABERTA", requesterId: userId, createdAt: now, updatedAt: now, comments: [], history: [initialHistory] };
        return postgresRepository.saveOccurrence(occurrence);
    }

    async update(id: string, managerId: string, input: { status?: Status; priority?: Priority; operatorId?: string | null; solution?: string; note?: string }) {
        const occurrence = await this.find(id);
        if (!occurrence) return undefined;
        if (input.operatorId && (!occurrence.companyId || !(await postgresRepository.findOperatorForCompany(occurrence.companyId, input.operatorId)))) {
            throw new Error("O operador selecionado não pertence à empresa desta ocorrência");
        }
        let history: StatusHistory | undefined;
        if (input.status && input.status !== occurrence.status) {
            if (!validStatuses.includes(input.status) || !transitions[occurrence.status].includes(input.status)) throw new Error(`Transição inválida: ${occurrence.status} -> ${input.status}`);
            if (!input.note?.trim()) throw new Error("Informe uma observação para registrar a mudança de status");
            history = { id: randomUUID(), previousStatus: occurrence.status, newStatus: input.status, note: input.note.trim(), changedBy: managerId, changedAt: new Date().toISOString() };
            occurrence.history.push(history);
            occurrence.status = input.status;
        }
        if (input.priority) occurrence.priority = input.priority;
        if (input.operatorId !== undefined) occurrence.operatorId = input.operatorId || undefined;
        if (input.solution !== undefined) occurrence.solution = input.solution;
        occurrence.updatedAt = new Date().toISOString();
        return postgresRepository.updateOccurrence(occurrence, history);
    }

    async addComment(id: string, userId: string, text: string): Promise<Comment | undefined> {
        const occurrence = await this.find(id);
        if (!occurrence) return undefined;
        return postgresRepository.addComment(id, userId, text);
    }

    rate(id: string, requesterId: string, rating: number) {
        return postgresRepository.rate(id, requesterId, rating);
    }

    dashboard(user: AuthUser) {
        return postgresRepository.dashboard(user);
    }
}

export const occurrenceService = new OccurrenceService();
