import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { postgresRepository } from "../repositories/postgres.repository";
import { Role, User } from "../types/domain";

function jwtSecret() {
    return process.env.JWT_SECRET || "resolve-ai-development-secret";
}

export class AuthService {
    async register(name: string, email: string, password: string, role: Role = "SOLICITANTE") {
        const normalizedEmail = String(email).toLowerCase();
        if (await postgresRepository.findUserByEmail(normalizedEmail)) throw new Error("E-mail já cadastrado");
        const user: User = {
            id: randomUUID(), name, email: normalizedEmail,
            passwordHash: await bcrypt.hash(password, 10), role,
            createdAt: new Date().toISOString(),
        };
        await postgresRepository.saveUser(user);
        return this.session(user);
    }

    async login(email: string, password: string) {
        const user = await postgresRepository.findUserByEmail(String(email).toLowerCase());
        if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) throw new Error("E-mail ou senha inválidos");
        return this.session(user);
    }

    private session(user: User) {
        const { passwordHash: _passwordHash, ...publicUser } = user;
        return { user: publicUser, token: jwt.sign({ sub: user.id, role: user.role }, jwtSecret(), { expiresIn: "8h" }) };
    }
}

export const authService = new AuthService();
