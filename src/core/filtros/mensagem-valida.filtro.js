/**
 * Filtro de validade de mensagem: decide se uma mensagem recebida via
 * webhook vale a pena ser processada pelo pipeline.
 *
 * Descarta: mensagens enviadas pelo próprio bot, mensagens de membros
 * configurados pra serem ignorados (ex: outros bots no grupo), mídia
 * sem texto/legenda e mensagens vazias.
 */

const TIPOS_COM_TEXTO_EXTRAIVEL = new Set(["texto", "imagem", "documento"]);
const TIPOS_COM_TRANSCRICAO = new Set(["audio"]);

/**
 * Extrai o texto relevante de um payload de mensagem da Evolution API,
 * cobrindo os formatos mais comuns (conversation, extendedTextMessage,
 * legendas de mídia).
 */
export function extrairTextoMensagem(mensagemPayload) {
  const msg = mensagemPayload?.message ?? {};

  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    msg.documentMessage?.caption ??
    msg.videoMessage?.caption ??
    ""
  ).trim();
}

/**
 * Determina o tipo lógico da mensagem (texto, imagem, audio, documento, sticker, outro)
 * a partir das chaves presentes no payload da Evolution API.
 */
export function determinarTipoMensagem(mensagemPayload) {
  const msg = mensagemPayload?.message ?? {};

  if (msg.conversation || msg.extendedTextMessage) return "texto";
  if (msg.imageMessage) return "imagem";
  if (msg.audioMessage) return "audio";
  if (msg.documentMessage) return "documento";
  if (msg.stickerMessage) return "sticker";
  return "outro";
}

/**
 * Verifica se uma mensagem deve ser processada pelo pipeline.
 *
 * @param {object} mensagemPayload - payload `data` do evento `messages.upsert`
 * @param {object} grupo - documento do grupo monitorado
 * @returns {{ valida: boolean, motivo?: string, texto?: string, tipo?: string }}
 */
export function mensagemEhValida(mensagemPayload, grupo) {
  if (!mensagemPayload?.key) {
    return { valida: false, motivo: "Payload sem chave de mensagem" };
  }

  if (mensagemPayload.key.fromMe) {
    return { valida: false, motivo: "Mensagem enviada pelo próprio bot" };
  }

  const remetente = mensagemPayload.key.participant ?? mensagemPayload.key.remoteJid;
  const membrosIgnorados = grupo?.configuracoesEspecificas?.ignorarMembros ?? [];
  if (membrosIgnorados.includes(remetente)) {
    return { valida: false, motivo: "Remetente está na lista de membros ignorados do grupo" };
  }

  const tipo = determinarTipoMensagem(mensagemPayload);

  if (TIPOS_COM_TRANSCRICAO.has(tipo)) {
    // Texto será preenchido pelo serviço de transcrição no pipeline
    return { valida: true, texto: null, tipo };
  }

  if (!TIPOS_COM_TEXTO_EXTRAIVEL.has(tipo)) {
    return { valida: false, motivo: `Tipo de mensagem "${tipo}" não possui texto analisável` };
  }

  const texto = extrairTextoMensagem(mensagemPayload);
  if (!texto) {
    return { valida: false, motivo: "Mensagem sem conteúdo textual" };
  }

  return { valida: true, texto, tipo };
}
