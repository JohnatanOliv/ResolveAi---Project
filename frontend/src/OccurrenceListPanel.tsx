import { useMemo, useState } from "react";
import { Activity, ChevronRight, ClipboardList, Filter, Plus, Search } from "lucide-react";
import { Occurrence, Priority, Status, User } from "./types";

const statusLabels: Record<Status, string> = {
  ABERTA: "Aberta",
  EM_ANALISE: "Em análise",
  EM_ATENDIMENTO: "Em atendimento",
  RESOLVIDA: "Resolvida",
  CANCELADA: "Cancelada",
};
const priorityLabels: Record<Priority, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", URGENTE: "Urgente" };
const categoryOptions = ["Iluminação", "Manutenção", "Limpeza", "Segurança", "Acessibilidade", "Vazamento", "Outro"];
const statusOptions: Status[] = ["ABERTA", "EM_ANALISE", "EM_ATENDIMENTO", "RESOLVIDA", "CANCELADA"];
const priorityOptions: Priority[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function OccurrenceListPanel({ occurrences, loading, user, onCreate, onSelect }: {
  occurrences: Occurrence[];
  loading: boolean;
  user: User;
  onCreate: () => void;
  onSelect: (item: Occurrence) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const filtered = useMemo(() => occurrences.filter((item) =>
    `${item.title} ${item.category} ${item.location}`.toLowerCase().includes(query.toLowerCase()) &&
    (!status || item.status === status) &&
    (!category || item.category === category) &&
    (!priority || item.priority === priority),
  ), [occurrences, query, status, category, priority]);

  return <>
    <div className="page-intro">
      <div><span className="section-kicker">REGISTROS</span><h1>{user.role === "GESTOR" || user.role === "ADMIN" ? "Todas as ocorrências" : "Minhas ocorrências"}</h1><p>{filtered.length} de {occurrences.length} registros encontrados.</p></div>
      <button className="primary-button" onClick={onCreate}><Plus size={18} /> Nova ocorrência</button>
    </div>
    <div className="filter-bar occurrence-filters">
      <div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título, categoria ou local..." aria-label="Buscar ocorrências" /></div>
      <div className="filter-select"><Filter size={16} /><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>{categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
      <div className="filter-select"><Filter size={16} /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status"><option value="">Todos os status</option>{statusOptions.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></div>
      <div className="filter-select"><Filter size={16} /><select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filtrar por prioridade"><option value="">Todas as prioridades</option>{priorityOptions.map((item) => <option key={item} value={item}>{priorityLabels[item]}</option>)}</select></div>
    </div>
    {loading ? <div className="empty-state"><Activity className="spin" /><p>Carregando ocorrências...</p></div> : <div className="table-wrap"><table><thead><tr><th>Ocorrência</th><th>Empresa / local</th><th>Categoria</th><th>Prioridade</th><th>Status</th><th>Atualizada</th><th /></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} onClick={() => onSelect(item)}><td><div className="issue-title"><span className="issue-dot" /><div><strong>{item.title}</strong><small>#{item.id.slice(0, 8)}</small></div></div></td><td><div className="company-cell"><strong>{item.companyName || "Sem empresa"}</strong><small>{item.locationName ? `${item.locationName} · ` : ""}{item.locationAddress || item.location}</small></div></td><td><span className="category-text">{item.category}</span></td><td><span className={`priority ${item.priority.toLowerCase()}`}>{priorityLabels[item.priority]}</span></td><td><span className={`status-pill ${item.status.toLowerCase()}`}><i />{statusLabels[item.status]}</span></td><td className="date-cell">{formatDate(item.updatedAt)}</td><td><ChevronRight className="row-arrow" size={17} /></td></tr>)}</tbody></table>{!filtered.length && <div className="empty-state"><ClipboardList size={28} /><strong>Nenhuma ocorrência encontrada</strong><p>Ajuste os filtros ou registre uma nova ocorrência.</p></div>}</div>}
  </>;
}
