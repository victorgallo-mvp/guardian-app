/**
 * Funções utilitárias compartilhadas por múltiplos módulos.
 */

/**
 * Pausa a execução por um número de milissegundos.
 * Usado em estratégias de retry com backoff exponencial.
 */
export function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa uma função assíncrona com retry e backoff exponencial.
 *
 * @param {() => Promise<any>} fn - função a executar
 * @param {object} opcoes
 * @param {number} opcoes.tentativas - número máximo de tentativas (padrão 3)
 * @param {number} opcoes.delayBaseMs - delay inicial em ms (padrão 500)
 * @param {(erro: Error, tentativa: number) => void} opcoes.aoFalhar - callback chamado a cada falha
 */
export async function comRetry(fn, opcoes = {}) {
  const { tentativas = 3, delayBaseMs = 500, aoFalhar } = opcoes;

  let ultimoErro;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      return await fn();
    } catch (erro) {
      ultimoErro = erro;
      if (aoFalhar) aoFalhar(erro, tentativa);
      if (tentativa < tentativas) {
        const delay = delayBaseMs * 2 ** (tentativa - 1);
        await aguardar(delay);
      }
    }
  }
  throw ultimoErro;
}

/**
 * Trunca um texto para um número máximo de caracteres, adicionando "..." se cortado.
 * Usado para evitar prompts gigantes e mensagens de notificação muito longas.
 */
export function truncar(texto, tamanhoMaximo) {
  if (!texto) return "";
  if (texto.length <= tamanhoMaximo) return texto;
  return `${texto.slice(0, tamanhoMaximo)}...`;
}

/**
 * Formata um timestamp Date pro formato HH:mm, no timezone local do processo.
 */
export function formatarHora(data) {
  return new Date(data).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Verifica se o horário atual (HH:mm) está dentro de uma janela [inicio, fim).
 * Suporta janelas que cruzam a meia-noite (ex: 22:00 às 08:00).
 */
export function dentroDaJanelaHoraria(horaAtual, inicio, fim) {
  if (inicio === fim) return true;
  if (inicio < fim) {
    return horaAtual >= inicio && horaAtual < fim;
  }
  // Janela cruza meia-noite (ex: 22:00 - 08:00)
  return horaAtual >= inicio || horaAtual < fim;
}
