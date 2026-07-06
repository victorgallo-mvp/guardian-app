import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { obterGatilhosAplicaveis } from "../gatilhos/catalogo.gatilhos.js";
import { truncar, formatarHora } from "../../shared/utils.js";
import config from "../../config/index.js";
import Funcionario from "../../dominio/funcionario.modelo.js";
import logger from "../../infra/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_PROMPTS = path.join(__dirname, "../../../prompts");
const TAMANHO_MAX_TEXTO_MENSAGEM = 500;
const CACHE_TTL_MS = 5 * 60 * 1000;

const cacheTemplates = new Map();

// Cache dos JIDs da equipe para classificação rápida nos prompts
let jidsEquipeCache = { data: new Set(), expiraEm: 0, clientId: null };

function carregarTemplate(nomeArquivo) {
  if (!cacheTemplates.has(nomeArquivo)) {
    const caminho = path.join(DIR_PROMPTS, nomeArquivo);
    cacheTemplates.set(nomeArquivo, readFileSync(caminho, "utf-8"));
  }
  return cacheTemplates.get(nomeArquivo);
}

function preencherTemplate(template, valores) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, chave) => valores[chave] ?? "");
}

export function invalidarCacheEquipe() {
  jidsEquipeCache = { data: new Set(), expiraEm: 0, clientId: null };
}

async function resolverJidsEquipe(clientId) {
  const agora = Date.now();
  if (jidsEquipeCache.clientId === clientId && agora < jidsEquipeCache.expiraEm) {
    return jidsEquipeCache.data;
  }
  const funcionarios = await Funcionario.find({ clientId, ativo: true }).select("whatsappJid").lean();
  jidsEquipeCache = {
    data: new Set(funcionarios.map((f) => f.whatsappJid).filter(Boolean)),
    expiraEm: agora + CACHE_TTL_MS,
    clientId
  };
  return jidsEquipeCache.data;
}

/**
 * Evolution API envia números BR sem o dígito 9 obrigatório (12 dígitos).
 * O sistema armazena com ele (13 dígitos). Gera ambas as variantes para o $or.
 */
function variantesNumero(numero) {
  if (!numero) return [];
  const nums = new Set([numero]);
  if (numero.startsWith("55")) {
    const ddd = numero.slice(2, 4);
    const local = numero.slice(4);
    if (local.length === 8) nums.add(`55${ddd}9${local}`);       // 12→13: adiciona 9
    if (local.length === 9 && local[0] === "9") nums.add(`55${ddd}${local.slice(1)}`); // 13→12: remove 9
  }
  return [...nums];
}

/**
 * Determina se o remetente de uma mensagem é da agência, cruzando por JID @lid
 * ou por número de telefone (extraído de participantAlt). Auto-descobre o @lid
 * quando encontra match por número mas JID ainda não estava salvo.
 */
export async function determinarIsAgencia(remetenteJid, remetenteNumero, clientId) {
  const $or = [];
  if (remetenteJid) $or.push({ whatsappJid: remetenteJid });
  if (remetenteNumero) $or.push({ whatsappNumero: { $in: variantesNumero(remetenteNumero) } });
  if (!$or.length) return false;

  const funcionario = await Funcionario.findOne({ clientId, ativo: true, $or }).lean();
  if (!funcionario) return false;

  // Auto-descoberta: encontrou por número mas ainda não tinha @lid salvo
  if (remetenteJid && !funcionario.whatsappJid) {
    await Funcionario.updateOne({ _id: funcionario._id }, { $set: { whatsappJid: remetenteJid } });
    invalidarCacheEquipe();
    logger.info("Auto-descoberta: @lid salvo para funcionário", { nome: funcionario.nome, jid: remetenteJid });
  }

  return true;
}

/** Resolve papel da mensagem: usa campo isAgencia se disponível, cai no JID como fallback. */
function papelMensagem(m, jidsAgencia) {
  const ehAgencia = m.isAgencia != null ? m.isAgencia : jidsAgencia.has(m.remetenteJid);
  return ehAgencia ? "agência" : "cliente";
}

function formatarMensagensAnteriores(mensagensAnteriores = [], jidsAgencia = new Set()) {
  if (!mensagensAnteriores.length) return "(sem mensagens anteriores no contexto)";
  return mensagensAnteriores
    .map((m) => {
      const remetente = m.remetenteNome || m.remetenteJid;
      const papel = papelMensagem(m, jidsAgencia);
      const texto = truncar(m.conteudo, TAMANHO_MAX_TEXTO_MENSAGEM);
      return `[${formatarHora(m.recebidaEm)}] ${remetente} (${papel}): ${texto}`;
    })
    .join("\n");
}

function formatarParticipantes(temEquipe) {
  if (!temEquipe) return "(não configurado — trate todos os participantes como potencialmente clientes)";
  return `Mensagens marcadas como "(agência)" são da equipe interna. Mensagens marcadas como "(cliente)" são dos clientes. Gatilhos como fora_do_escopo e inatividade_preocupante só se aplicam quando um CLIENTE ficou sem resposta da agência.`;
}

async function obterJidsAgencia(grupo) {
  const clientId = grupo.clientId ?? config.clientId;
  const equipe = await resolverJidsEquipe(clientId);
  const porGrupo = new Set(grupo.membrosAgencia ?? []);
  return new Set([...equipe, ...porGrupo]);
}

export async function montarPromptTriagem({ mensagem, contexto, grupo }) {
  const template = carregarTemplate("triagem-rapida.md");
  const jidsAgencia = await obterJidsAgencia(grupo);

  return preencherTemplate(template, {
    tipoGrupo: grupo.tipo,
    nomeGrupo: grupo.nomeGrupo,
    contextoAdicional: grupo.configuracoesEspecificas?.contextoAdicional || "(nenhum)",
    participantes: formatarParticipantes(jidsAgencia.size > 0),
    mensagensAnteriores: formatarMensagensAnteriores(contexto?.mensagensAnteriores, jidsAgencia),
    remetente: mensagem.remetenteNome || mensagem.remetenteJid,
    papel: papelMensagem(mensagem, jidsAgencia),
    mensagemAtual: truncar(mensagem.conteudo, TAMANHO_MAX_TEXTO_MENSAGEM)
  });
}

export async function montarPromptAnalise({ mensagem, contexto, grupo }) {
  const template = carregarTemplate("analise-profunda.md");
  const jidsAgencia = await obterJidsAgencia(grupo);

  const gatilhosAplicaveis = obterGatilhosAplicaveis(grupo.tipo)
    .map((g) => `- "${g.id}" (severidade padrão: ${g.severidadePadrao}): ${g.nome} — ${g.descricao}`)
    .join("\n");

  return preencherTemplate(template, {
    tipoGrupo: grupo.tipo,
    nomeGrupo: grupo.nomeGrupo,
    contextoAdicional: grupo.configuracoesEspecificas?.contextoAdicional || "(nenhum)",
    participantes: formatarParticipantes(jidsAgencia.size > 0),
    gatilhosAplicaveis,
    mensagensAnteriores: formatarMensagensAnteriores(contexto?.mensagensAnteriores, jidsAgencia),
    remetente: mensagem.remetenteNome || mensagem.remetenteJid,
    papel: papelMensagem(mensagem, jidsAgencia),
    mensagemAtual: truncar(mensagem.conteudo, TAMANHO_MAX_TEXTO_MENSAGEM),
    guiaConstrucaoNotificacao: carregarTemplate("construcao-notificacao.md")
  });
}
