import { useState } from "react";
import { CheckCircle2, Eye, XCircle, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/client.js";

const STATUS_CONFIG = {
  enviada: { label: "Pendente", cor: "bg-yellow-100 text-yellow-700" },
  ciente: { label: "Ciente", cor: "bg-blue-100 text-blue-700" },
  resolvida: { label: "Resolvido", cor: "bg-green-100 text-green-700" },
  ignorada: { label: "Ignorado", cor: "bg-gray-100 text-gray-500" }
};

const SEVERIDADE_CONFIG = {
  critico: "bg-red-100 text-red-700",
  urgente: "bg-orange-100 text-orange-700",
  atencao: "bg-yellow-100 text-yellow-700",
  info: "bg-gray-100 text-gray-500"
};

function formatarData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
}

function CardNotificacao({ n, onStatusChange }) {
  const [expandida, setExpandida] = useState(false);
  const status = STATUS_CONFIG[n.status] ?? STATUS_CONFIG.enviada;
  const severidade = n.analiseId?.detectado?.severidade ?? "info";

  return (
    <div className="card overflow-hidden">
      {/* Cabeçalho sempre visível */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`badge ${status.cor}`}>{status.label}</span>
              <span className={`badge ${SEVERIDADE_CONFIG[severidade]}`}>{severidade}</span>
              <span className="text-xs text-gray-400">{n.grupoId?.nomeGrupo ?? "Grupo desconhecido"}</span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{formatarData(n.enviadaEm)}</span>
            </div>

            {/* Mensagem — truncada ou completa */}
            <p className={`text-sm text-gray-700 whitespace-pre-wrap ${expandida ? "" : "line-clamp-2"}`}>
              {n.conteudoMensagem}
            </p>

            {n.responsavelId?.nome && (
              <p className="text-xs text-gray-400 mt-1.5">Para: {n.responsavelId.nome}</p>
            )}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {n.status === "enviada" && (
              <>
                <button
                  onClick={() => onStatusChange(n._id, "ciente")}
                  title="Marcar como ciente"
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onStatusChange(n._id, "resolvida")}
                  title="Marcar como resolvida"
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
              </>
            )}
            {n.status === "ciente" && (
              <button
                onClick={() => onStatusChange(n._id, "resolvida")}
                title="Marcar como resolvida"
                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setExpandida((v) => !v)}
              title={expandida ? "Recolher" : "Ver mensagem completa"}
              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {expandida ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Notificacoes() {
  const [filtroStatus, setFiltroStatus] = useState("");
  const [pagina, setPagina] = useState(1);

  const qs = new URLSearchParams({ pagina, limite: 30 });
  if (filtroStatus) qs.set("status", filtroStatus);

  const { dados, carregando, recarregar } = useApi(`/notificacoes?${qs}`, [filtroStatus, pagina]);

  async function atualizarStatus(id, novoStatus) {
    await api.patch(`/notificacoes/${id}/status`, { status: novoStatus });
    recarregar();
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
          <p className="text-gray-500 text-sm mt-1">{dados?.total ?? 0} no total</p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filtroStatus}
            onChange={(e) => { setFiltroStatus(e.target.value); setPagina(1); }}
            className="input w-auto"
          >
            <option value="">Todos os status</option>
            <option value="enviada">Pendente</option>
            <option value="ciente">Ciente</option>
            <option value="resolvida">Resolvido</option>
            <option value="ignorada">Ignorado</option>
          </select>
        </div>
      </div>

      {carregando ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : !dados?.dados?.length ? (
        <div className="card p-12 text-center text-gray-400">Nenhuma notificação encontrada</div>
      ) : (
        <div className="space-y-3">
          {dados.dados.map((n) => (
            <CardNotificacao key={n._id} n={n} onStatusChange={atualizarStatus} />
          ))}
        </div>
      )}

      {dados?.total > 30 && (
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1} className="btn-secondary">
            Anterior
          </button>
          <span className="flex items-center text-sm text-gray-600">
            Página {pagina} de {Math.ceil((dados?.total ?? 0) / 30)}
          </span>
          <button
            onClick={() => setPagina((p) => p + 1)}
            disabled={pagina >= Math.ceil((dados?.total ?? 0) / 30)}
            className="btn-secondary"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
