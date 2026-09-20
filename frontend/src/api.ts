import { Dashboard, Occurrence, Priority, Status, User } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333/api";
const tokenKey = "resolve-ai-token";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(tokenKey);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Não foi possível concluir a solicitação");
  return body;
}

export const api = {
  tokenKey,
  register: (data: { name: string; email: string; password: string; role: string }) => request<{ user: User; token: string }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) => request<{ user: User; token: string }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  occurrences: (filters = "") => request<{ data: Occurrence[]; total: number }>(`/occurrences${filters}`),
  createOccurrence: (data: Partial<Occurrence>) => request<Occurrence>("/occurrences", { method: "POST", body: JSON.stringify(data) }),
  updateOccurrence: (id: string, data: { status?: Status; priority?: Priority; solution?: string; note?: string }) => request<Occurrence>(`/occurrences/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  comment: (id: string, text: string) => request(`/occurrences/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) }),
  rate: (id: string, rating: number) => request(`/occurrences/${id}/rating`, { method: "POST", body: JSON.stringify({ rating }) }),
  dashboard: () => request<Dashboard>("/dashboard"),
};
