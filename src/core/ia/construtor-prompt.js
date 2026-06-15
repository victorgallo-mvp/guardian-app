/**
 * Construtor de prompts pra IA: carrega os templates de `/prompts` e
 * preenche com dados da mensagem, do contexto recente do grupo e do
 * próprio grupo.
 *
 * Templates ficam fora de `src/` propositalmente — permite ajustar o
 * tom/conteúdo dos prompts sem tocar em código.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { obterGatilhosAplicaveis } from "../gatilhos/catalogo.gatilhos.js";
import { truncar, formatarHora } from "../../shared/utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_PROMPTS = path.join(__dirname, "../../../prompts");

const TAMANHO_MAX_TEXTO_MENSAGEM = 500;

const cacheTemplates = new Map();

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

/** Formata as mensagens anteriores do contexto como uma lista legível pra IA. */
function formatarMensagensAnteriores(mensagensAnteriores = []) {
  if (!mensagensAnteriores.length) return "(sem mensagens anteriores no contexto)";

  return mensagensAnteriores
    .map((m) => {
      const remetente = m.remetenteNome || m.remetenteJid;
      const texto = truncar(m.conteudo, TAMANHO_MAX_TEXTO_MENSAGEM);
      return `[${formatarHora(m.recebidaEm)}] ${remetente}: ${texto}`;
    })
    .join("\n");
}

/** Monta o prompt de triagem rápida (Haiku) para uma mensagem. */
export function montarPromptTriagem({ mensagem, contexto, grupo }) {
  const template = carregarTemplate("triagem-rapida.md");

  return preencherTemplate(template, {
    tipoGrupo: grupo.tipo,
    nomeGrupo: grupo.nomeGrupo,
    contextoAdicional: grupo.configuracoesEspecificas?.contextoAdicional || "(nenhum)",
    mensagensAnteriores: formatarMensagensAnteriores(contexto?.mensagensAnteriores),
    remetente: mensagem.remetenteNome || mensagem.remetenteJid,
    mensagemAtual: truncar(mensagem.conteudo, TAMANHO_MAX_TEXTO_MENSAGEM)
  });
}

/** Monta o prompt de análise profunda (Sonnet) para uma mensagem. */
export function montarPromptAnalise({ mensagem, contexto, grupo }) {
  const template = carregarTemplate("analise-profunda.md");

  const gatilhosAplicaveis = obterGatilhosAplicaveis(grupo.tipo)
    .map((g) => `- "${g.id}" (severidade padrão: ${g.severidadePadrao}): ${g.nome} — ${g.descricao}`)
    .join("\n");

  return preencherTemplate(template, {
    tipoGrupo: grupo.tipo,
    nomeGrupo: grupo.nomeGrupo,
    contextoAdicional: grupo.configuracoesEspecificas?.contextoAdicional || "(nenhum)",
    gatilhosAplicaveis,
    mensagensAnteriores: formatarMensagensAnteriores(contexto?.mensagensAnteriores),
    remetente: mensagem.remetenteNome || mensagem.remetenteJid,
    mensagemAtual: truncar(mensagem.conteudo, TAMANHO_MAX_TEXTO_MENSAGEM),
    guiaConstrucaoNotificacao: carregarTemplate("construcao-notificacao.md")
  });
}
