/**
 * Janela rolante de contexto: busca as últimas mensagens de um grupo pra
 * dar contexto de conversa às chamadas de IA (triagem e análise profunda).
 *
 * O tamanho da janela é configurável por cliente
 * (`Cliente.configuracoes.janelaContextoMensagens`), com fallback pro padrão.
 */
import Mensagem from "../../dominio/mensagem.modelo.js";
import Cliente from "../../dominio/cliente.modelo.js";

const TAMANHO_JANELA_PADRAO = 30;
const HORAS_CONTEXTO_MAXIMO = 6;

/** Retorna o tamanho de janela de contexto configurado pro cliente, ou o padrão. */
async function obterTamanhoJanela(clientId) {
  const cliente = await Cliente.findOne({ identificador: clientId }).lean();
  return cliente?.configuracoes?.janelaContextoMensagens ?? TAMANHO_JANELA_PADRAO;
}

/**
 * Busca as mensagens mais recentes de um grupo, anteriores a uma referência
 * (se fornecida), ordenadas da mais antiga pra mais nova — formato esperado
 * pelos prompts de IA (`construtor-prompt.js`).
 *
 * @param {string} clientId
 * @param {import("mongoose").Types.ObjectId|string} grupoId
 * @param {object} [opcoes]
 * @param {Date} [opcoes.antesDe] - considera apenas mensagens recebidas antes desta data
 * @param {string|import("mongoose").Types.ObjectId} [opcoes.excluirMensagemId] - id da mensagem atual, pra não entrar no seu próprio contexto
 * @returns {Promise<{mensagensAnteriores: object[], totalContexto: number}>}
 */
export async function obterContextoRecente(clientId, grupoId, opcoes = {}) {
  const { antesDe, excluirMensagemId } = opcoes;
  const tamanhoJanela = await obterTamanhoJanela(clientId);

  const limiteTemporalContexto = new Date(Date.now() - HORAS_CONTEXTO_MAXIMO * 60 * 60 * 1000);
  const filtro = { grupoId, recebidaEm: { $gte: limiteTemporalContexto } };
  if (excluirMensagemId) filtro._id = { $ne: excluirMensagemId };
  if (antesDe) filtro.recebidaEm.$lt = antesDe;

  const mensagens = await Mensagem.find(filtro)
    .sort({ recebidaEm: -1 })
    .limit(tamanhoJanela)
    .select("remetenteJid remetenteNome conteudo recebidaEm tipoMensagem")
    .lean();

  const mensagensAnteriores = mensagens.reverse();

  return { mensagensAnteriores, totalContexto: mensagensAnteriores.length };
}
