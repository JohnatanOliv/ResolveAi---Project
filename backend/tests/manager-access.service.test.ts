import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRequest, findUserById, getOwnRequest, listRequests, decideRequest } = vi.hoisted(() => ({
    createRequest: vi.fn(),
    findUserById: vi.fn(),
    getOwnRequest: vi.fn(),
    listRequests: vi.fn(),
    decideRequest: vi.fn(),
}));

vi.mock("../src/repositories/postgres.repository", () => ({
    postgresRepository: {
        createManagerAccessRequest: createRequest,
        findUserById,
        getManagerAccessRequest: getOwnRequest,
        listManagerAccessRequests: listRequests,
        decideManagerAccessRequest: decideRequest,
    },
}));

import { ManagerAccessService } from "../src/services/manager-access.service";

const service = new ManagerAccessService();

describe("manager access requests", () => {
    beforeEach(() => vi.clearAllMocks());

    it("allows a requester to submit a trimmed reason", async () => {
        findUserById.mockResolvedValue({ id: "user-1", role: "SOLICITANTE" });
        createRequest.mockResolvedValue({ id: "request-1", reason: "Preciso acompanhar a equipe" });

        await expect(service.request("user-1", "  Preciso acompanhar a equipe  ")).resolves.toMatchObject({ id: "request-1" });
        expect(createRequest).toHaveBeenCalledWith("user-1", "Preciso acompanhar a equipe");
    });

    it.each(["GESTOR", "ADMIN"])("prevents a %s account from creating a manager request", async (role) => {
        findUserById.mockResolvedValue({ id: "user-1", role });

        await expect(service.request("user-1", "Preciso acompanhar a equipe")).rejects.toThrow("Somente solicitantes podem pedir acesso de gestor");
        expect(createRequest).not.toHaveBeenCalled();
    });

    it("rejects duplicate pending requests", async () => {
        findUserById.mockResolvedValue({ id: "user-1", role: "SOLICITANTE" });
        createRequest.mockRejectedValue({ code: "23505" });

        await expect(service.request("user-1", "Preciso acompanhar a equipe")).rejects.toThrow("Você já tem um pedido de acesso pendente");
    });

    it("records admin decisions through the repository", async () => {
        decideRequest.mockResolvedValue({ id: "request-1", status: "APROVADO" });

        await expect(service.decide("request-1", "admin-1", "APROVADO", "  Aprovado  ")).resolves.toMatchObject({ status: "APROVADO" });
        expect(decideRequest).toHaveBeenCalledWith("request-1", "admin-1", "APROVADO", "Aprovado");
    });
});
