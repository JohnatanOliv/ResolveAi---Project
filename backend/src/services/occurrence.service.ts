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

    async create(userId: string, input: { title: string; description: string; category: string; location: string; imageUrl?: string; priority: Priority }) {
        const now = new Date().toISOString();
        const occurrence: Occurrence = { id: randomUUID(), ...input, status: "ABERTA", requesterId: userId, createdAt: now, updatedAt: now, comments: [], history: [] };
        return postgresRepository.saveOccurrence(occurrence);
    }

    async update(id: string, managerId: string, input: { status?: Status; priority?: Priority; assigneeId?: string; solution?: string; note?: string }) {
        const occurrence = await this.find(id);
        if (!occurrence) return undefined;
        let history: StatusHistory | undefined;
        if (input.status) {
            if (!validStatuses.includes(input.status) || !transitions[occurrence.status].includes(input.status)) throw new Error(`Transição inválida: ${occurrence.status} -> ${input.status}`);
            history = { id: randomUUID(), previousStatus: occurrence.status, newStatus: input.status, note: input.note, changedBy: managerId, changedAt: new Date().toISOString() };
            occurrence.history.push(history);
            occurrence.status = input.status;
        }
        if (input.priority) occurrence.priority = input.priority;
        if (input.assigneeId !== undefined) occurrence.assigneeId = input.assigneeId;
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

    dashboard() {
        return postgresRepository.dashboard();
    }
}

export const occurrenceService = new OccurrenceService();
