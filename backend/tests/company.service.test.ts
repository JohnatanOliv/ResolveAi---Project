import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCompany, createLocation, listCompanies, listLocations, managerOwnsCompany } = vi.hoisted(() => ({
    createCompany: vi.fn(),
    createLocation: vi.fn(),
    listCompanies: vi.fn(),
    listLocations: vi.fn(),
    managerOwnsCompany: vi.fn(),
}));

vi.mock("../src/repositories/postgres.repository", () => ({
    postgresRepository: { createCompany, createLocation, listCompanies, listLocations, managerOwnsCompany },
}));

import { CompanyService } from "../src/services/company.service";

const service = new CompanyService();
const requester = { id: "requester-1", role: "SOLICITANTE" as const };
const manager = { id: "manager-1", role: "GESTOR" as const };
const admin = { id: "admin-1", role: "ADMIN" as const };

describe("company and location service", () => {
    beforeEach(() => vi.clearAllMocks());

    it("allows any authenticated role to select active companies", async () => {
        listCompanies.mockResolvedValue([{ id: "company-1", name: "Empresa A" }]);

        await expect(service.listCompanies(requester)).resolves.toEqual([{ id: "company-1", name: "Empresa A" }]);
        expect(listCompanies).toHaveBeenCalledWith(requester);
    });

    it("allows a manager to create a company with only its name", async () => {
        createCompany.mockResolvedValue({ id: "company-1", name: "Empresa A", managerId: manager.id });

        await expect(service.createCompany(manager, " Empresa A ")).resolves.toMatchObject({ name: "Empresa A" });
        expect(createCompany).toHaveBeenCalledWith(manager.id, "Empresa A");
    });

    it("does not let requesters create companies", async () => {
        await expect(service.createCompany(requester, "Empresa A")).rejects.toThrow("Acesso restrito a gestores");
        expect(createCompany).not.toHaveBeenCalled();
    });

    it("requires a manager to own the company before adding a location", async () => {
        managerOwnsCompany.mockResolvedValue(false);

        await expect(service.addLocation(manager, "company-2", "Unidade Centro", "Rua 1"))
            .rejects.toThrow("Você não administra esta empresa");
        expect(createLocation).not.toHaveBeenCalled();
    });

    it("lets ADMIN add a location to any company", async () => {
        createLocation.mockResolvedValue({ id: "location-1", name: "Unidade Centro", address: "Rua 1" });

        await expect(service.addLocation(admin, "company-2", "Unidade Centro", "Rua 1"))
            .resolves.toMatchObject({ name: "Unidade Centro" });
        expect(managerOwnsCompany).not.toHaveBeenCalled();
        expect(createLocation).toHaveBeenCalledWith("company-2", "Unidade Centro", "Rua 1");
    });
});
