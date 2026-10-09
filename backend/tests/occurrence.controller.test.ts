import { beforeEach, describe, expect, it, vi } from "vitest";
import { Response } from "express";

const { createOccurrence, findOccurrence, managerOwnsOccurrence, listOccurrences } = vi.hoisted(() => ({
    createOccurrence: vi.fn(),
    findOccurrence: vi.fn(),
    managerOwnsOccurrence: vi.fn(),
    listOccurrences: vi.fn(),
}));

vi.mock("../src/services/occurrence.service", () => ({
    occurrenceService: {
        create: createOccurrence,
        find: findOccurrence,
        list: listOccurrences,
        managerOwnsOccurrence,
    },
    validPriorities: ["BAIXA", "MEDIA", "ALTA", "URGENTE"],
}));

import { AuthRequest } from "../src/middleware/auth.middleware";
import { create, getById, list } from "../src/controllers/occurrence.controller";

function responseMock() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
}

const validPayload = {
    title: "Teste de imagem",
    description: "Descrição de teste",
    category: "Manutenção",
    location: "Bloco A",
    companyId: "company-1",
    locationId: "location-1",
    priority: "MEDIA",
};

describe("occurrence API contract", () => {
    beforeEach(() => vi.clearAllMocks());

    it("accepts a supported image data URL", async () => {
        createOccurrence.mockResolvedValue({ id: "occ-1" });
        const req = {
            user: { id: "requester-1", role: "SOLICITANTE" },
            body: { ...validPayload, imageUrl: "data:image/png;base64,iVBORw0KGgo=" },
        } as unknown as AuthRequest;
        const res = responseMock();

        await create(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(createOccurrence).toHaveBeenCalledWith("requester-1", expect.objectContaining({ imageUrl: "data:image/png;base64,iVBORw0KGgo=" }));
    });

    it("rejects unsupported image formats", async () => {
        const req = {
            user: { id: "requester-1", role: "SOLICITANTE" },
            body: { ...validPayload, imageUrl: "data:image/svg+xml;base64,PHN2Zz4=" },
        } as unknown as AuthRequest;
        const res = responseMock();

        await create(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(createOccurrence).not.toHaveBeenCalled();
    });

    it("rejects image data larger than one megabyte", async () => {
        const imageUrl = `data:image/png;base64,${"A".repeat(1_333_336)}`;
        const req = {
            user: { id: "requester-1", role: "SOLICITANTE" },
            body: { ...validPayload, imageUrl },
        } as unknown as AuthRequest;
        const res = responseMock();

        await create(req, res);

        expect(res.status).toHaveBeenCalledWith(413);
        expect(createOccurrence).not.toHaveBeenCalled();
    });

    it("forwards category, status and priority filters to the service", async () => {
        listOccurrences.mockResolvedValue([]);
        const req = {
            user: { id: "manager-1", role: "GESTOR" },
            query: { category: "Limpeza", status: "ABERTA", priority: "ALTA" },
        } as unknown as AuthRequest;
        const res = responseMock();

        await list(req, res);

        expect(listOccurrences).toHaveBeenCalledWith(req.user, req.query);
        expect(res.json).toHaveBeenCalledWith({ data: [], total: 0 });
    });

    it("blocks a manager from another company from viewing an occurrence", async () => {
        findOccurrence.mockResolvedValue({ id: "occ-1", requesterId: "requester-1" });
        managerOwnsOccurrence.mockResolvedValue(false);
        const req = { user: { id: "manager-2", role: "GESTOR" }, params: { id: "occ-1" } } as unknown as AuthRequest;
        const res = responseMock();

        await getById(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: "Sem permissão para visualizar esta ocorrência" });
    });
});
