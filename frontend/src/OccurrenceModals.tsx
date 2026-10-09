import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { AlertCircle, Building2, FilePlus2, ImagePlus, MapPin, MessageSquare, Star, UserRoundCheck, X } from "lucide-react";
import { api } from "./api";
import { Company, CompanyLocation, CompanyOperator, Occurrence, Priority, Status, User } from "./types";

const categories = ["Iluminação", "Manutenção", "Limpeza", "Segurança", "Acessibilidade", "Vazamento", "Outro"];
const statusLabels: Record<Status, string> = { ABERTA: "Aberta", EM_ANALISE: "Em análise", EM_ATENDIMENTO: "Em atendimento", RESOLVIDA: "Resolvida", CANCELADA: "Cancelada" };
const priorityLabels: Record<Priority, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", URGENTE: "Urgente" };
const priorities: Priority[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
const statuses: Status[] = ["ABERTA", "EM_ANALISE", "EM_ATENDIMENTO", "RESOLVIDA", "CANCELADA"];
const maxImageBytes = 1_000_000;
const acceptedImageTypes = ["image/png", "image/jpeg", "image/webp"];
const commonProblems: Record<string, string[]> = {
  "Iluminação": ["Lâmpada queimada", "Luz piscando", "Área sem iluminação"],
  "Manutenção": ["Equipamento quebrado", "Porta ou fechadura com defeito", "Reparo necessário"],
  "Limpeza": ["Área precisa de limpeza", "Coleta de lixo", "Vazamento ou sujeira no local"],
  "Segurança": ["Acesso ou portão com problema", "Iluminação de segurança", "Situação suspeita"],
  "Acessibilidade": ["Elevador com problema", "Rampa ou acesso bloqueado", "Outro problema de acessibilidade"],
  "Vazamento": ["Vazamento de água", "Infiltração", "Entupimento"],
  "Outro": ["Outro problema"],
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Não foi possível ler a imagem"));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem"));
    reader.readAsDataURL(file);
  });
}

export function CreateOccurrenceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [form, setForm] = useState({ title: "", description: "", category: categories[0], location: "", priority: "MEDIA" as Priority, imageUrl: "", companyId: "", locationId: "", issue: "", customTitle: "", details: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.companies().then((result) => setCompanies(result.data)).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as empresas");
    });
  }, []);

  async function selectCompany(nextCompanyId: string) {
    setForm((current) => ({ ...current, companyId: nextCompanyId, locationId: "" }));
    setLocations([]);
    if (!nextCompanyId) return;
    try {
      const result = await api.companyLocations(nextCompanyId);
      setLocations(result.data);
      setError(result.data.length ? "" : "Esta empresa ainda não tem prédios ou endereços cadastrados.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os endereços");
    }
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!acceptedImageTypes.includes(file.type)) {
      setError("Escolha uma imagem PNG, JPEG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > maxImageBytes) {
      setError("A imagem deve ter no máximo 1 MB.");
      event.target.value = "";
      return;
    }
    try {
      setError("");
      setForm((current) => ({ ...current, imageUrl: "" }));
      const imageUrl = await readImage(file);
      setForm((current) => ({ ...current, imageUrl }));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Não foi possível anexar a imagem");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const issue = form.issue === "Outro problema" ? form.customTitle.trim() : form.issue;
    if (!form.companyId || !form.locationId) { setError("Selecione a empresa e o prédio/endereço."); return; }
    if (!issue) { setError("Selecione ou informe o problema."); return; }
    setBusy(true);
    setError("");
    try {
      const company = companies.find((item) => item.id === form.companyId);
      const location = locations.find((item) => item.id === form.locationId);
      await api.createOccurrence({
        title: issue,
        description: form.details.trim() || issue,
        category: form.category,
        location: location ? `${location.name} — ${location.address}` : "",
        companyId: form.companyId,
        locationId: form.locationId,
        priority: form.priority,
        imageUrl: form.imageUrl || undefined,
        companyName: company?.name,
        locationName: location?.name,
        locationAddress: location?.address,
      });
      onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível criar a ocorrência");
    } finally {
      setBusy(false);
    }
  }

  return <Modal title="Nova ocorrência" subtitle="Escolha a empresa, o local e o problema." onClose={onClose}>
    <form className="modal-form" onSubmit={submit}>
      <div className="form-row">
        <label>Empresa<select value={form.companyId} onChange={(event) => void selectCompany(event.target.value)} required><option value="">Selecione a empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label>Prédio ou endereço<select value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value })} disabled={!form.companyId || !locations.length} required><option value="">{!form.companyId ? "Selecione uma empresa primeiro" : locations.length ? "Selecione o local" : "Nenhum endereço cadastrado"}</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.address}</option>)}</select></label>
      </div>
      <div className="form-row">
        <label>Tipo de problema<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value, issue: "", customTitle: "" })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Prioridade<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>{priorities.map((item) => <option key={item} value={item}>{priorityLabels[item]}</option>)}</select></label>
      </div>
      <label>Problema<select value={form.issue} onChange={(event) => setForm({ ...form, issue: event.target.value })} required><option value="">Selecione o problema</option>{commonProblems[form.category].map((issue) => <option key={issue} value={issue}>{issue}</option>)}</select></label>
      {form.issue === "Outro problema" && <label>Descreva o problema<input value={form.customTitle} onChange={(event) => setForm({ ...form, customTitle: event.target.value })} maxLength={160} placeholder="Ex.: Interfone sem áudio" required /></label>}
      <label>Detalhes adicionais (opcional)<textarea value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="Acrescente um detalhe útil, se necessário..." rows={3} /></label>
      <label className="image-upload"><span><ImagePlus size={16} /> Anexar imagem (opcional)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectImage} /><small>PNG, JPEG ou WebP, até 1 MB</small></label>
      {form.imageUrl && <div className="image-preview"><img src={form.imageUrl} alt="Prévia do anexo da ocorrência" /><button type="button" className="icon-button" title="Remover imagem" onClick={() => setForm({ ...form, imageUrl: "" })}><X size={16} /></button></div>}
      {error && <div className="form-error" role="alert"><AlertCircle size={16} /> {error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy || !companies.length || !locations.length}><FilePlus2 size={17} />{busy ? "Registrando..." : "Registrar ocorrência"}</button></div>
    </form>
  </Modal>;
}

