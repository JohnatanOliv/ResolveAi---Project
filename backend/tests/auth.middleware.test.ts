import { describe, expect, it, vi } from "vitest";
import { Response, NextFunction } from "express";
import { AuthRequest, requireAdmin } from "../src/middleware/auth.middleware";

describe("admin authorization", () => {
    it("allows ADMIN", () => {
        const req = { user: { id: "admin-1", role: "ADMIN" } } as AuthRequest;
        const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
        const next = vi.fn() as NextFunction;

        requireAdmin(req, response, next);

        expect(next).toHaveBeenCalledOnce();
        expect(response.status).not.toHaveBeenCalled();
    });

    it.each(["SOLICITANTE", "GESTOR"])("rejects %s from admin-only endpoints", (role) => {
        const req = { user: { id: "user-1", role } } as unknown as AuthRequest;
        const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
        const next = vi.fn() as NextFunction;

        requireAdmin(req, response, next);

        expect(response.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});
