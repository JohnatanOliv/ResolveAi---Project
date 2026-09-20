import { User, Occurrence } from "../types/domain";

export class MemoryRepository {
    private readonly users: User[] = [];
    private readonly occurrences: Occurrence[] = [];

    listUsers() { return this.users; }
    findUserById(id: string) { return this.users.find((user) => user.id === id); }
    findUserByEmail(email: string) { return this.users.find((user) => user.email === email); }
    saveUser(user: User) { this.users.push(user); return user; }

    listOccurrences() { return this.occurrences; }
    findOccurrenceById(id: string) { return this.occurrences.find((occurrence) => occurrence.id === id); }
    saveOccurrence(occurrence: Occurrence) { this.occurrences.push(occurrence); return occurrence; }
}

export const memoryRepository = new MemoryRepository();
