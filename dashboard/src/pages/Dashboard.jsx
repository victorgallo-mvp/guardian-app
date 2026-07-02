import { Users2, Bell, AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";
import { useApi } from "../hooks/useApi.js";

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

export default function Dashboard() {
  const { dados, carregando } = useApi("/dashboard/stats");

  if (carregando) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-gray-500 text-sm mt-1">Resumo do dia de hoje</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        <StatCard icon={Users2} label="Grupos ativos" value={dados?.gruposAtivos} cor="green" />
        <StatCard icon={Bell} label="Notificações hoje" value={dados?.notificacoesHoje} cor="blue" />
        <StatCard icon={AlertCircle} label="Pendentes" value={dados?.notificacoesPendentes} cor="yellow" />
        <StatCard
          icon={CheckCircle2}
          label="Resolvidas hoje"
          value={(dados?.notificacoesHoje ?? 0) - (dados?.notificacoesPendentes ?? 0)}
          cor="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top grupos */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Top grupos hoje
          </h2>
          {dados?.topGrupos?.length ? (
            <ul className="space-y-3">
              {dados.topGrupos.map((g) => (
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

        {/* Por gatilho */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Por gatilho hoje</h2>
          {dados?.porGatilho?.length ? (
            <ul className="space-y-3">
              {dados.porGatilho.map((g) => (
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
