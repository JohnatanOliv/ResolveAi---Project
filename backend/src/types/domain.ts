export type Role = "SOLICITANTE" | "GESTOR";
export type Status = "ABERTA" | "EM_ANALISE" | "EM_ATENDIMENTO" | "RESOLVIDA" | "CANCELADA";
export type Priority = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

export interface User {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
    createdAt: string;
}

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: Role;
}

export interface StatusHistory {
    id: string;
    previousStatus: Status | null;
    newStatus: Status;
    note?: string;
    changedBy: string;
    changedAt: string;
}

export interface Comment {
    id: string;
    text: string;
    authorId: string;
    createdAt: string;
}

export interface Occurrence {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    imageUrl?: string;
    priority: Priority;
    status: Status;
    requesterId: string;
    assigneeId?: string;
    solution?: string;
    rating?: number;
    createdAt: string;
    updatedAt: string;
    comments: Comment[];
    history: StatusHistory[];
}
