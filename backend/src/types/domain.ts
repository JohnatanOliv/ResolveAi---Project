export type Role = "SOLICITANTE" | "GESTOR" | "ADMIN";
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

export interface Company {
    id: string;
    name: string;
    managerId: string;
    createdAt: string;
}

export interface CompanyLocation {
    id: string;
    companyId: string;
    name: string;
    address: string;
    createdAt: string;
}

export interface CompanyOperator {
    id: string;
    companyId: string;
    name: string;
    phone?: string;
    createdAt: string;
}

export interface ManagerAccessRequest {
    id: string;
    requesterId: string;
    requesterName: string;
    requesterEmail: string;
    reason: string;
    status: "PENDENTE" | "APROVADO" | "RECUSADO";
    createdAt: string;
    decidedAt?: string;
    decidedBy?: string;
    decisionNote?: string;
}

export interface StatusHistory {
    id: string;
    previousStatus: Status | null;
    newStatus: Status;
    note?: string;
    changedBy: string;
    changedByName?: string;
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
    companyId?: string;
    companyName?: string;
    locationId?: string;
    locationName?: string;
    locationAddress?: string;
    operatorId?: string;
    operatorName?: string;
    operatorPhone?: string;
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
