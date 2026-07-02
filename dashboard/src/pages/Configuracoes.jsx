import { useState, useEffect } from "react";
import { Save, ToggleLeft, ToggleRight, Settings } from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/client.js";

const SENSIBILIDADE_OPCOES = [
  { value: "alto", label: "Alto", desc: "Notifica a partir de atenção (mais sensível)" },
  { value: "medio", label: "Médio", desc: "Notifica a partir de urgente" },
  { value: "baixo", label: "Baixo", desc: "Apenas crítico (menos sensível)" }
];

const GATILHOS_SEMELHANTES = ["fora_do_escopo", "inatividade_preocupante"];

export default function Configuracoes() {
  const { dados, carregando, recarregar } = useApi("/config");
  const [sensibilidade, setSensibilidade] = useState("");
  const [silencioInicio, setSilencioInicio] = useState("");
  const [silencioFim, setSilencioFim] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    if (dados) {
      setSensibilidade(dados.nivelSensibilidadePadrao ?? "medio");
      setSilencioInicio(dados.horarioSilenciosoInicio ?? "22:00");
      setSilencioFim(dados.horarioSilenciosoFim ?? "08:00");
    }
  }, [dados]);

  async function salvarConfig(e) {
    e.preventDefault();
    setSalvando(true);
    setMensagem("");
    try {
      await api.put("/config", {
        nivelSensibilidadePadrao: sensibilidade,
        horarioSilenciosoInicio: silencioInicio,
        horarioSilenciosoFim: silencioFim
      });
      setMensagem("Configurações salvas!");
      recarregar();
    } catch (err) {
      setMensagem(`Erro: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  }

  async function toggleGatilho(gatilhoId, ativoAtual) {
    const desativados = new Set(dados?.gatilhosDesativados ?? []);
    if (ativoAtual) desativados.add(gatilhoId);
    else desativados.delete(gatilhoId);
    await api.put("/config", { gatilhosDesativados: [...desativados] });
    recarregar();
  }

  if (carregando) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-6 h-6 text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500 text-sm mt-0.5">Parâmetros globais — valem para todos os grupos</p>
        </div>
      </div>

      {mensagem && (
        <div className={`rounded-lg px-4 py-3 text-sm mb-6 ${
          mensagem.startsWith("Erro")
            ? "bg-red-50 text-red-600 border border-red-200"
            : "bg-green-50 text-green-600 border border-green-200"
        }`}>
          {mensagem}
        </div>
      )}

      {/* Sensibilidade e horário */}
      <form onSubmit={salvarConfig} className="card p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-5">Geral</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nível de sensibilidade padrão
            </label>
            <div className="grid grid-cols-3 gap-3">
              {SENSIBILIDADE_OPCOES.map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setSensibilidade(op.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-colors ${
                    sensibilidade === op.value
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-medium text-sm text-gray-900">{op.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{op.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Horário silencioso — início
              </label>
              <input
                type="time"
                value={silencioInicio}
                onChange={(e) => setSilencioInicio(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Horário silencioso — fim
              </label>
              <input
                type="time"
                value={silencioFim}
                onChange={(e) => setSilencioFim(e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <button type="submit" disabled={salvando} className="btn-primary">
            <Save className="w-4 h-4" />
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>

      {/* Gatilhos globais */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Gatilhos — configuração global</h2>
        <p className="text-sm text-gray-500 mb-5">
          Gatilhos desativados aqui ficam suprimidos em todos os grupos, independente da configuração por grupo.
        </p>

        {dados?.gatilhos?.length ? (
          <ul className="divide-y divide-gray-100">
            {dados.gatilhos.map((g) => {
              const isSemelhante = GATILHOS_SEMELHANTES.includes(g.id);
              return (
                <li key={g.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{g.nome}</span>
                      {isSemelhante && (
                        <span className="badge bg-purple-100 text-purple-600 text-xs">timer 2h</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{g.descricao}</p>
                    <p className="text-xs text-gray-300 mt-0.5">
                      Aplica em: {g.aplicavelEm.join(", ")} · severidade padrão: {g.severidadePadrao}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleGatilho(g.id, g.ativo)}
                    className={`transition-colors ${
                      g.ativo ? "text-green-600 hover:text-green-700" : "text-gray-300 hover:text-gray-400"
                    }`}
                    title={g.ativo ? "Desativar globalmente" : "Ativar"}
                  >
                    {g.ativo ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">Carregando gatilhos...</p>
        )}

        {/* Aviso sobre os 4 semelhantes */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800 mb-1">Gatilhos com função sobreponente</p>
          <p className="text-xs text-amber-700">
            <strong>Pergunta sem resposta</strong> e <strong>Inatividade após mensagem</strong> cobrem situações
            muito similares (ambos com timer de 2h). O sistema já evita notificações duplicadas entre eles —
            se um disparar, o outro fica bloqueado por 30 min. Se ainda assim receber alertas duplos, considere
            desativar <em>Inatividade após mensagem</em> globalmente e manter apenas <em>Pergunta sem resposta</em>.
          </p>
          <p className="text-xs text-amber-700 mt-2">
            O mesmo vale para <strong>Urgência real</strong> e <strong>Pedido explícito de humano</strong>:
            situações de urgência muitas vezes incluem pedido de atendimento humano. São diferentes mas podem
            co-ocorrer — avalie pelo volume de notificações no dia.
          </p>
        </div>
      </div>
    </div>
  );
}
