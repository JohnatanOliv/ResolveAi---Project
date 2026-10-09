import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    findOccurrenceById,
    findLocationForCompany,
    findOperatorForCompany,
    managerOwnsCompany,
    managerOwnsOccurrence,
    rateOccurrence,
    saveOccurrence,
    updateOccurrence,
} = vi.hoisted(() => ({
    findOccurrenceById: vi.fn(),
    findLocationForCompany: vi.fn(),
    findOperatorForCompany: vi.fn(),
    managerOwnsCompany: vi.fn(),
    managerOwnsOccurrence: vi.fn(),
    rateOccurrence: vi.fn(),
    saveOccurrence: vi.fn(),
    updateOccurrence: vi.fn(),
}));

vi.mock("../src/repositories/postgres.repository", () => ({
    postgresRepository: {
        findOccurrenceById,
        findLocationForCompany,
        managerOwnsCompany,
        managerOwnsOccurrence,
        findOperatorForCompany,
        rate: rateOccurrence,
        saveOccurrence,
        updateOccurrence,
    },
}));

import { OccurrenceService } from "../src/services/occurrence.service";

const service = new OccurrenceService();
const openOccurrence = {
    id: "occurrence-1",
    title: "Lâmpada queimada",
    description: "Lâmpada apagada",
    category: "Iluminação",
    location: "Bloco A",
    priority: "MEDIA" as const,
    status: "ABERTA" as const,
    requesterId: "requester-1",
    companyId: "company-1",
    createdAt: "2026-10-09T10:00:00.000Z",
    updatedAt: "2026-10-09T10:00:00.000Z",
    comments: [],
    history: [],
};

describe("occurrence lifecycle", () => {
    beforeEach(() => vi.clearAllMocks());

    it("creates an open occurrence and records its initial history entry", async () => {
        saveOccurrence.mockImplementation(async (occurrence) => occurrence);

        const created = await service.create("requester-1", {
            title: "Lâmpada queimada",
            description: "Lâmpada apagada",
            category: "Iluminação",
            location: "Bloco A",
            priority: "MEDIA",
        });

        expect(created.status).toBe("ABERTA");
        expect(created.history).toHaveLength(1);
        expect(created.history[0]).toMatchObject({
            previousStatus: null,
            newStatus: "ABERTA",
            changedBy: "requester-1",
            note: "Ocorrência registrada",
        });
        expect(saveOccurrence).toHaveBeenCalledWith(created);
    });

    it("rejects a location that does not belong to the selected company", async () => {
        findLocationForCompany.mockResolvedValue(undefined);

        await expect(service.create("requester-1", {
            title: "Lâmpada queimada",
            description: "Lâmpada apagada",
            category: "Iluminação",
            location: "Endereço estranho",
            companyId: "company-1",
            locationId: "location-other-company",
            priority: "MEDIA",
        })).rejects.toThrow("O endereço selecionado não pertence a esta empresa");
        expect(saveOccurrence).not.toHaveBeenCalled();
    });

    it("persists status transition note, actor and history", async () => {
        findOccurrenceById.mockResolvedValue({ ...openOccurrence, history: [] });
        updateOccurrence.mockImplementation(async (occurrence, history) => ({ occurrence, history }));

        const result = await service.update("occurrence-1", "manager-1", {
            status: "EM_ANALISE",
            note: "Equipe técnica acionada",
        });

        expect(result.occurrence.status).toBe("EM_ANALISE");
        expect(result.history).toMatchObject({
            previousStatus: "ABERTA",
            newStatus: "EM_ANALISE",
            changedBy: "manager-1",
            note: "Equipe técnica acionada",
        });
    });

    it("requires an observation when changing status", async () => {
        findOccurrenceById.mockResolvedValue({ ...openOccurrence, history: [] });

        await expect(service.update("occurrence-1", "manager-1", { status: "EM_ANALISE" }))
            .rejects.toThrow("Informe uma observação para registrar a mudança de status");
        expect(updateOccurrence).not.toHaveBeenCalled();
    });

    it("does not create a history transition when the status is unchanged", async () => {
        findOccurrenceById.mockResolvedValue({ ...openOccurrence, history: [] });
        updateOccurrence.mockImplementation(async (occurrence, history) => ({ occurrence, history }));

        const result = await service.update("occurrence-1", "manager-1", { status: "ABERTA", priority: "ALTA" });

        expect(result.occurrence.priority).toBe("ALTA");
        expect(result.history).toBeUndefined();
    });

    it("rejects an operator who is not registered under the occurrence company", async () => {
        findOccurrenceById.mockResolvedValue({ ...openOccurrence });
        findOperatorForCompany.mockResolvedValue(undefined);

        await expect(service.update("occurrence-1", "manager-1", { operatorId: "operator-2" }))
            .rejects.toThrow("O operador selecionado não pertence à empresa desta ocorrência");
        expect(updateOccurrence).not.toHaveBeenCalled();
    });

    it("accepts an operator from the occurrence company", async () => {
        findOccurrenceById.mockResolvedValue({ ...openOccurrence });
        findOperatorForCompany.mockResolvedValue({ id: "operator-1", companyId: "company-1", name: "Ana" });
        updateOccurrence.mockImplementation(async (occurrence) => occurrence);

        await service.update("occurrence-1", "manager-1", { operatorId: "operator-1" });

        expect(updateOccurrence).toHaveBeenCalledWith(expect.objectContaining({ operatorId: "operator-1" }), undefined);
    });

    it("rejects invalid lifecycle transitions", async () => {
        findOccurrenceById.mockResolvedValue({ ...openOccurrence });

        await expect(service.update("occurrence-1", "manager-1", { status: "RESOLVIDA" }))
            .rejects.toThrow("Transição inválida: ABERTA -> RESOLVIDA");
        expect(updateOccurrence).not.toHaveBeenCalled();
    });

    it("persists a requester rating", async () => {
        rateOccurrence.mockResolvedValue({ rating: 5 });

        await expect(service.rate("occurrence-1", "requester-1", 5)).resolves.toEqual({ rating: 5 });
        expect(rateOccurrence).toHaveBeenCalledWith("occurrence-1", "requester-1", 5);
    });

    it("checks tenant ownership through the repository", async () => {
        managerOwnsOccurrence.mockResolvedValue(false);

        await expect(service.managerOwnsOccurrence("manager-1", "occurrence-1")).resolves.toBe(false);
        expect(managerOwnsOccurrence).toHaveBeenCalledWith("manager-1", "occurrence-1");
    });
});