export function OccurrenceDetailModal({ occurrence, user, onClose, onUpdated }: { occurrence: Occurrence; user: User; onClose: () => void; onUpdated: () => void }) {
  const canManage = user.role === "GESTOR" || user.role === "ADMIN";
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState(occurrence.status);
  const [priority, setPriority] = useState(occurrence.priority);
  const [operatorId, setOperatorId] = useState(occurrence.operatorId || "");
  const [solution, setSolution] = useState(occurrence.solution || "");
  const [note, setNote] = useState("");
  const [rating, setRating] = useState(occurrence.rating || 0);
  const [operators, setOperators] = useState<CompanyOperator[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canManage || !occurrence.companyId) return;
    if (!occurrence.companyId) return;
    api.companyOperators(occurrence.companyId).then((result) => setOperators(result.data)).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os operadores da empresa");
    });
  }, [canManage, occurrence.companyId]);

  async function save() {
    const statusChanged = status !== occurrence.status;
    if (canManage && statusChanged && !note.trim()) {
      setError("Escreva uma observação para registrar a mudança de status.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const changes: { status?: Status; priority?: Priority; operatorId?: string | null; solution?: string; note?: string } = {};
      if (statusChanged) { changes.status = status; changes.note = note.trim(); }
      if (priority !== occurrence.priority) changes.priority = priority;
      if (operatorId !== (occurrence.operatorId || "")) changes.operatorId = operatorId || null;
      if (solution !== (occurrence.solution || "")) changes.solution = solution;
      if (canManage && Object.keys(changes).length) await api.updateOccurrence(occurrence.id, changes);
      if (comment.trim()) await api.comment(occurrence.id, comment.trim());
      onUpdated();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível atualizar a ocorrência");
    } finally {
      setBusy(false);
    }
  }

  async function submitRating(value: number) {
    setRating(value);
    setBusy(true);
    setError("");
    try {
      await api.rate(occurrence.id, value);
      onUpdated();
    } catch (ratingError) {
      setRating(occurrence.rating || 0);
      setError(ratingError instanceof Error ? ratingError.message : "Não foi possível salvar a avaliação");
    } finally {
      setBusy(false);
    }
  }

  return <Modal title={occurrence.title} subtitle={`Registrada em ${formatDate(occurrence.createdAt)}`} onClose={onClose}>
    <div className="detail-meta"><span className={`status-pill ${occurrence.status.toLowerCase()}`}><i />{statusLabels[occurrence.status]}</span><span className={`priority ${occurrence.priority.toLowerCase()}`}>{priorityLabels[occurrence.priority]}</span>{occurrence.companyName && <span><Building2 size={14} /> {occurrence.companyName}</span>}<span><MapPin size={14} /> {occurrence.locationName ? `${occurrence.locationName} · ${occurrence.locationAddress}` : occurrence.location}</span>{occurrence.operatorName && <span><UserRoundCheck size={14} /> Operador: {occurrence.operatorName}{occurrence.operatorPhone ? ` · ${occurrence.operatorPhone}` : ""}</span>}</div>
    {occurrence.imageUrl && <img className="occurrence-image" src={occurrence.imageUrl} alt={`Imagem anexada: ${occurrence.title}`} />}
    <div className="detail-description"><span className="section-kicker">DESCRIÇÃO</span><p>{occurrence.description}</p></div>
    {occurrence.history.length > 0 && <div className="timeline"><span className="section-kicker">HISTÓRICO</span>{occurrence.history.map((entry) => <div className="timeline-row" key={entry.id}><span className="timeline-dot" /><div><strong>{entry.previousStatus ? `${statusLabels[entry.previousStatus]} → ` : "Registro inicial · "}{statusLabels[entry.newStatus]}</strong><small>{formatDate(entry.changedAt)} · {entry.changedByName || `Usuário ${entry.changedBy.slice(0, 8)}`}{entry.note ? ` · ${entry.note}` : ""}</small></div></div>)}</div>}
    <div className="comments-area"><span className="section-kicker"><MessageSquare size={13} /> COMENTÁRIOS</span>{occurrence.comments.length ? occurrence.comments.map((item) => <div className="comment" key={item.id}><span className="avatar small">{initials(user.name)}</span><div><p>{item.text}</p><small>{formatDate(item.createdAt)}</small></div></div>) : <p className="muted">Ainda não há comentários.</p>}</div>
    {user.id === occurrence.requesterId && occurrence.status === "RESOLVIDA" && <section className="rating-control"><span className="section-kicker">AVALIE A RESOLUÇÃO</span><div role="group" aria-label="Avaliação da resolução" className="rating-buttons">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onClick={() => void submitRating(value)} disabled={busy} aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`} aria-pressed={rating === value}><Star size={23} fill={value <= rating ? "currentColor" : "none"} /></button>)}</div>{rating > 0 && <small>Sua avaliação: {rating} de 5</small>}</section>}
    {canManage && <div className="manager-edit">
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as Status)}>{statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></label>
      <label>Prioridade<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{priorities.map((item) => <option key={item} value={item}>{priorityLabels[item]}</option>)}</select></label>
      <label>Operador responsável<select value={operatorId} onChange={(event) => setOperatorId(event.target.value)} disabled={!occurrence.companyId || !operators.length}><option value="">{!occurrence.companyId ? "Ocorrência sem empresa" : operators.length ? "Sem operador atribuído" : "Cadastre operadores na empresa"}</option>{operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name}{operator.phone ? ` · ${operator.phone}` : ""}</option>)}</select></label>
      {status !== occurrence.status && <label>Observação da mudança<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Descreva o motivo da mudança de status..." rows={2} required /></label>}
      <label>Solução aplicada<textarea value={solution} onChange={(event) => setSolution(event.target.value)} placeholder="Descreva a solução aplicada..." rows={2} /></label>
    </div>}
    <label className="comment-input"><span>Adicionar comentário</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Escreva uma atualização..." rows={2} /></label>
    {error && <div className="form-error" role="alert"><AlertCircle size={16} /> {error}</div>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Fechar</button><button className="primary-button" onClick={() => void save()} disabled={busy}>{busy ? "Salvando..." : "Salvar alterações"}</button></div>
  </Modal>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal"><div className="modal-header"><div><span className="section-kicker">RESOLVE AÍ</span><h2>{title}</h2><p>{subtitle}</p></div><button className="close-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div>{children}</div></div>;
}
