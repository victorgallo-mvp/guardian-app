/**
 * Classes de erro customizadas usadas em toda a aplicação.
 *
 * Ter tipos de erro específicos facilita tratamento diferenciado
 * (ex: erro de validação vs erro de integração externa) e deixa
 * os logs mais informativos.
 */

/** Erro de validação de dados de entrada (webhook, rotas admin, etc). */
export class ErroValidacao extends Error {
  constructor(mensagem, detalhes = null) {
    super(mensagem);
    this.name = "ErroValidacao";
    this.detalhes = detalhes;
    this.statusHttp = 400;
  }
}

/** Erro de autenticação/autorização (ex: token admin inválido). */
export class ErroNaoAutorizado extends Error {
  constructor(mensagem = "Não autorizado") {
    super(mensagem);
    this.name = "ErroNaoAutorizado";
    this.statusHttp = 401;
  }
}

/** Erro ao chamar uma integração externa (Evolution API, Anthropic, etc). */
export class ErroIntegracaoExterna extends Error {
  constructor(servico, mensagem, causaOriginal = null) {
    super(`[${servico}] ${mensagem}`);
    this.name = "ErroIntegracaoExterna";
    this.servico = servico;
    this.causaOriginal = causaOriginal;
    this.statusHttp = 502;
  }
}

/** Erro de recurso não encontrado (ex: grupo/responsável inexistente). */
export class ErroNaoEncontrado extends Error {
  constructor(recurso, identificador = "") {
    const sufixo = identificador ? ` (${identificador})` : "";
    super(`${recurso} não encontrado${sufixo}`);
    this.name = "ErroNaoEncontrado";
    this.statusHttp = 404;
  }
}

/** Erro de limite excedido (ex: limite de custo diário com IA). */
export class ErroLimiteExcedido extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroLimiteExcedido";
    this.statusHttp = 429;
  }
}
