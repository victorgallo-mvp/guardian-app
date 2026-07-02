import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { useApi } from "../hooks/useApi.js";
import { api } from "../api/client.js";

const TIPOS = ["atendimento", "interno", "vendas", "fornecedor", "outro"];
const TIPO_LABELS = {
  atendimento: "Atendimento",
  interno: "Interno",
  vendas: "Vendas",
  fornecedor: "Fornecedor",
  outro: "Outro"
};
const SENSIBILIDADE_LABELS = {
  alto: "Alto — notifica a partir de atenção",
  medio: "Médio — notifica a partir de urgente",
  baixo: "Baixo — apenas crítico"
};

export default function GrupoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dados: grupo, carregando, recarregar } = useApi(`/grupos/${id}`);

  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function salvarGatilho(gatilhoId, ativo) {
    const desativados = new Set(grupo.gatilhosDesativados ?? []);
    if (ativo) desativados.delete(gatilhoId);
    else desativados.add(gatilhoId);
    await api.put(`/grupos/${id}`, { gatilhosDesativados: [...desativados] });
    recarregar();
  }

  async function salvarConfig(e) {
    e.preventDefault();
    setSalvando(true);
    setMensagem("");
    const fd = new FormData(e.target);
    const atualizacao = {
      nomeGrupo: fd.get("nomeGrupo"),
      tipo: fd.get("tipo"),
      descricao: fd.get("descricao"),
      configuracoesEspecificas: {
        nivelSensibilidade: fd.get("nivelSensibilidade") || null,
        contextoAdicional: fd.get("contextoAdicional") || ""
      }
    };
    try {
      await api.put(`/grupos/${id}`, atualizacao);
      setMensagem("Salvo com sucesso!");
      recarregar();
    } catch (err) {
      setMensagem(`Erro: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-32" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!grupo) {
    return <div className="p-8 text-gray-500">Grupo não encontrado</div>;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button
        onClick={() => navigate("/grupos")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para grupos
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{grupo.nomeGrupo}</h1>
      <p className="text-xs text-gray-400 mb-8">{grupo.idWhatsappGrupo}</p>

      {mensagem && (
        <div className={`rounded-lg px-4 py-3 text-sm mb-6 ${
          mensagem.startsWith("Erro")
            ? "bg-red-50 text-red-600 border border-red-200"
            : "bg-green-50 text-green-600 border border-green-200"
        }`}>
          {mensagem}
        </div>
      )}

      {/* Configurações gerais */}
      <form onSubmit={salvarConfig} className="card p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-5">Configurações</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                name="nomeGrupo"
                defaultValue={grupo.nomeGrupo}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select name="tipo" defaultValue={grupo.tipo} className="input">
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sensibilidade (padrão do cliente se vazio)
            </label>
            <select
              name="nivelSensibilidade"
              defaultValue={grupo.configuracoesEspecificas?.nivelSensibilidade ?? ""}
              className="input"
            >
              <option value="">Padrão do cliente</option>
              {Object.entries(SENSIBILIDADE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do grupo</label>
            <input
              name="descricao"
              defaultValue={grupo.descricao}
              className="input"
              placeholder="Ex: Grupo de suporte da empresa X"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contexto adicional para a IA</label>
            <textarea
              name="contextoAdicional"
              defaultValue={grupo.configuracoesEspecificas?.contextoAdicional ?? ""}
              className="input resize-none"
              rows={3}
              placeholder="Ex: Cliente premium, contrato de 12 meses, responsável comercial é Ana"
            />
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <button type="submit" disabled={salvando} className="btn-primary">
            <Save className="w-4 h-4" />
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>

      {/* Gatilhos */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Gatilhos</h2>
        <p className="text-sm text-gray-500 mb-5">
          Ative ou desative gatilhos específicos para este grupo.
        </p>

        {grupo.gatilhosAplicaveis?.length ? (
          <ul className="space-y-3">
            {grupo.gatilhosAplicaveis.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-800">{g.nome}</span>
                  <p className="text-xs text-gray-400 mt-0.5">{g.descricao}</p>
                </div>
                <button
                  onClick={() => salvarGatilho(g.id, !g.ativo)}
                  className={`p-1 transition-colors ${
                    g.ativo ? "text-green-600 hover:text-green-700" : "text-gray-300 hover:text-gray-400"
                  }`}
                  title={g.ativo ? "Desativar" : "Ativar"}
                >
                  {g.ativo ? (
                    <ToggleRight className="w-6 h-6" />
                  ) : (
                    <ToggleLeft className="w-6 h-6" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">Nenhum gatilho aplicável a este tipo de grupo</p>
        )}
      </div>
    </div>
  );
}
