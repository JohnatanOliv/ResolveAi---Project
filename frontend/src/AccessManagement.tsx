import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, Check, Clock3, ShieldCheck, UserRoundCheck, X } from "lucide-react";
import { api } from "./api";
import { ManagerAccessRequest } from "./types";
import "./access-management.css";

function formatRequestDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ManagerAccessScreen() {
  const [request, setRequest] = useState<ManagerAccessRequest | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.myManagerAccessRequest()
      .then((result) => setRequest(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar o pedido"))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.requestManagerAccess(reason);
      setRequest(result.data);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o pedido");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="page-intro">
      <div><span className="section-kicker">ACESSO À GESTÃO</span><h1>Solicitar acesso de gestor</h1><p>Explique como você contribuirá com o atendimento das ocorrências.</p></div>
      <div className="date-chip"><ShieldCheck size={16} /> Aprovação administrativa</div>
    </div>
    {error && <div className="error-banner"><AlertCircle size={17} /> {error}</div>}
    {loading ? <div className="empty-state"><Clock3 className="spin" /><p>Consultando seu pedido...</p></div> : request?.status === "PENDENTE" ? <section className="section-block access-status">
      <div className="access-status-icon pending"><Clock3 size={22} /></div>
      <div><span className="section-kicker">PEDIDO EM ANÁLISE</span><h2>Aguardando decisão</h2><p>Enviado em {formatRequestDate(request.createdAt)}. Você receberá acesso após a aprovação do administrador.</p><blockquote>{request.reason}</blockquote></div>
    </section> : request?.status === "APROVADO" ? <section className="section-block access-status">
      <div className="access-status-icon approved"><Check size={22} /></div>
      <div><span className="section-kicker">PEDIDO APROVADO</span><h2>Acesso de gestor concedido</h2><p>Saia e entre novamente para carregar as permissões atualizadas.</p>{request.decisionNote && <blockquote>{request.decisionNote}</blockquote>}</div>
    </section> : <section className="section-block access-form-block">
      {request?.status === "RECUSADO" && <div className="access-notice"><X size={17} /><span>Seu pedido anterior foi recusado. Você pode enviar uma nova solicitação com mais contexto.</span></div>}
      <form className="access-request-form" onSubmit={submit}>
        <label htmlFor="manager-access-reason">Motivo do pedido</label>
        <textarea id="manager-access-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={20} maxLength={1000} rows={5} placeholder="Descreva sua função, experiência ou responsabilidade no atendimento..." required />
        <div className="access-form-footer"><small>{reason.length}/1000 caracteres</small><button className="primary-button" disabled={busy || reason.trim().length < 20}>{busy ? "Enviando..." : "Enviar para aprovação"}</button></div>
      </form>
    </section>}
  </>;
}

export function AdminAccessScreen() {
  const [requests, setRequests] = useState<ManagerAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const result = await api.managerAccessRequests();
      setRequests(result.data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os pedidos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function decide(id: string, decision: "APROVADO" | "RECUSADO") {
    setBusyId(id);
    setError("");
    try {
      const result = await api.decideManagerAccessRequest(id, decision);
      setRequests((current) => current.map((item) => item.id === id ? result.data : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível decidir o pedido");
    } finally {
      setBusyId("");
    }
  }

  const pendingCount = requests.filter((item) => item.status === "PENDENTE").length;
  return <>
    <div className="page-intro">
      <div><span className="section-kicker">ADMINISTRAÇÃO</span><h1>Pedidos de acesso</h1><p>{pendingCount} pedidos aguardando sua decisão.</p></div>
      <button className="secondary-button" onClick={() => void load()} disabled={loading}><Clock3 size={16} /> Atualizar</button>
    </div>
    {error && <div className="error-banner"><AlertCircle size={17} /> {error}</div>}
    {loading ? <div className="empty-state"><Clock3 className="spin" /><p>Carregando pedidos...</p></div> : requests.length === 0 ? <div className="empty-state"><UserRoundCheck size={28} /><strong>Nenhum pedido de acesso</strong><p>Novas solicitações aparecerão aqui.</p></div> : <div className="access-request-list">
      {requests.map((item) => <article className="access-request-row" key={item.id}>
        <div className="access-request-person"><span className="access-status-icon"><UserRoundCheck size={19} /></span><div><strong>{item.requesterName}</strong><small>{item.requesterEmail}</small></div></div>
        <p className="access-request-reason">{item.reason}</p>
        <div className="access-request-meta"><span className={`access-state ${item.status.toLowerCase()}`}>{item.status === "PENDENTE" ? "Pendente" : item.status === "APROVADO" ? "Aprovado" : "Recusado"}</span><small>{formatRequestDate(item.createdAt)}</small></div>
        {item.status === "PENDENTE" && <div className="access-request-actions"><button className="approve-button" onClick={() => void decide(item.id, "APROVADO")} disabled={busyId === item.id} title="Aprovar como gestor"><Check size={16} /> Aprovar</button><button className="reject-button" onClick={() => void decide(item.id, "RECUSADO")} disabled={busyId === item.id} title="Recusar pedido"><X size={16} /> Recusar</button></div>}
      </article>)}
    </div>}
  </>;
}
