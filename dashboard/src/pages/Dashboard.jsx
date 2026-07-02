import { useState, useMemo } from "react";
import {
  Users2, Bell, AlertCircle, CheckCircle2, TrendingUp,
  ChevronDown, ChevronUp, Eye, XCircle, Search,
  Clock, Moon, Wifi, WifiOff
} from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/client.js";

// ─── helpers ────────────────────────────────────────────────────────────────

const ORDEM_SEV = { critico: 0, urgente: 1, atencao: 2, info: 3 };

const SEV = {
  critico: { badge: "bg-red-100 text-red-700", borda: "border-l-red-500", dot: "bg-red-500" },
  urgente: { badge: "bg-orange-100 text-orange-700", borda: "border-l-orange-400", dot: "bg-orange-400" },
  atencao: { badge: "bg-yellow-100 text-yellow-700", borda: "border-l-yellow-400", dot: "bg-yellow-400" },
  info:    { badge: "bg-gray-100 text-gray-500",    borda: "border-l-gray-300",   dot: "bg-gray-300" }
};

const TIPO_COR = {
  atendimento: "bg-blue-100 text-blue-700",
  interno:     "bg-purple-100 text-purple-700",
  vendas:      "bg-green-100 text-green-700",
  fornecedor:  "bg-orange-100 text-orange-700",
  outro:       "bg-gray-100 text-gray-600"
};

const GATILHO_LABEL = {
  cliente_irritado:       "Cliente irritado",
  urgencia_explicita:     "Urgência",
  pedido_humano:          "Pedido humano",
  risco_cancelamento:     "Risco churn",
  oportunidade_quente:    "Oportunidade",
  problema_operacional:   "Prob. operacional",
  fora_do_escopo:         "Sem resposta",
  inatividade_preocupante:"Inatividade",
  risco_legal:            "Risco legal"
};

function tempo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function formatarHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
}

