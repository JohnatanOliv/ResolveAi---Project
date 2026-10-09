import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, Building2, MapPin, Plus } from "lucide-react";
import { api } from "./api";
import { Company, CompanyLocation, User } from "./types";
import "./company-management.css";

interface ManagedCompany extends Company {
  locations: CompanyLocation[];
  locationName: string;
  locationAddress: string;
}

export function CompanyManagement({ user }: { user: User }) {
  const [companies, setCompanies] = useState<ManagedCompany[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    try {
      const result = await api.managedCompanies();
      const withLocations = await Promise.all(result.data.map(async (company) => {
        const locations = await api.companyLocations(company.id);
        return { ...company, locations: locations.data, locationName: "", locationAddress: "" };
      }));
      setCompanies(withLocations);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as empresas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function addCompany(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api.createCompany(companyName);
      setCompanyName("");
      setSuccess("Empresa cadastrada. Agora adicione seus endereços.");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível cadastrar a empresa");
    } finally {
      setBusy(false);
    }
  }

  async function addLocation(company: ManagedCompany) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api.createCompanyLocation(company.id, company.locationName, company.locationAddress);
      setCompanies((current) => current.map((item) => item.id === company.id ? { ...item, locationName: "", locationAddress: "" } : item));
      setSuccess(`Endereço adicionado à ${company.name}.`);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível adicionar o endereço");
    } finally {
      setBusy(false);
    }
  }

  function updateCompanyField(id: string, field: "locationName" | "locationAddress", value: string) {
    setCompanies((current) => current.map((company) => company.id === id ? { ...company, [field]: value } : company));
  }

  return <>
    <div className="page-intro">
      <div><span className="section-kicker">CADASTRO DE LOCAIS</span><h1>Empresas e endereços</h1><p>Cadastre uma empresa e os prédios/unidades que poderão ser escolhidos nas solicitações.</p></div>
    </div>
    {error && <div className="error-banner"><AlertCircle size={17} /> {error}</div>}
    {success && <div className="company-success" role="status">{success}</div>}
    <section className="company-create-section">
      <div><span className="section-kicker">NOVA EMPRESA</span><h2>Comece pelo nome</h2></div>
      <form className="company-create-form" onSubmit={addCompany}>
        <label htmlFor="company-name">Nome da empresa</label>
        <input id="company-name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} maxLength={120} placeholder="Ex.: Empresa A" required />
        <button className="primary-button" disabled={busy || !companyName.trim()}><Plus size={16} /> Cadastrar empresa</button>
      </form>
    </section>
    {loading ? <div className="empty-state">Carregando empresas...</div> : companies.length === 0 ? <div className="empty-state"><Building2 size={28} /><strong>Nenhuma empresa cadastrada</strong><p>Adicione o nome da organização para cadastrar os endereços.</p></div> : <div className="company-list">
      {companies.map((company) => <article className="company-row" key={company.id}>
        <div className="company-heading"><span className="company-icon"><Building2 size={19} /></span><div><h3>{company.name}</h3><small>{company.locations.length} {company.locations.length === 1 ? "endereço" : "endereços"}</small></div></div>
        {company.locations.length > 0 && <ul className="company-location-list">{company.locations.map((location) => <li key={location.id}><MapPin size={15} /><span><strong>{location.name}</strong><small>{location.address}</small></span></li>)}</ul>}
        <div className="company-location-form">
          <label>Nome curto do prédio/unidade<input value={company.locationName} onChange={(event) => updateCompanyField(company.id, "locationName", event.target.value)} maxLength={80} placeholder="Ex.: Torre 3" /></label>
          <label>Endereço<input value={company.locationAddress} onChange={(event) => updateCompanyField(company.id, "locationAddress", event.target.value)} maxLength={200} placeholder="Ex.: Rua das Flores, 120" /></label>
          <button className="secondary-button" onClick={() => void addLocation(company)} disabled={busy || !company.locationName.trim() || !company.locationAddress.trim()}><Plus size={15} /> Adicionar endereço</button>
        </div>
      </article>)}
    </div>}
    <p className="company-owner-note">Responsável: {user.name} · Os solicitantes autenticados poderão selecionar as empresas e endereços ativos.</p>
  </>;
}
