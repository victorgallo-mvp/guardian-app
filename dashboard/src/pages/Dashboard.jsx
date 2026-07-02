import { useState } from "react";
import { Users2, Bell, AlertCircle, CheckCircle2, TrendingUp, ChevronDown, ChevronUp, Eye, XCircle } from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/client.js";

const LABELS_GATILHO = {
  cliente_irritado: "Cliente irritado",
  urgencia_explicita: "Urgência",
  pedido_humano: "Pedido humano",
  risco_cancelamento: "Risco churn",
  oportunidade_quente: "Oportunidade",
  problema_operacional: "Prob. operacional",
  fora_do_escopo: "Sem resposta",
  inatividade_preocupante: "Inatividade",
  risco_legal: "Risco legal"
};

const SEVERIDADE_CONFIG = {
  critico: { cor: "bg-red-100 text-red-700", borda: "border-l-red-500" },
  urgente: { cor: "bg-orange-100 text-orange-700", borda: "border-l-orange-400" },
  atencao: { cor: "bg-yellow-100 text-yellow-700", borda: "border-l-yellow-400" },
  info: { cor: "bg-gray-100 text-gray-500", borda: "border-l-gray-300" }
};

function formatarData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
}

function StatCard({ icon: Icon, label, value, cor }) {
  const cores = {
    green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red: "bg-red-50 text-red-600"
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

function CardPendente({ n, onStatusChange }) {
  const [expandida, setExpandida] = useState(false);
  const severidade = n.analiseId?.detectado?.severidade ?? "info";
  const cfg = SEVERIDADE_CONFIG[severidade] ?? SEVERIDADE_CONFIG.info;

  return (
    <div className={`border-l-4 ${cfg.borda} bg-white rounded-r-xl shadow-sm p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`badge ${cfg.cor}`}>{severidade}</span>
            <span className="text-sm font-medium text-gray-800 truncate">
              {n.grupoId?.nomeGrupo ?? "—"}
            </span>
            <span className="text-xs text-gray-400">{formatarData(n.enviadaEm)}</span>
          </div>
          <p className={`text-sm text-gray-600 whitespace-pre-wrap ${expandida ? "" : "line-clamp-2"}`}>
            {n.conteudoMensagem}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onStatusChange(n._id, "ciente")}
            title="Ciente"
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onStatusChange(n._id, "resolvida")}
            title="Resolvida"
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onStatusChange(n._id, "ignorada")}
            title="Ignorar"
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExpandida((v) => !v)}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {expandida ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { dados: stats, carregando: carregandoStats } = useApi("/dashboard/stats");
  const { dados: pendentes, carregando: carregandoPendentes, recarregar } = useApi(
    "/notificacoes?status=enviada&limite=10&pagina=1"
  );

  async function atualizarStatus(id, novoStatus) {
    await api.patch(`/notificacoes/${id}/status`, { status: novoStatus });
    recarregar();
  }

  const listaPendentes = pendentes?.dados ?? [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-gray-500 text-sm mt-1">Resumo do dia de hoje</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        {carregandoStats ? (
          [1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)
        ) : (
          <>
            <StatCard icon={Users2} label="Grupos ativos" value={stats?.gruposAtivos} cor="green" />
            <StatCard icon={Bell} label="Notificações hoje" value={stats?.notificacoesHoje} cor="blue" />
            <StatCard icon={AlertCircle} label="Pendentes" value={stats?.notificacoesPendentes} cor="yellow" />
            <StatCard
              icon={CheckCircle2}
              label="Resolvidas hoje"
              value={(stats?.notificacoesHoje ?? 0) - (stats?.notificacoesPendentes ?? 0)}
              cor="green"
            />
          </>
        )}
      </div>

      {/* Notificações pendentes — ação imediata */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            Pendentes — aguardando ação
            {listaPendentes.length > 0 && (
              <span className="badge bg-yellow-100 text-yellow-700">{pendentes?.total ?? 0}</span>
            )}
          </h2>
        </div>

        {carregandoPendentes ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}
          </div>
        ) : !listaPendentes.length ? (
          <div className="card p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Nenhuma notificação pendente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {listaPendentes.map((n) => (
              <CardPendente key={n._id} n={n} onStatusChange={atualizarStatus} />
            ))}
            {(pendentes?.total ?? 0) > 10 && (
              <p className="text-center text-sm text-gray-400 pt-1">
                +{(pendentes?.total ?? 0) - 10} pendentes — veja todas em{" "}
                <a href="/notificacoes?status=enviada" className="text-green-600 hover:underline">Notificações</a>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom: top grupos + por gatilho */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Top grupos hoje
          </h2>
          {stats?.topGrupos?.length ? (
            <ul className="space-y-3">
              {stats.topGrupos.map((g) => (
                <li key={g.grupoId} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate pr-4">{g.nomeGrupo}</span>
                  <span className="badge bg-green-100 text-green-700">{g.total}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">Nenhuma notificação hoje</p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Por gatilho hoje</h2>
          {stats?.porGatilho?.length ? (
            <ul className="space-y-3">
              {stats.porGatilho.map((g) => (
                <li key={g.gatilho} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    {LABELS_GATILHO[g.gatilho] ?? g.gatilho}
                  </span>
                  <span className="badge bg-blue-100 text-blue-700">{g.total}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">Nenhuma notificação hoje</p>
          )}
        </div>
      </div>
    </div>
  );
}