// ─── sub-componentes ─────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, cor }) {
  const cores = {
    green:  "bg-green-50 text-green-600",
    blue:   "bg-blue-50 text-blue-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red:    "bg-red-50 text-red-600"
  };
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`rounded-xl p-3 ${cores[cor] ?? cores.green}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function NotifRow({ n, onStatus }) {
  const [aberta, setAberta] = useState(false);
  const sev = SEV[n.severidade] ?? SEV.info;
  return (
    <div className="border-t border-gray-50 first:border-0">
      <div className="px-5 py-3 flex items-start gap-3">
        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${sev.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={`badge ${sev.badge} text-xs`}>{n.severidade}</span>
            {n.gatilho && (
              <span className="text-xs text-gray-400">{GATILHO_LABEL[n.gatilho] ?? n.gatilho}</span>
            )}
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">{formatarHora(n.enviadaEm)}</span>
            {n.responsavelNome && (
              <span className="text-xs text-gray-400">· {n.responsavelNome}</span>
            )}
          </div>
          <p className={`text-sm text-gray-700 whitespace-pre-wrap ${aberta ? "" : "line-clamp-2"}`}>
            {n.conteudoMensagem}
          </p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => onStatus(n._id, "ciente")} title="Ciente"
            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onStatus(n._id, "resolvida")} title="Resolvida"
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onStatus(n._id, "ignorada")} title="Ignorar"
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
            <XCircle className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setAberta((v) => !v)}
            className="p-1.5 text-gray-300 hover:bg-gray-100 rounded-lg transition-colors">
            {aberta ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function GrupoCard({ grupo, onStatusNotif, onSnooze, onLote }) {
  const [aberto, setAberto] = useState(false);
  const [loteando, setLoteando] = useState(false);

  const sev = SEV[grupo.alertas.piorSeveridade] ?? SEV.info;
  const temAlertas = grupo.alertas.total > 0;
  const emSnooze = grupo.emSnooze;

  async function handleLote(status) {
    setLoteando(true);
    await onLote(grupo.grupoId, status);
    setLoteando(false);
  }

  return (
    <div className={`card overflow-hidden border-l-4 ${
      emSnooze ? "border-l-gray-200 opacity-70" :
      temAlertas ? sev.borda : "border-l-green-400"
    }`}>
      {/* Cabeçalho do card */}
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Status dot */}
        {emSnooze ? (
          <Moon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : temAlertas ? (
          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${sev.dot} animate-pulse`} />
        ) : grupo.silencioSuspeito ? (
          <WifiOff className="w-4 h-4 text-gray-300 flex-shrink-0" />
        ) : (
          <span className="w-3 h-3 rounded-full bg-green-400 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm truncate">{grupo.nomeGrupo}</span>
            <span className={`badge text-xs ${TIPO_COR[grupo.tipo] ?? TIPO_COR.outro}`}>
              {grupo.tipo}
            </span>
            {emSnooze && (
              <span className="badge bg-gray-100 text-gray-500 text-xs">em snooze</span>
            )}
            {grupo.silencioSuspeito && !temAlertas && (
              <span className="badge bg-gray-100 text-gray-400 text-xs">sem msgs há {Math.floor((Date.now() - new Date(grupo.ultimaMensagemEm)) / 86400000)}d</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {temAlertas && (
            <div className="text-right">
              <span className={`badge ${sev.badge}`}>{grupo.alertas.total} alerta{grupo.alertas.total > 1 ? "s" : ""}</span>
              <p className="text-xs text-gray-400 mt-0.5">{tempo(grupo.alertas.ultimaEm)}</p>
            </div>
          )}
          {aberto ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Painel expandido */}
      {aberto && (
        <div className="border-t border-gray-100">
          {temAlertas && (
            <>
              {grupo.notificacoesPendentes.map((n) => (
                <NotifRow key={n._id} n={n} onStatus={onStatusNotif} />
              ))}
              {/* Ações em lote */}
              <div className="px-5 py-3 bg-gray-50 flex items-center gap-2 border-t border-gray-100">
                <span className="text-xs text-gray-500 mr-1">Marcar tudo:</span>
                <button
                  onClick={() => handleLote("ciente")}
                  disabled={loteando}
                  className="btn-secondary text-xs py-1 px-3"
                >
                  <Eye className="w-3 h-3" /> Ciente
                </button>
                <button
                  onClick={() => handleLote("resolvida")}
                  disabled={loteando}
                  className="btn-primary text-xs py-1 px-3"
                >
                  <CheckCircle2 className="w-3 h-3" /> Resolvido
                </button>
                <button
                  onClick={() => handleLote("ignorada")}
                  disabled={loteando}
                  className="btn-secondary text-xs py-1 px-3 ml-auto"
                >
                  <XCircle className="w-3 h-3" /> Ignorar tudo
                </button>
              </div>
            </>
          )}

          {/* Snooze / status vazio */}
          <div className="px-5 py-3 flex items-center justify-between bg-gray-50 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              {grupo.ultimaMensagemEm
                ? `Última mensagem ${tempo(grupo.ultimaMensagemEm)}`
                : "Sem mensagens registradas"}
            </div>
            {emSnooze ? (
              <button
                onClick={() => onSnooze(grupo.grupoId, false)}
                className="btn-secondary text-xs py-1 px-3"
              >
                Reativar
              </button>
            ) : (
              <button
                onClick={() => onSnooze(grupo.grupoId, true)}
                className="btn-secondary text-xs py-1 px-3"
              >
                <Moon className="w-3 h-3" /> Snooze 4h
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── página principal ────────────────────────────────────────────────────────

export default function Dashboard() {
  const [busca, setBusca] = useState("");
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const { dados: stats } = useApi("/dashboard/stats");
  const { dados: grupos, carregando, recarregar } = useApi(
    `/dashboard/grupos-alertas${mostrarTodos ? "?todos=true" : ""}`,
    [mostrarTodos]
  );

  const gruposFiltrados = useMemo(() => {
    if (!grupos || !busca.trim()) return grupos ?? [];
    const q = busca.toLowerCase();
    return grupos.filter((g) => g.nomeGrupo.toLowerCase().includes(q));
  }, [grupos, busca]);

  async function atualizarStatusNotif(id, status) {
    await api.patch(`/notificacoes/${id}/status`, { status });
    recarregar();
  }

  async function snoozeGrupo(grupoId, ativar) {
    const pausadoAte = ativar
      ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
      : null;
    await api.put(`/grupos/${grupoId}`, { pausadoAte });
    recarregar();
  }

  async function loteGrupo(grupoId, status) {
    await api.patch("/notificacoes/lote", { grupoId, status });
    recarregar();
  }

  const totalAlertas = grupos?.reduce((s, g) => s + g.alertas.total, 0) ?? 0;
  const gruposComAlerta = grupos?.filter((g) => g.alertas.total > 0).length ?? 0;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-gray-500 text-sm mt-1">Hoje em {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        <StatCard icon={Users2}       label="Grupos ativos"     value={stats?.gruposAtivos}         cor="green" />
        <StatCard icon={Bell}         label="Notificações hoje" value={stats?.notificacoesHoje}      cor="blue" />
        <StatCard icon={AlertCircle}  label="Grupos c/ alerta"  value={gruposComAlerta}              cor="yellow" />
        <StatCard icon={CheckCircle2} label="Pendentes"         value={totalAlertas}                 cor="red" />
      </div>

      {/* Barra de busca + filtro */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar grupo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input pl-9"
          />
        </div>
        <button
          onClick={() => setMostrarTodos((v) => !v)}
          className={`btn-secondary whitespace-nowrap ${mostrarTodos ? "bg-gray-100" : ""}`}
        >
          <Wifi className="w-4 h-4" />
          {mostrarTodos ? "Só com alertas" : "Todos os grupos"}
        </button>
      </div>

      {/* Lista de grupos */}
      {carregando ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !gruposFiltrados.length ? (
        <div className="card p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">
            {busca ? "Nenhum grupo encontrado" : "Nenhum grupo com alerta pendente"}
          </p>
          {!busca && !mostrarTodos && (
            <button onClick={() => setMostrarTodos(true)} className="text-sm text-green-600 hover:underline mt-2">
              Ver todos os grupos monitorados
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {gruposFiltrados.map((g) => (
            <GrupoCard
              key={g.grupoId}
              grupo={g}
              onStatusNotif={atualizarStatusNotif}
              onSnooze={snoozeGrupo}
              onLote={loteGrupo}
            />
          ))}
          <p className="text-center text-xs text-gray-400 pt-1">
            {gruposFiltrados.length} grupo{gruposFiltrados.length !== 1 ? "s" : ""}
            {!mostrarTodos && " com alerta"}
          </p>
        </div>
      )}
    </div>
  );
}
