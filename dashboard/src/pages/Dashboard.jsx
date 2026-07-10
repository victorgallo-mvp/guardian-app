import { useState, useMemo, useEffect } from "react";
import {
  Users2, Bell, AlertCircle, CheckCircle2,
  Eye, XCircle, Search, TrendingDown,
  Flame, Zap, Clock, ThumbsUp, ThumbsDown, X, ChevronRight
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
      header: "bg-red-50 border-red-200",
      icone:  "bg-red-100 text-red-600",
      badge:  "bg-red-100 text-red-700",
      borda:  "border-l-red-400",
      vazio:  "text-red-300"
    }
  },
  {
    id: "irritado",
    titulo: "Cliente Irritado",
    icone: Flame,
    gatilhos: ["cliente_irritado"],
    cor: {
      header: "bg-orange-50 border-orange-200",
      icone:  "bg-orange-100 text-orange-600",
      badge:  "bg-orange-100 text-orange-700",
      borda:  "border-l-orange-400",
      vazio:  "text-orange-300"
    }
  },
  {
    id: "urgencia",
    titulo: "Urgência Real",
    icone: Zap,
    gatilhos: ["urgencia_explicita"],
    cor: {
      header: "bg-yellow-50 border-yellow-200",
      icone:  "bg-yellow-100 text-yellow-600",
      badge:  "bg-yellow-100 text-yellow-700",
      borda:  "border-l-yellow-400",
      vazio:  "text-yellow-300"
    }
  },
  {
    id: "sem-retorno",
    titulo: "Sem Retorno",
    icone: Clock,
    gatilhos: ["fora_do_escopo", "inatividade_preocupante"],
    cor: {
      header: "bg-gray-50 border-gray-200",
      icone:  "bg-gray-100 text-gray-500",
      badge:  "bg-gray-100 text-gray-600",
      borda:  "border-l-gray-300",
      vazio:  "text-gray-300"
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

const GATILHO_LABEL = {
  cliente_irritado:        "Cliente irritado",
  urgencia_explicita:      "Urgência",
  risco_cancelamento:      "Risco churn",
  fora_do_escopo:          "Sem resposta",
  inatividade_preocupante: "Inatividade",
  pedido_humano:           "Pedido humano",
};

function corBordaPorGatilho(gatilho) {
  for (const col of COLUNAS) {
    if (col.gatilhos.includes(gatilho)) return col.cor.borda;
  }
  return "border-l-gray-300";
}

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

function formatarDataHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
}

// ─── modal (renderizado no nível do Dashboard) ────────────────────────────────

function ModalNotificacao({ n, onClose, onStatus, onFeedback }) {
  const [feedbackDado, setFeedbackDado] = useState(null);
  const [mostrarMotivo, setMostrarMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviandoFeedback, setEnviandoFeedback] = useState(false);

  const corBorda = corBordaPorGatilho(n.gatilho);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // bloqueia scroll do body enquanto modal está aberto
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleFeedback(tipo, motivoTexto = "") {
    setEnviandoFeedback(true);
    await onFeedback(n._id, tipo, motivoTexto);
    setFeedbackDado(tipo);
    setMostrarMotivo(false);
    setMotivo("");
    setEnviandoFeedback(false);
  }

  async function handleStatus(status) {
    await onStatus(n._id, status);
    onClose();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999 }}
      className="flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />

      {/* Painel */}
      <div
        style={{ position: "relative", maxHeight: "85vh" }}
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-lg border-l-4 ${corBorda} flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-base leading-snug">
              {n.grupoId?.nomeGrupo ?? "Grupo desconhecido"}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`badge text-xs ${TIPO_COR[n.grupoId?.tipo] ?? TIPO_COR.outro}`}>
                {n.grupoId?.tipo ?? "—"}
              </span>
              {n.gatilho && (
                <span className="badge text-xs bg-gray-100 text-gray-600">
                  {GATILHO_LABEL[n.gatilho] ?? n.gatilho}
                </span>
              )}
              <span className="text-xs text-gray-400">{formatarDataHora(n.enviadaEm)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mensagem completa */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {n.conteudoMensagem ?? "—"}
          </p>

          {n.notificadosNomes?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Responsáveis notificados</p>
              <div className="flex flex-wrap gap-1.5">
                {n.notificadosNomes.map((nome, i) => (
                  <span key={i} className="badge text-xs bg-blue-50 text-blue-700">{nome}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feedback + ações */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-3">
          {mostrarMotivo ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500">Por que este alerta foi incorreto? (opcional)</p>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Ex: cliente sempre fecha assim, não é urgente..."
                className="input text-xs resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleFeedback("negativo", motivo)}
                  disabled={enviandoFeedback}
                  className="btn-primary text-xs py-1.5 px-3"
                >
                  Enviar feedback
                </button>
                <button onClick={() => setMostrarMotivo(false)} className="btn-secondary text-xs py-1.5 px-3">
                  Cancelar
                </button>
              </div>
            </div>
          ) : feedbackDado ? (
            <p className="text-xs text-gray-400 text-center py-1">
              {feedbackDado === "positivo" ? "👍 Feedback registrado" : "👎 Feedback registrado"}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 flex-shrink-0">Alerta correto?</span>
              <button
                onClick={() => handleFeedback("positivo")}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Sim
              </button>
              <button
                onClick={() => { setMostrarMotivo(true); setMotivo(""); }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <ThumbsDown className="w-3.5 h-3.5" /> Não
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => handleStatus("ciente")}
              className="flex-1 flex items-center justify-center gap-1.5 btn-secondary text-sm py-2"
            >
              <Eye className="w-4 h-4" /> Ciente
            </button>
            <button
              onClick={() => handleStatus("resolvida")}
              className="flex-1 flex items-center justify-center gap-1.5 btn-primary text-sm py-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Resolvida
            </button>
            <button
              onClick={() => handleStatus("ignorada")}
              title="Ignorar"
              className="flex items-center gap-1.5 btn-secondary text-sm py-2 px-3 text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── card do kanban ───────────────────────────────────────────────────────────

function AlertCard({ n, onStatus, onFeedback, corBorda, onExpandir }) {
  const [feedbackDado, setFeedbackDado] = useState(null);
  const [mostrarMotivo, setMostrarMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviandoFeedback, setEnviandoFeedback] = useState(false);

  async function handleFeedback(tipo, motivoTexto = "") {
    setEnviandoFeedback(true);
    await onFeedback(n._id, tipo, motivoTexto);
    setFeedbackDado(tipo);
    setMostrarMotivo(false);
    setMotivo("");
    setEnviandoFeedback(false);
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${corBorda} shadow-sm flex flex-col`}>
      {/* Área clicável: nome + horário */}
      <button
        onClick={() => onExpandir(n)}
        className="flex items-center gap-2 px-4 pt-3 pb-2 text-left group w-full"
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate leading-snug">
            {n.grupoId?.nomeGrupo ?? "Grupo desconhecido"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{tempo(n.enviadaEm)}</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
      </button>

      {/* Input de motivo (👎 inline) */}
      {mostrarMotivo && (
        <div className="px-4 pb-2 flex flex-col gap-1.5 border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-500">Por que este alerta foi incorreto? (opcional)</p>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="Ex: cliente fecha assim, não é urgente..."
            className="input text-xs resize-none"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleFeedback("negativo", motivo)}
              disabled={enviandoFeedback}
              className="btn-primary text-xs py-1 px-3"
            >
              Enviar
            </button>
            <button onClick={() => setMostrarMotivo(false)} className="btn-secondary text-xs py-1 px-3">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Rodapé: ações */}
      <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-gray-50">
        {feedbackDado ? (
          <span className="text-xs text-gray-400 pl-1">
            {feedbackDado === "positivo" ? "👍" : "👎"}
          </span>
        ) : (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => handleFeedback("positivo")}
              title="Alerta correto"
              className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setMostrarMotivo(true); setMotivo(""); }}
              title="Falso alerta"
              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-0.5">
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
        </div>
      </div>
    </div>
  );
}

// ─── coluna kanban ────────────────────────────────────────────────────────────

function ColunaKanban({ coluna, alertas, onStatus, onFeedback, onExpandir }) {
  const { icone: Icone, titulo, cor } = coluna;

  return (
    <div className="flex flex-col min-h-0">
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

      <div className="flex flex-col gap-2.5 flex-1">
        {alertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <CheckCircle2 className={`w-8 h-8 ${cor.vazio}`} />
            <p className="text-xs text-gray-400 text-center">Nenhum alerta</p>
          </div>
        ) : (
          alertas.map((n) => (
            <AlertCard
              key={n._id}
              n={n}
              corBorda={cor.borda}
              onStatus={onStatus}
              onFeedback={onFeedback}
              onExpandir={onExpandir}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

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

// ─── página principal ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const [busca, setBusca] = useState("");
  const [alertaExpandido, setAlertaExpandido] = useState(null);

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

  async function darFeedback(notificacaoId, tipo, motivo) {
    await api.post("/feedback", { notificacaoId, tipo, motivo: motivo || undefined });
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
        <StatCard icon={Users2}       label="Grupos ativos"    value={stats?.gruposAtivos}     cor="green" />
        <StatCard icon={Bell}         label="Alertas hoje"     value={stats?.notificacoesHoje}  cor="blue" />
        <StatCard icon={AlertCircle}  label="Grupos c/ alerta" value={gruposComAlerta}          cor="yellow" />
        <StatCard icon={CheckCircle2} label="Pendentes"        value={totalPendentes}           cor="red" />
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
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
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
              onFeedback={darFeedback}
              onExpandir={setAlertaExpandido}
            />
          ))}
        </div>
      )}

      {/* Modal — fora da árvore do kanban */}
      {alertaExpandido && (
        <ModalNotificacao
          n={alertaExpandido}
          onClose={() => setAlertaExpandido(null)}
          onStatus={atualizarStatus}
          onFeedback={darFeedback}
        />
      )}
    </div>
  );
}
