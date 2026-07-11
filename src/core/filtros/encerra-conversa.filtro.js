/**
 * Detecta mensagens de cliente que encerram/reconhecem a conversa e não
 * exigem resposta da agência — evita notificações falsas de inatividade.
 *
 * Usa correspondência exata (após normalização) ou padrões curtos. Limita
 * a mensagens com até MAX_CHARS para não suprimir frases longas que começam
 * com "ok" mas continuam com pedidos.
 */

const MAX_CHARS = 80;

// Padrões tratados como encerramento de conversa (lowercase, sem acento)
const PADROES = [
  // Confirmações pontuais
  /^ok[.!]?$/,
  /^certo[.!]?$/,
  /^entendido[.!]?$/,
  /^combinado[.!]?$/,
  /^confirmado[.!]?$/,
  /^perfeito[.!]?$/,
  /^maravilha[.!]?$/,
  /^otimo[.!]?$/,
  /^excelente[.!]?$/,
  /^show[.!]?$/,
  /^legal[.!]?$/,
  /^boa[.!]?$/,
  /^top[.!]?$/,
  /^sim[.!]?$/,
  /^nao[.!]?$/,
  /^isso[.!]?$/,
  /^isso mesmo[.!]?$/,
  /^claro[.!]?$/,
  /^blz[.!]?$/,
  /^beleza[.!]?$/,
  /^ta[.!]?$/,
  /^ta bom[.!]?$/,
  /^pode ser[.!]?$/,

  // Agradecimentos (aceita "obrigado por tudo", "valeu demais" etc. — curtos)
  /^obrigad[ao]/,
  /^obg[.!]?$/,
  /^vlw[.!]?$/,
  /^valeu/,
  /^grat[ao]/,
  /^muito obrigad/,

  // Despedidas
  /^ate mais/,
  /^ate logo/,
  /^tchau/,
  /^falou[.!]?$/,
  /^abraco[s]?[.!]?$/,

  // Promessas de contato (cliente vai ligar — não exige resposta da agência)
  /^(vou ligar|te ligo|me liga|ligo pra voce|ligo hoje)/,

  // Qualquer mensagem composta só de emojis
  /^[\p{Emoji_Presentation}\s]+$/u,
];

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^\p{L}\p{N}\p{Emoji}\s]/gu, "") // remove pontuação exceto emoji
    .trim();
}

/**
 * Retorna true se a mensagem encerra a conversa e não exige resposta da agência.
 *
 * @param {string} texto
 * @param {string[]} [frasesCustomizadas] - frases específicas do cliente (match parcial, sem limite de tamanho)
 */
export function mensagemEncerraConversa(texto, frasesCustomizadas = []) {
  if (!texto) return false;

  const normalizado = normalizar(texto);
  if (!normalizado) return false;

  // Frases customizadas do cliente — match parcial, sem restrição de tamanho
  if (frasesCustomizadas.length > 0) {
    if (frasesCustomizadas.some((f) => {
      const normF = normalizar(f);
      return normF && normalizado.includes(normF);
    })) return true;
  }

  // Padrões genéricos — só para mensagens curtas
  if (texto.length > MAX_CHARS) return false;
  return PADROES.some((p) => p.test(normalizado));
}
