import { useState, useMemo } from "react";
import {
  Users2, Bell, AlertCircle, CheckCircle2,
  Eye, XCircle, Search, TrendingDown,
  Flame, Zap, Clock
} from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/client.js";

// ─── constantes ──────────────────────────────────────────────────────────────

const COLUNAS = [
  {
    id: "churn",
    titulo: "Risco de Churn",
    icone: TrendingDown,
    gatilhos: ["risco_cancelamento"],
    cor: {
      header:  "bg-red-50 border-red-200",
      icone:   "bg-red-100 text-red-600",
      badge:   "bg-red-100 text-red-700",
      borda:   "border-l-red-400",
      vazio:   "text-red-300"
    }
  },
  {
    id: "irritado",
    titulo: "Cliente Irritado",
    icone: Flame,
    gatilhos: ["cliente_irritado"],
    cor: {
      header:  "bg-orange-50 border-orange-200",
      icone:   "bg-orange-100 text-orange-600",
      badge:   "bg-orange-100 text-orange-700",
      borda:   "border-l-orange-400",
      vazio:   "text-orange-300"
    }
  },
  {
    id: "urgencia",
    titulo: "Urgência Real",
    icone: Zap,
    gatilhos: ["urgencia_explicita"],
    cor: {
      header:  "bg-yellow-50 border-yellow-200",
      icone:   "bg-yellow-100 text-yellow-600",
      badge:   "bg-yellow-100 text-yellow-700",
      borda:   "border-l-yellow-400",
      vazio:   "text-yellow-300"
    }
  },
  {
    id: "sem-retorno",
    titulo: "Sem Retorno",
    icone: Clock,
    gatilhos: ["fora_do_escopo", "inatividade_preocupante"],
    cor: {
      header:  "bg-gray-50 border-gray-200",
      icone:   "bg-gray-100 text-gray-500",
      badge:   "bg-gray-100 text-gray-600",
      borda:   "border-l-gray-300",
      vazio:   "text-gray-300"
    }
  }
];

const TIPO_COR = {
  atendimento: "bg-blue-100 text-blue-700",
  interno:     "bg-purple-100 text-purple-700",
  vendas:      "bg-green-100 text-green-700",
  fornecedor:  "bg-orange-100 text-orange-700",
  outro:       "bg-gray-100 text-gray-600"
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function tempo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
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

function AlertCard({ n, onStatus, corBorda }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${corBorda} shadow-sm p-4 flex flex-col gap-2`}>
      {/* Grupo */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-gray-900 text-sm truncate flex-1 min-w-0">
          {n.grupoId?.nomeGrupo ?? "Grupo desconhecido"}
        </span>
        <span className={`badge text-xs flex-shrink-0 ${TIPO_COR[n.grupoId?.tipo] ?? TIPO_COR.outro}`}>
          {n.grupoId?.tipo ?? "—"}
        </span>
      </div>

      {/* Mensagem */}
      <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
        {n.conteudoMensagem}
      </p>

      {/* Rodapé */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-gray-400">{tempo(n.enviadaEm)}</span>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onStatus(n._id, "ciente")}
            title="Ciente"
            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onStatus(n._id, "resolvida")}
            title="Resolvida"
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onStatus(n._id, "ignorada")}
            title="Ignorar"
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ColunaKanban({ coluna, alertas, onStatus }) {
  const { icone: Icone, titulo, cor } = coluna;
  const vazia = alertas.length === 0;

  return (
    <div className="flex flex-col min-h-0">
      {/* Header da coluna */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border mb-3 ${cor.header}`}>
        <div className={`rounded-lg p-1.5 ${cor.icone}`}>
          <Icone className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold text-gray-800 text-sm flex-1">{titulo}</span>
        {alertas.length > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cor.badge}`}>
            {alertas.length}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5 flex-1">
        {vazia ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <CheckCircle2 className={`w-8 h-8 ${cor.vazio}`} />
            <p className="text-xs text-gray-400 text-center">Nenhum alerta</p>
          </div>
        ) : (
          alertas.map((n) => (
            <AlertCard key={n._id} n={n} onStatus={onStatus} corBorda={cor.borda} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const [busca, setBusca] = useState("");

  const { dados: stats } = useApi("/dashboard/stats");
  const { dados: notifData, carregando, recarregar } = useApi(
    "/notificacoes?status=enviada&limite=200"
  );

  const alertas = notifData?.dados ?? [];

  const alertasFiltrados = useMemo(() => {
    if (!busca.trim()) return alertas;
    const q = busca.toLowerCase();
    return alertas.filter((n) =>
      (n.grupoId?.nomeGrupo ?? "").toLowerCase().includes(q)
    );
  }, [alertas, busca]);

  const alertasPorColuna = useMemo(() => {
    const mapa = {};
    for (const col of COLUNAS) {
      mapa[col.id] = alertasFiltrados.filter((n) => col.gatilhos.includes(n.gatilho));
    }
    return mapa;
  }, [alertasFiltrados]);

  async function atualizarStatus(id, status) {
    await api.patch(`/notificacoes/${id}/status`, { status });
    recarregar();
  }

  const totalPendentes = alertas.length;
  const gruposComAlerta = new Set(alertas.map((n) => n.grupoId?._id)).size;

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-gray-500 text-sm mt-1">
          Hoje em {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatCard icon={Users2}       label="Grupos ativos"     value={stats?.gruposAtivos}    cor="green" />
        <StatCard icon={Bell}         label="Alertas hoje"      value={stats?.notificacoesHoje} cor="blue" />
        <StatCard icon={AlertCircle}  label="Grupos c/ alerta"  value={gruposComAlerta}         cor="yellow" />
        <StatCard icon={CheckCircle2} label="Pendentes"         value={totalPendentes}          cor="red" />
      </div>

      {/* Busca */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Filtrar por grupo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="input pl-9 w-full max-w-sm"
        />
      </div>

      {/* Kanban */}
      {carregando ? (
        <div className="grid grid-cols-4 gap-4 flex-1">
          {COLUNAS.map((c) => (
            <div key={c.id} className="space-y-2.5">
              <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
              {[1, 2].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 items-start">
          {COLUNAS.map((col) => (
            <ColunaKanban
              key={col.id}
              coluna={col}
              alertas={alertasPorColuna[col.id] ?? []}
              onStatus={atualizarStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
