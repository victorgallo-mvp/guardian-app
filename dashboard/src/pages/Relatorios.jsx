import { useState } from "react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/client.js";
import {
  BarChart2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  CheckCircle,
  MinusCircle
} from "lucide-react";

const CATEGORIA_CONFIG = {
  alerta_aberto: {
    label: "Alertas em aberto",
    icon: AlertCircle,
    corIcone: "text-red-500",
    corTitulo: "text-red-700",
    bg: "bg-red-50 border-red-200"
  },
  com_pendencia: {
    label: "Com pendências resolvidas",
    icon: Clock,
    corIcone: "text-yellow-500",
    corTitulo: "text-yellow-700",
    bg: "bg-yellow-50 border-yellow-200"
  },
  sem_pendencia: {
    label: "Sem pendências",
    icon: CheckCircle,
    corIcone: "text-green-500",
    corTitulo: "text-green-700",
    bg: "bg-green-50 border-green-200"
  },
  sem_atividade: {
    label: "Sem atividade",
    icon: MinusCircle,
    corIcone: "text-gray-400",
    corTitulo: "text-gray-500",
    bg: "bg-gray-50 border-gray-200"
  }
};

function formatarData(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function BadgeResumo({ grupos }) {
  const alertas = grupos.filter((g) => g.categoria === "alerta_aberto").length;
  const pendentes = grupos.filter((g) => g.categoria === "com_pendencia").length;

  if (alertas > 0) {
    return (
      <span className="text-xs text-red-600 font-medium">
        {alertas} alerta(s) em aberto
      </span>
    );
  }
  if (pendentes > 0) {
    return (
      <span className="text-xs text-yellow-600 font-medium">
        {pendentes} grupo(s) com pendências
      </span>
    );
  }
  return (
    <span className="text-xs text-green-600 font-medium">Semana tranquila</span>
  );
}

function SecaoCategoria({ categoria, lista }) {
  if (!lista.length) return null;
  const cfg = CATEGORIA_CONFIG[categoria];
  const Icon = cfg.icon;

  return (
    <div className="mb-5">
      <div className={`flex items-center gap-2 px-3 py-2 mb-3 border rounded-lg ${cfg.bg}`}>
        <Icon className={`w-4 h-4 ${cfg.corIcone}`} />
        <span className={`text-sm font-semibold ${cfg.corTitulo}`}>
          {cfg.label} ({lista.length})
        </span>
      </div>
      <div className="space-y-3 pl-2">
        {lista.map((g) => (
          <div key={String(g.grupoId)} className="border-l-2 border-gray-200 pl-3">
            <p className="text-sm font-medium text-gray-800">{g.nomeGrupo}</p>
            {categoria !== "sem_atividade" && (
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{g.resumo}</p>
            )}
            {categoria !== "sem_atividade" && (
              <p className="text-xs text-gray-400 mt-1">
                {g.totalMensagens} mensagem(s) · {g.totalAlertas} alerta(s) gerado(s)
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CardRelatorio({ relatorio }) {
  const [aberto, setAberto] = useState(false);

  const porCategoria = {
    alerta_aberto: relatorio.grupos.filter((g) => g.categoria === "alerta_aberto"),
    com_pendencia: relatorio.grupos.filter((g) => g.categoria === "com_pendencia"),
    sem_pendencia: relatorio.grupos.filter((g) => g.categoria === "sem_pendencia"),
    sem_atividade: relatorio.grupos.filter((g) => g.categoria === "sem_atividade")
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setAberto((a) => !a)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div>
          <p className="font-semibold text-gray-900 text-sm">
            {formatarData(relatorio.semanaInicio)} — {formatarData(relatorio.semanaFim)}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400">{relatorio.grupos.length} grupos</span>
            <span className="text-gray-300">·</span>
            <BadgeResumo grupos={relatorio.grupos} />
          </div>
        </div>
        {aberto ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {aberto && (
        <div className="border-t border-gray-100 px-5 pt-5 pb-3">
          {["alerta_aberto", "com_pendencia", "sem_pendencia", "sem_atividade"].map((cat) => (
            <SecaoCategoria
              key={cat}
              categoria={cat}
              lista={porCategoria[cat]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Relatorios() {
  const { dados: relatorios, carregando, recarregar } = useApi("/relatorios");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);

  async function gerarAgora() {
    setGerando(true);
    setErro(null);
    try {
      await api.post("/relatorios/gerar");
      await recarregar();
    } catch (e) {
      setErro(e.message || "Falha ao gerar relatório");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-5 h-5 text-gray-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Relatório Semanal</h1>
            <p className="text-xs text-gray-500">Gerado automaticamente toda terça às 19h BRT</p>
          </div>
        </div>
        <button
          onClick={gerarAgora}
          disabled={gerando}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${gerando ? "animate-spin" : ""}`} />
          {gerando ? "Gerando..." : "Gerar agora"}
        </button>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {erro}
        </div>
      )}

      {carregando && (
        <div className="text-center py-16 text-gray-400 text-sm">Carregando relatórios...</div>
      )}

      {!carregando && relatorios?.length === 0 && (
        <div className="text-center py-16">
          <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Nenhum relatório gerado ainda</p>
          <p className="text-gray-400 text-xs mt-1">
            Use "Gerar agora" para criar o primeiro relatório desta semana.
          </p>
        </div>
      )}

      {!carregando && relatorios?.length > 0 && (
        <div className="space-y-3">
          {relatorios.map((r) => (
            <CardRelatorio key={r._id} relatorio={r} />
          ))}
        </div>
      )}
    </div>
  );
}
