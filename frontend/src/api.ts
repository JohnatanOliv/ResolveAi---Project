import { Company, CompanyLocation, CompanyOperator, Dashboard, ManagerAccessRequest, Occurrence, Priority, Status, User } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333/api";
const tokenKey = "resolve-ai-token";

function networkError() {
  return new Error("Não foi possível conectar ao servidor. Verifique se a API está online e tente novamente.");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(tokenKey);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    });
  } catch {
    throw networkError();
  }
  let body: unknown = {};
  try {
    body = await response.json();
  } catch {
    if (response.ok) throw new Error("O servidor respondeu em um formato inesperado. Tente novamente.");
  }
  if ([502, 503, 504].includes(response.status)) throw new Error("O serviço está temporariamente indisponível. Aguarde um instante e tente novamente.");
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
      ? body.message
      : "Não foi possível concluir a solicitação";
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  tokenKey,
  register: (data: { name: string; email: string; password: string }) => request<{ user: User; token: string }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) => request<{ user: User; token: string }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  occurrences: (filters = "") => request<{ data: Occurrence[]; total: number }>(`/occurrences${filters}`),
  createOccurrence: (data: Partial<Occurrence>) => request<Occurrence>("/occurrences", { method: "POST", body: JSON.stringify(data) }),
  updateOccurrence: (id: string, data: { status?: Status; priority?: Priority; operatorId?: string | null; solution?: string; note?: string }) => request<Occurrence>(`/occurrences/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  comment: (id: string, text: string) => request(`/occurrences/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) }),
  rate: (id: string, rating: number) => request(`/occurrences/${id}/rating`, { method: "POST", body: JSON.stringify({ rating }) }),
  dashboard: () => request<Dashboard>("/dashboard"),
  companies: () => request<{ data: Company[] }>("/companies"),
  managedCompanies: () => request<{ data: Company[] }>("/companies/managed"),
  createCompany: (name: string) => request<{ data: Company }>("/companies", { method: "POST", body: JSON.stringify({ name }) }),
  companyLocations: (companyId: string) => request<{ data: CompanyLocation[] }>(`/companies/${companyId}/locations`),
  createCompanyLocation: (companyId: string, name: string, address: string) => request<{ data: CompanyLocation }>(`/companies/${companyId}/locations`, { method: "POST", body: JSON.stringify({ name, address }) }),
  companyOperators: (companyId: string) => request<{ data: CompanyOperator[] }>(`/companies/${companyId}/operators`),
  createCompanyOperator: (companyId: string, name: string, phone?: string) => request<{ data: CompanyOperator }>(`/companies/${companyId}/operators`, { method: "POST", body: JSON.stringify({ name, phone }) }),
  myManagerAccessRequest: () => request<{ data: ManagerAccessRequest | null }>("/manager-access-request"),
  requestManagerAccess: (reason: string) => request<{ data: ManagerAccessRequest }>("/manager-access-request", { method: "POST", body: JSON.stringify({ reason }) }),
  managerAccessRequests: () => request<{ data: ManagerAccessRequest[] }>("/admin/manager-access-requests"),
  decideManagerAccessRequest: (id: string, decision: "APROVADO" | "RECUSADO", decisionNote?: string) => request<{ data: ManagerAccessRequest }>(`/admin/manager-access-requests/${id}`, { method: "PATCH", body: JSON.stringify({ decision, decisionNote }) }),
};
