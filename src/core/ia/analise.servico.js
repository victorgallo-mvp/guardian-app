/**
 * Serviço de análise profunda: usa um modelo mais robusto (Sonnet) para
 * examinar uma mensagem (e seu contexto) e decidir se ela representa um
 * dos gatilhos do catálogo, com explicação e recomendação de ação.
 *
 * É a segunda camada do pipeline de IA — roda apenas para mensagens que a
 * triagem marcou como `precisaAtencao: true`.
 */
import clienteClaude from "./cliente-claude.js";
import { montarPromptAnalise } from "./construtor-prompt.js";
import { calcularCustoUsd } from "./controle-custo.servico.js";
import { validarResultadoAnalise } from "../gatilhos/classificador.js";
import config from "../../config/index.js";
import logger from "../../infra/logger.js";
import { comRetry } from "../../shared/utils.js";
import { ErroIntegracaoExterna } from "../../shared/erros.js";

const MAX_TOKENS_RESPOSTA = 1024;

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
 * Executa a análise profunda de uma mensagem.
 *
 * @param {object} mensagem - documento da mensagem (Mongoose)
 * @param {object} contexto - janela de contexto recente do grupo
 * @param {object} grupo - documento do grupo (Mongoose)
 * @returns {Promise<{valido: boolean, resultado?: object, motivo?: string, custoUsd: number, modeloUsado: string}>}
 */
export async function executarAnalise({ mensagem, contexto, grupo }) {
  const prompt = await montarPromptAnalise({ mensagem, contexto, grupo });
  const modeloUsado = config.anthropic.modeloAnalise;

  const resposta = await comRetry(
    () =>
      clienteClaude.messages.create({
        model: modeloUsado,
        max_tokens: MAX_TOKENS_RESPOSTA,
        messages: [{ role: "user", content: prompt }]
      }),
    {
      tentativas: 3,
      delayBaseMs: 1000,
      aoFalhar: (erro, tentativa) => {
        logger.warn("Falha na chamada de análise profunda à Anthropic, tentando novamente", {
          tentativa,
          erro: erro.message
        });
      }
    }
  ).catch((erro) => {
    throw new ErroIntegracaoExterna("Anthropic (análise)", "Falha ao executar análise profunda", erro);
  });

  const textoResposta = resposta.content?.[0]?.text ?? "";
  const custoUsd = calcularCustoUsd(
    modeloUsado,
    resposta.usage?.input_tokens ?? 0,
    resposta.usage?.output_tokens ?? 0
  );

  let jsonBruto;
  try {
    jsonBruto = extrairJson(textoResposta);
  } catch (erro) {
    logger.error("Resposta de análise profunda não pôde ser interpretada como JSON", {
      erro: erro.message,
      resposta: textoResposta
    });
    return { valido: false, motivo: "Resposta da IA não pôde ser interpretada como JSON", custoUsd, modeloUsado };
  }

  const { valido, resultado, motivo } = validarResultadoAnalise(jsonBruto, grupo.tipo);
  if (!valido) {
    logger.warn("Resultado da análise profunda não passou na validação", { motivo, jsonBruto });
    return { valido: false, motivo, custoUsd, modeloUsado };
  }

  return { valido: true, resultado, custoUsd, modeloUsado };
}
