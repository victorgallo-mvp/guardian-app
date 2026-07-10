import { useState, useEffect } from "react";
import { Plus, Trash2, Save, ThumbsUp, ThumbsDown, Brain, MessageSquare, History } from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/client.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatarData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
}

const GATILHO_LABEL = {
  cliente_irritado:        "Cliente irritado",
  urgencia_explicita:      "Urgência",
  risco_cancelamento:      "Risco churn",
  fora_do_escopo:          "Sem resposta",
  inatividade_preocupante: "Inatividade",
  pedido_humano:           "Pedido humano",
};

// ─── aba: frases de encerramento ─────────────────────────────────────────────

function AbaFrases({ treinamento, onRecarregar }) {
  const [novaFrase, setNovaFrase] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const frases = treinamento?.frasesEncerraConversa ?? [];
  const limites = treinamento?.limites ?? { maxFrases: 50, maxFraseChars: 150 };

  async function adicionarFrase() {
    if (!novaFrase.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await api.post("/treinamento/frases", { texto: novaFrase.trim() });
      setNovaFrase("");
      onRecarregar();
    } catch (e) {
      setErro(e.message ?? "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function removerFrase(id) {
    await api.delete(`/treinamento/frases/${id}`);
    onRecarregar();
  }

  async function adicionarSugestao(texto) {
    setNovaFrase(texto.slice(0, limites.maxFraseChars));
  }

  return (
    <div className="space-y-6">
      {/* Adicionar frase */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 text-sm mb-3">Adicionar frase de encerramento</h3>
        <p className="text-xs text-gray-500 mb-3">
          Frases que indicam que o cliente encerrou o assunto e não exigem resposta. O sistema usa match parcial — "perfeito, qualquer coisa chamo" detecta mensagens que contenham essa expressão.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={novaFrase}
            onChange={(e) => setNovaFrase(e.target.value.slice(0, limites.maxFraseChars))}
            onKeyDown={(e) => e.key === "Enter" && adicionarFrase()}
            placeholder='Ex: "perfeito, qualquer coisa chamo"'
            className="input flex-1"
          />
          <button
            onClick={adicionarFrase}
            disabled={salvando || !novaFrase.trim()}
            className="btn-primary whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
        {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
        <p className="text-xs text-gray-400 mt-2">{frases.length}/{limites.maxFrases} frases · {novaFrase.length}/{limites.maxFraseChars} chars</p>
      </div>

      {/* Lista de frases */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Frases cadastradas ({frases.length})</h3>
        </div>
        {frases.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nenhuma frase cadastrada ainda</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {frases.map((f) => (
              <li key={f._id} className="flex items-center justify-between px-5 py-3 gap-3">
                <span className="text-sm text-gray-700 flex-1">"{f.texto}"</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatarData(f.criadoEm)}</span>
                <button
                  onClick={() => removerFrase(f._id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  title="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sugestões de feedbacks negativos */}
      <SugestoesFeedback onUsar={adicionarSugestao} />
    </div>
  );
}

function SugestoesFeedback({ onUsar }) {
  const { dados } = useApi("/treinamento/sugestoes");
  const sugestoes = dados ?? [];

  if (sugestoes.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">Sugestões de feedbacks negativos</h3>
        <p className="text-xs text-gray-500 mt-1">Mensagens que geraram 👎 — pode valer adicionar como frase de encerramento</p>
      </div>
      <ul className="divide-y divide-gray-50">
        {sugestoes.slice(0, 10).map((s) => (
          <li key={s._id} className="px-5 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">"{s.mensagemConteudo}"</p>
              <div className="flex items-center gap-2 mt-0.5">
                {s.motivo && <span className="text-xs text-gray-400">{s.motivo}</span>}
                <span className="text-xs text-gray-300">{s.grupoId?.nomeGrupo}</span>
              </div>
            </div>
            <button
              onClick={() => onUsar(s.mensagemConteudo ?? "")}
              className="btn-secondary text-xs py-1 px-2 flex-shrink-0"
            >
              Usar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── aba: contexto personalizado ─────────────────────────────────────────────

function AbaContexto({ treinamento, onRecarregar }) {
  const limites = treinamento?.limites ?? { maxContextoChars: 800 };
  const [contexto, setContexto] = useState(treinamento?.contextoPersonalizado ?? "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    setContexto(treinamento?.contextoPersonalizado ?? "");
  }, [treinamento?.contextoPersonalizado]);

  async function salvar() {
    setSalvando(true);
    await api.put("/treinamento/contexto", { contexto });
    onRecarregar();
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 text-sm mb-1">Contexto personalizado</h3>
        <p className="text-xs text-gray-500 mb-4">
          Texto injetado em toda análise de IA para este cliente. Use para descrever o perfil de comunicação, o que é normal para eles e o que realmente preocupa. Seja objetivo — o modelo lê este texto em cada análise.
        </p>
        <textarea
          value={contexto}
          onChange={(e) => setContexto(e.target.value.slice(0, limites.maxContextoChars))}
          rows={8}
          placeholder={`Exemplos:\n- "Este cliente tem tom direto. Reclamações pontuais são normais e não indicam cancelamento."\n- "Qualquer menção a preço ou concorrente é sinal de risco real."\n- "O dono é impaciente mas fiel — urgência explícita dele precisa de retorno em 1h."`}
          className="input w-full resize-none font-mono text-xs leading-relaxed"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{contexto.length}/{limites.maxContextoChars} chars</span>
          <button onClick={salvar} disabled={salvando} className="btn-primary">
            <Save className="w-4 h-4" />
            {salvo ? "Salvo!" : salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── aba: histórico de feedback ───────────────────────────────────────────────

function AbaFeedback() {
  const [filtroTipo, setFiltroTipo] = useState("");
  const [pagina, setPagina] = useState(1);

  const qs = new URLSearchParams({ pagina, limite: 20 });
  if (filtroTipo) qs.set("tipo", filtroTipo);

  const { dados, carregando } = useApi(`/feedback?${qs}`, [filtroTipo, pagina]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={filtroTipo}
          onChange={(e) => { setFiltroTipo(e.target.value); setPagina(1); }}
          className="input w-auto"
        >
          <option value="">Todos</option>
          <option value="positivo">👍 Positivos</option>
          <option value="negativo">👎 Negativos</option>
        </select>
        <span className="text-sm text-gray-500">{dados?.total ?? 0} registros</span>
      </div>

      {carregando ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !dados?.dados?.length ? (
        <div className="card p-10 text-center text-gray-400 text-sm">Nenhum feedback registrado ainda</div>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {dados.dados.map((f) => (
              <li key={f._id} className="px-5 py-3 flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{f.tipo === "positivo" ? "👍" : "👎"}</span>
                <div className="flex-1 min-w-0">
                  {f.mensagemConteudo && (
                    <p className="text-sm text-gray-700 truncate">"{f.mensagemConteudo}"</p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {f.gatilho && (
                      <span className="badge bg-gray-100 text-gray-500 text-xs">{GATILHO_LABEL[f.gatilho] ?? f.gatilho}</span>
                    )}
                    <span className="text-xs text-gray-400">{f.grupoId?.nomeGrupo}</span>
                    {f.motivo && <span className="text-xs text-gray-500 italic">· {f.motivo}</span>}
                  </div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatarData(f.criadoEm)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(dados?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-3">
          <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1} className="btn-secondary">Anterior</button>
          <span className="flex items-center text-sm text-gray-600">Pág. {pagina} / {Math.ceil((dados?.total ?? 0) / 20)}</span>
          <button onClick={() => setPagina((p) => p + 1)} disabled={pagina >= Math.ceil((dados?.total ?? 0) / 20)} className="btn-secondary">Próxima</button>
        </div>
      )}
    </div>
  );
}

// ─── página principal ─────────────────────────────────────────────────────────

const ABAS = [
  { id: "frases",   label: "Frases de encerramento", icone: MessageSquare },
  { id: "contexto", label: "Contexto do cliente",    icone: Brain },
  { id: "feedback", label: "Histórico de feedback",  icone: History },
];

export default function Treinamento() {
  const [abaAtiva, setAbaAtiva] = useState("frases");
  const { dados: treinamento, recarregar } = useApi("/treinamento");

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Treinamento</h1>
        <p className="text-gray-500 text-sm mt-1">Personalize a IA com regras e contexto específico do seu cliente</p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
        {ABAS.map(({ id, label, icone: Icon }) => (
          <button
            key={id}
            onClick={() => setAbaAtiva(id)}
            className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              abaAtiva === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      {abaAtiva === "frases"   && <AbaFrases   treinamento={treinamento} onRecarregar={recarregar} />}
      {abaAtiva === "contexto" && <AbaContexto  treinamento={treinamento} onRecarregar={recarregar} />}
      {abaAtiva === "feedback" && <AbaFeedback />}
    </div>
  );
}
