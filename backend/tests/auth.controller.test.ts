import { beforeEach, describe, expect, it, vi } from "vitest";
import { Request, Response, NextFunction } from "express";

const { registerUser } = vi.hoisted(() => ({ registerUser: vi.fn() }));

vi.mock("../src/services/auth.service", () => ({
    authService: { register: registerUser },
}));

import { register } from "../src/controllers/auth.controller";

describe("public registration", () => {
    beforeEach(() => registerUser.mockReset());

    it("ignores a client-supplied ADMIN role", async () => {
        registerUser.mockResolvedValue({ user: { id: "user-1", role: "SOLICITANTE" }, token: "token" });
        const req = { body: { name: "Test User", email: "test@example.com", password: "password", role: "ADMIN" } } as Request;
        const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
        const next = vi.fn() as NextFunction;

        await register(req, response, next);

        expect(registerUser).toHaveBeenCalledWith("Test User", "test@example.com", "password");
        expect(response.status).toHaveBeenCalledWith(201);
        expect(next).not.toHaveBeenCalled();
    });

    it("rejects registration without required fields", async () => {
        const req = { body: { email: "test@example.com", password: "password" } } as Request;
        const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;

        await register(req, response, vi.fn() as NextFunction);

        expect(response.status).toHaveBeenCalledWith(400);
        expect(registerUser).not.toHaveBeenCalled();
    });
});
