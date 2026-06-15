/**
 * Cliente HTTP de baixo nível pra Evolution API.
 *
 * Encapsula autenticação (header apikey), base URL e retry com backoff
 * exponencial pra falhas transitórias de rede. Módulos de mais alto nível
 * (ex: core/canais/evolution.adapter.js) usam este cliente em vez de
 * chamar axios diretamente.
 */
import axios from "axios";
import config from "../config/index.js";
import logger from "./logger.js";
import { ErroIntegracaoExterna } from "../shared/erros.js";
import { comRetry } from "../shared/utils.js";

/**
 * Cria uma instância axios configurada pra uma instância da Evolution API.
 *
 * @param {object} opcoes
 * @param {string} opcoes.apiUrl - URL base da instância Evolution
 * @param {string} opcoes.apiKey - chave de API da instância
 */
export function criarClienteEvolution({ apiUrl, apiKey } = {}) {
  const baseURL = apiUrl || config.evolution.apiUrl;
  const chave = apiKey || config.evolution.apiKey;

  const http = axios.create({
    baseURL,
    timeout: 15_000,
    headers: {
      apikey: chave,
      "Content-Type": "application/json"
    }
  });

  /**
   * Executa uma requisição HTTP contra a Evolution API com retry/backoff
   * pra erros de rede ou 5xx. Erros 4xx não são re-tentados (são erros de
   * payload/configuração, retry não ajuda).
   */
  async function requisitar(metodo, caminho, dados = undefined) {
    return comRetry(
      async () => {
        try {
          const resposta = await http.request({ method: metodo, url: caminho, data: dados });
          return resposta.data;
        } catch (erro) {
          const status = erro.response?.status;
          if (status && status < 500) {
            // Erro do cliente (4xx): não vale a pena re-tentar
            throw new ErroIntegracaoExterna(
              "evolution-api",
              `Requisição ${metodo} ${caminho} falhou com status ${status}: ${JSON.stringify(erro.response?.data)}`,
              erro
            );
          }
          throw erro;
        }
      },
      {
        tentativas: 3,
        delayBaseMs: 500,
        aoFalhar: (erroTentativa, tentativa) => {
          logger.warn("Falha ao chamar Evolution API, tentando novamente", {
            metodo,
            caminho,
            tentativa,
            erro: erroTentativa.message
          });
        }
      }
    ).catch((erro) => {
      if (erro instanceof ErroIntegracaoExterna) throw erro;
      throw new ErroIntegracaoExterna(
        "evolution-api",
        `Requisição ${metodo} ${caminho} falhou após retries: ${erro.message}`,
        erro
      );
    });
  }

  return {
    get: (caminho) => requisitar("get", caminho),
    post: (caminho, dados) => requisitar("post", caminho, dados),
    put: (caminho, dados) => requisitar("put", caminho, dados),
    delete: (caminho) => requisitar("delete", caminho)
  };
}

/** Instância padrão, configurada com as variáveis de ambiente do processo. */
export const clienteEvolutionPadrao = criarClienteEvolution();
