import { randomUUID } from "node:crypto";
import { AuthUser, Comment, Occurrence, Priority, Status, StatusHistory } from "../types/domain";
import { memoryRepository } from "../repositories/memory.repository";

export const validStatuses: Status[] = ["ABERTA", "EM_ANALISE", "EM_ATENDIMENTO", "RESOLVIDA", "CANCELADA"];
export const validPriorities: Priority[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
const transitions: Record<Status, Status[]> = {
    ABERTA: ["EM_ANALISE", "CANCELADA"], EM_ANALISE: ["EM_ATENDIMENTO", "CANCELADA"],
    EM_ATENDIMENTO: ["RESOLVIDA", "CANCELADA"], RESOLVIDA: [], CANCELADA: [],
};

export class OccurrenceService {
    list(user: AuthUser, filters: { category?: unknown; status?: unknown; priority?: unknown }) {
        return memoryRepository.listOccurrences().filter((occurrence) =>
            (user.role === "GESTOR" || occurrence.requesterId === user.id) &&
            (!filters.category || occurrence.category === filters.category) &&
            (!filters.status || occurrence.status === filters.status) &&
            (!filters.priority || occurrence.priority === filters.priority),
        );
    }

    find(id: string) { return memoryRepository.findOccurrenceById(id); }

    create(userId: string, input: { title: string; description: string; category: string; location: string; imageUrl?: string; priority: Priority }) {
        const now = new Date().toISOString();
        const occurrence: Occurrence = { id: randomUUID(), ...input, status: "ABERTA", requesterId: userId, createdAt: now, updatedAt: now, comments: [], history: [] };
        return memoryRepository.saveOccurrence(occurrence);
    }

    update(id: string, managerId: string, input: { status?: Status; priority?: Priority; assigneeId?: string; solution?: string; note?: string }) {
        const occurrence = this.find(id);
        if (!occurrence) return undefined;
        if (input.status) {
            if (!validStatuses.includes(input.status) || !transitions[occurrence.status].includes(input.status)) throw new Error(`Transição inválida: ${occurrence.status} -> ${input.status}`);
            const history: StatusHistory = { id: randomUUID(), previousStatus: occurrence.status, newStatus: input.status, note: input.note, changedBy: managerId, changedAt: new Date().toISOString() };
            occurrence.history.push(history);
            occurrence.status = input.status;
        }
        if (input.priority) occurrence.priority = input.priority;
        if (input.assigneeId !== undefined) occurrence.assigneeId = input.assigneeId;
        if (input.solution !== undefined) occurrence.solution = input.solution;
        occurrence.updatedAt = new Date().toISOString();
        return occurrence;
    }

    addComment(id: string, userId: string, text: string): Comment | undefined {
        const occurrence = this.find(id);
        if (!occurrence) return undefined;
        const comment: Comment = { id: randomUUID(), text, authorId: userId, createdAt: new Date().toISOString() };
        occurrence.comments.push(comment);
        occurrence.updatedAt = comment.createdAt;
        return comment;
    }

    dashboard() {
        const occurrences = memoryRepository.listOccurrences();
        const byStatus = Object.fromEntries(validStatuses.map((status) => [status, occurrences.filter((item) => item.status === status).length]));
        const byPriority = Object.fromEntries(validPriorities.map((priority) => [priority, occurrences.filter((item) => item.priority === priority).length]));
        const rated = occurrences.filter((item) => item.rating !== undefined);
        return { total: occurrences.length, byStatus, byPriority, averageRating: rated.length ? rated.reduce((sum, item) => sum + (item.rating || 0), 0) / rated.length : 0 };
    }
}

export const occurrenceService = new OccurrenceService();
