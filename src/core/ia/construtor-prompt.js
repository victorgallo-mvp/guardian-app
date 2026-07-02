import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { obterGatilhosAplicaveis } from "../gatilhos/catalogo.gatilhos.js";
import { truncar, formatarHora } from "../../shared/utils.js";
import config from "../../config/index.js";
import Funcionario from "../../dominio/funcionario.modelo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_PROMPTS = path.join(__dirname, "../../../prompts");

const TAMANHO_MAX_TEXTO_MENSAGEM = 500;

const cacheTemplates = new Map();

// Cache dos JIDs da equipe para não consultar o BD a cada mensagem
let jidsEquipeCache = { data: new Set(), expiraEm: 0, clientId: null };
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Carrega (com cache em memória) um template de `/prompts`. */
function carregarTemplate(nomeArquivo) {
  if (!cacheTemplates.has(nomeArquivo)) {
    const caminho = path.join(DIR_PROMPTS, nomeArquivo);
    cacheTemplates.set(nomeArquivo, readFileSync(caminho, "utf-8"));
  }
  return cacheTemplates.get(nomeArquivo);
}

/** Substitui placeholders `{{chave}}` pelos valores fornecidos. */
function preencherTemplate(template, valores) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, chave) => valores[chave] ?? "");
}

/** Invalida o cache de JIDs da equipe (chamado quando um Funcionário é criado/editado). */
export function invalidarCacheEquipe() {
  jidsEquipeCache = { data: new Set(), expiraEm: 0, clientId: null };
}

/** Retorna o Set de JIDs da equipe + override do grupo (para uso externo ao pipeline). */
export async function resolverJidsAgencia(clientId, membrosAgenciaGrupo = []) {
  const equipe = await resolverJidsEquipe(clientId);
  return new Set([...equipe, ...membrosAgenciaGrupo]);
}

/** Resolve os JIDs da equipe da agência via BD (com cache em memória). */
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

/** Constrói o Set de JIDs da equipe da agência (BD + override do grupo). */
async function obterJidsAgencia(grupo) {
  const clientId = grupo.clientId ?? config.clientId;
  const equipe = await resolverJidsEquipe(clientId);
  const porGrupo = new Set(grupo.membrosAgencia ?? []);
  return new Set([...equipe, ...porGrupo]);
}

/** Formata as mensagens anteriores do contexto como uma lista legível pra IA, anotando agência vs cliente. */
function formatarMensagensAnteriores(mensagensAnteriores = [], jidsAgencia = new Set()) {
  if (!mensagensAnteriores.length) return "(sem mensagens anteriores no contexto)";

  return mensagensAnteriores
    .map((m) => {
      const remetente = m.remetenteNome || m.remetenteJid;
      const papel = jidsAgencia.has(m.remetenteJid) ? "agência" : "cliente";
      const texto = truncar(m.conteudo, TAMANHO_MAX_TEXTO_MENSAGEM);
      return `[${formatarHora(m.recebidaEm)}] ${remetente} (${papel}): ${texto}`;
    })
    .join("\n");
}

/** Monta o bloco de participantes para os prompts. */
function formatarParticipantes(jidsAgencia) {
  if (!jidsAgencia.size) return "(não configurado — trate todos os participantes como potencialmente clientes)";
  return `Mensagens marcadas como "(agência)" são da equipe interna. Mensagens marcadas como "(cliente)" são dos clientes. Gatilhos como fora_do_escopo e inatividade_preocupante só se aplicam quando um CLIENTE ficou sem resposta da agência.`;
}

/** Monta o prompt de triagem rápida (Haiku) para uma mensagem. */
export async function montarPromptTriagem({ mensagem, contexto, grupo }) {
  const template = carregarTemplate("triagem-rapida.md");
  const jidsAgencia = await obterJidsAgencia(grupo);

  return preencherTemplate(template, {
    tipoGrupo: grupo.tipo,
    nomeGrupo: grupo.nomeGrupo,
    contextoAdicional: grupo.configuracoesEspecificas?.contextoAdicional || "(nenhum)",
    participantes: formatarParticipantes(jidsAgencia),
    mensagensAnteriores: formatarMensagensAnteriores(contexto?.mensagensAnteriores, jidsAgencia),
    remetente: mensagem.remetenteNome || mensagem.remetenteJid,
    papel: jidsAgencia.has(mensagem.remetenteJid) ? "agência" : "cliente",
    mensagemAtual: truncar(mensagem.conteudo, TAMANHO_MAX_TEXTO_MENSAGEM)
  });
}

/** Monta o prompt de análise profunda (Sonnet) para uma mensagem. */
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
    participantes: formatarParticipantes(jidsAgencia),
    gatilhosAplicaveis,
    mensagensAnteriores: formatarMensagensAnteriores(contexto?.mensagensAnteriores, jidsAgencia),
    remetente: mensagem.remetenteNome || mensagem.remetenteJid,
    papel: jidsAgencia.has(mensagem.remetenteJid) ? "agência" : "cliente",
    mensagemAtual: truncar(mensagem.conteudo, TAMANHO_MAX_TEXTO_MENSAGEM),
    guiaConstrucaoNotificacao: carregarTemplate("construcao-notificacao.md")
  });
}
