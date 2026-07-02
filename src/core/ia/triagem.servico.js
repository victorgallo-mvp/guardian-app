/**
 * Serviço de triagem rápida: usa um modelo barato (Haiku) para decidir,
 * mensagem a mensagem, se vale a pena gastar com análise profunda (Sonnet).
 *
 * É a primeira camada do pipeline de IA — roda para toda mensagem válida
 * que passa pelos filtros, então precisa ser rápida e barata.
 */
import { z } from "zod";
import clienteClaude from "./cliente-claude.js";
import { montarPromptTriagem } from "./construtor-prompt.js";
import { calcularCustoUsd } from "./controle-custo.servico.js";
import config from "../../config/index.js";
import logger from "../../infra/logger.js";
import { comRetry } from "../../shared/utils.js";
import { ErroIntegracaoExterna } from "../../shared/erros.js";

const MAX_TOKENS_RESPOSTA = 256;

const esquemaResultadoTriagem = z.object({
  precisaAtencao: z.boolean(),
  confiancaScore: z.number().min(0).max(1),
  motivoBreve: z.string().default("")
});

/** Extrai o primeiro objeto JSON de um texto, tolerando blocos de código markdown. */
function extrairJson(texto) {
  const semMarkdown = texto.replace(/```json|```/g, "").trim();
  const inicio = semMarkdown.indexOf("{");
  const fim = semMarkdown.lastIndexOf("}");

  if (inicio === -1 || fim === -1) {
    throw new Error("Resposta da IA não contém um objeto JSON");
  }

  return JSON.parse(semMarkdown.slice(inicio, fim + 1));
}

/**
 * Executa a triagem rápida de uma mensagem.
 *
 * Em caso de resposta malformada/inesperada da IA, retorna
 * `precisaAtencao: true` por padrão (conservador) — melhor gastar com uma
 * análise profunda desnecessária do que deixar algo importante passar.
 *
 * @param {object} mensagem - documento da mensagem (Mongoose)
 * @param {object} contexto - janela de contexto recente do grupo
 * @param {object} grupo - documento do grupo (Mongoose)
 * @returns {Promise<{precisaAtencao: boolean, confiancaScore: number, motivoBreve: string, custoUsd: number}>}
 */
export async function executarTriagem({ mensagem, contexto, grupo }) {
  const prompt = await montarPromptTriagem({ mensagem, contexto, grupo });

  const resposta = await comRetry(
    () =>
      clienteClaude.messages.create({
        model: config.anthropic.modeloTriagem,
        max_tokens: MAX_TOKENS_RESPOSTA,
        messages: [{ role: "user", content: prompt }]
      }),
    {
      tentativas: 3,
      delayBaseMs: 500,
      aoFalhar: (erro, tentativa) => {
        logger.warn("Falha na chamada de triagem à Anthropic, tentando novamente", {
          tentativa,
          erro: erro.message
        });
      }
    }
  ).catch((erro) => {
    throw new ErroIntegracaoExterna("Anthropic (triagem)", "Falha ao executar triagem", erro);
  });

  const textoResposta = resposta.content?.[0]?.text ?? "";
  const custoUsd = calcularCustoUsd(
    config.anthropic.modeloTriagem,
    resposta.usage?.input_tokens ?? 0,
    resposta.usage?.output_tokens ?? 0
  );

  let jsonBruto;
  try {
    jsonBruto = extrairJson(textoResposta);
  } catch (erro) {
    logger.error("Resposta de triagem não pôde ser interpretada como JSON", {
      erro: erro.message,
      resposta: textoResposta
    });
    return {
      precisaAtencao: true,
      confiancaScore: 0,
      motivoBreve: "Erro ao interpretar resposta da triagem",
      custoUsd
    };
  }

  const parse = esquemaResultadoTriagem.safeParse(jsonBruto);
  if (!parse.success) {
    logger.error("Resultado da triagem fora do formato esperado", {
      erro: parse.error.message,
      jsonBruto
    });
    return {
      precisaAtencao: true,
      confiancaScore: 0,
      motivoBreve: "Resultado da triagem fora do formato esperado",
      custoUsd
    };
  }

  return { ...parse.data, custoUsd };
}
