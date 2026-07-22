/**
 * Transcrição de áudio via Groq Whisper.
 *
 * Fluxo: baixa o áudio em base64 da Evolution API → converte para Buffer →
 * envia ao Groq Whisper → retorna o texto transcrito.
 *
 * Se GROQ_API_KEY não estiver configurada, retorna null e o áudio é descartado.
 */
import { clienteEvolutionPadrao } from "../../infra/evolution-client.js";
import config from "../../config/index.js";
import logger from "../../infra/logger.js";

const GROQ_TRANSCRICAO_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODELO_WHISPER = "whisper-large-v3-turbo";

/**
 * Extrai o MIME type base do audioMessage do payload (ex: "audio/ogg").
 * Fallback para "audio/ogg" que é o padrão do WhatsApp.
 */
function extrairMimeType(mensagemPayload) {
  const mime = mensagemPayload?.message?.audioMessage?.mimetype ?? "audio/ogg";
  return mime.split(";")[0].trim();
}

/**
 * Determina a extensão do arquivo a partir do MIME type.
 */
function extensaoPorMime(mime) {
  const mapa = {
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/webm": "webm",
    "audio/wav": "wav",
    "audio/flac": "flac"
  };
  return mapa[mime] ?? "ogg";
}

/**
 * Baixa o áudio da Evolution API e retorna como Buffer.
 *
 * @param {object} mensagemPayload - payload completo do webhook
 * @returns {Promise<{buffer: Buffer, mimeType: string} | null>}
 */
async function baixarAudio(mensagemPayload) {
  try {
    const resposta = await clienteEvolutionPadrao.post(
      `/chat/getBase64FromMediaMessage/${config.evolution.instanceName}`,
      { message: { key: mensagemPayload.key, message: mensagemPayload.message } }
    );

    const base64 = resposta?.base64;
    if (!base64) return null;

    const buffer = Buffer.from(base64, "base64");
    const mimeType = extrairMimeType(mensagemPayload);
    return { buffer, mimeType };
  } catch (erro) {
    logger.warn("Falha ao baixar áudio da Evolution API", { erro: erro.message });
    return null;
  }
}

/**
 * Envia o buffer de áudio ao Groq Whisper e retorna a transcrição.
 *
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<string | null>}
 */
async function transcreverComGroq(buffer, mimeType) {
  const extensao = extensaoPorMime(mimeType);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), `audio.${extensao}`);
  form.append("model", MODELO_WHISPER);
  form.append("language", "pt");
  form.append("response_format", "text");

  const resposta = await fetch(GROQ_TRANSCRICAO_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.groq.apiKey}` },
    body: form
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Groq Whisper retornou ${resposta.status}: ${erro}`);
  }

  return (await resposta.text()).trim();
}

/**
 * Transcreve um áudio recebido via webhook da Evolution API.
 *
 * @param {object} mensagemPayload - payload completo do evento `messages.upsert`
 * @returns {Promise<string | null>} texto transcrito, ou null se não for possível
 */
export async function transcreverAudio(mensagemPayload) {
  if (!config.groq.apiKey) {
    logger.warn("GROQ_API_KEY não configurada — áudio descartado");
    return null;
  }

  const audio = await baixarAudio(mensagemPayload);
  if (!audio) return null;

  try {
    const texto = await transcreverComGroq(audio.buffer, audio.mimeType);
    logger.info("Áudio transcrito com sucesso", {
      caracteres: texto?.length ?? 0,
      grupoJid: mensagemPayload.key?.remoteJid
    });
    return texto || null;
  } catch (erro) {
    logger.error("Falha ao transcrever áudio via Groq", { erro: erro.message });
    return null;
  }
}
