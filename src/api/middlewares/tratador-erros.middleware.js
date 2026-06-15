/**
 * Tratador de erros centralizado do Express.
 *
 * Erros customizados (ver shared/erros.js) trazem `statusHttp` e são
 * respondidos com o status apropriado; qualquer outro erro é tratado
 * como 500 e logado com stack trace pra investigação.
 */
import logger from "../../infra/logger.js";

// eslint-disable-next-line no-unused-vars
export function tratadorErros(erro, req, res, next) {
  const status = erro.statusHttp ?? 500;

  if (status >= 500) {
    logger.error("Erro não tratado na requisição", { erro: erro.message, stack: erro.stack });
  } else {
    logger.warn(erro.message, { nome: erro.name });
  }

  res.status(status).json({ erro: erro.message });
}
