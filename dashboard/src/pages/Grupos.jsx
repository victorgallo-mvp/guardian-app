import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronRight, Power, PowerOff, RefreshCw, Search } from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/client.js";

const TIPO_CONFIG = {
  atendimento: { label: "Atendimento", cor: "bg-blue-100 text-blue-700" },
  interno: { label: "Interno", cor: "bg-purple-100 text-purple-700" },
  vendas: { label: "Vendas", cor: "bg-green-100 text-green-700" },
  fornecedor: { label: "Fornecedor", cor: "bg-orange-100 text-orange-700" },
  outro: { label: "Outro", cor: "bg-gray-100 text-gray-600" }
};

const TIPOS = ["atendimento", "interno", "vendas", "fornecedor", "outro"];

function ModalNovoGrupo({ onFechar, onSalvo }) {
  const [form, setForm] = useState({
    idWhatsappGrupo: "",
    nomeGrupo: "",
    tipo: "atendimento",
    descricao: ""
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Busca de grupos do WhatsApp
  const [buscando, setBuscando] = useState(false);
  const [gruposWpp, setGruposWpp] = useState(null); // null = não buscado ainda
  const [filtroGrupo, setFiltroGrupo] = useState("");

  async function buscarGrupos() {
    setBuscando(true);
    setErro("");
    try {
      const lista = await api.get("/grupos/whatsapp-disponiveis");
      setGruposWpp(lista);
    } catch (err) {
      setErro(err.message);
    } finally {
      setBuscando(false);
    }
  }

  function selecionarGrupo(g) {
    setForm({ ...form, idWhatsappGrupo: g.jid, nomeGrupo: g.nome });
    setGruposWpp(null);
    setFiltroGrupo("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      await api.post("/grupos", form);
      onSalvo();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  const gruposFiltrados = gruposWpp?.filter((g) =>
    g.nome.toLowerCase().includes(filtroGrupo.toLowerCase())
  ) ?? [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Novo grupo</h2>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">ID do grupo (JID)</label>
              <button
                type="button"
                onClick={buscarGrupos}
                disabled={buscando}
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${buscando ? "animate-spin" : ""}`} />
                {buscando ? "Buscando..." : "Buscar grupos"}
              </button>
            </div>
            <input
              className="input"
              placeholder="120363XXXXXXXXX@g.us"
              value={form.idWhatsappGrupo}
              onChange={(e) => setForm({ ...form, idWhatsappGrupo: e.target.value })}
              required
            />
            {gruposWpp !== null && (
              <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                  <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <input
                    className="text-sm flex-1 outline-none placeholder-gray-400"
                    placeholder="Filtrar grupos..."
                    value={filtroGrupo}
                    onChange={(e) => setFiltroGrupo(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {gruposFiltrados.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhum grupo encontrado</p>
                  ) : (
                    gruposFiltrados.map((g) => (
                      <button
                        key={g.jid}
                        type="button"
                        onClick={() => selecionarGrupo(g)}
                        disabled={g.jaMonitorado}
                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between gap-2 ${
                          g.jaMonitorado ? "opacity-40 cursor-not-allowed" : ""
                        }`}
                      >
                        <span className="font-medium text-gray-800 truncate">{g.nome}</span>
                        {g.jaMonitorado ? (
                          <span className="text-xs text-gray-400 shrink-0">já monitorado</span>
                        ) : (
                          <span className="text-xs text-gray-400 shrink-0 font-mono">{g.jid.split("@")[0].slice(-6)}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              className="input"
              placeholder="Nome do grupo"
              value={form.nomeGrupo}
              onChange={(e) => setForm({ ...form, nomeGrupo: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              className="input"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>{TIPO_CONFIG[t]?.label ?? t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
            <input
              className="input"
              placeholder="Contexto adicional para a IA"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn-primary flex-1">
              {salvando ? "Salvando..." : "Criar grupo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Grupos() {
  const [mostrarModal, setMostrarModal] = useState(false);
  const [filtroAtivo, setFiltroAtivo] = useState("true");
  const { dados, carregando, recarregar } = useApi(`/grupos?ativo=${filtroAtivo}`, [filtroAtivo]);
  const navigate = useNavigate();

  async function toggleAtivo(grupo) {
    await api.put(`/grupos/${grupo._id}`, { ativo: !grupo.ativo });
    recarregar();
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grupos</h1>
          <p className="text-gray-500 text-sm mt-1">{dados?.length ?? 0} grupos</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filtroAtivo}
            onChange={(e) => setFiltroAtivo(e.target.value)}
            className="input w-auto"
          >
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
          <button onClick={() => setMostrarModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Novo grupo
          </button>
        </div>
      </div>

      {carregando ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : !dados?.length ? (
        <div className="card p-12 text-center text-gray-400">Nenhum grupo encontrado</div>
      ) : (
        <div className="space-y-2">
          {dados.map((grupo) => {
            const tipo = TIPO_CONFIG[grupo.tipo] ?? TIPO_CONFIG.outro;
            return (
              <div
                key={grupo._id}
                className="card p-4 flex items-center gap-4 hover:border-green-300 transition-colors cursor-pointer"
                onClick={() => navigate(`/grupos/${grupo._id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 truncate">{grupo.nomeGrupo}</span>
                    <span className={`badge ${tipo.cor}`}>{tipo.label}</span>
                    {!grupo.ativo && <span className="badge bg-red-100 text-red-600">Inativo</span>}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{grupo.idWhatsappGrupo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleAtivo(grupo); }}
                    title={grupo.ativo ? "Desativar" : "Ativar"}
                    className={`p-1.5 rounded-lg transition-colors ${
                      grupo.ativo
                        ? "text-green-600 hover:bg-green-50"
                        : "text-gray-400 hover:bg-gray-100"
                    }`}
                  >
                    {grupo.ativo ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mostrarModal && (
        <ModalNovoGrupo
          onFechar={() => setMostrarModal(false)}
          onSalvo={() => { setMostrarModal(false); recarregar(); }}
        />
      )}
    </div>
  );
}
