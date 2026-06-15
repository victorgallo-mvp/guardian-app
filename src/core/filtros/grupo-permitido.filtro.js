/**
 * Filtro de allowlist: verifica se um grupo de WhatsApp está cadastrado
 * e ativo no sistema, ou seja, se deve ser monitorado.
 *
 * Qualquer mensagem de um grupo que não passe por este filtro é
 * descartada sem processamento (sem custo de IA, sem persistência).
 */
import Grupo from "../../dominio/grupo.modelo.js";
import config from "../../config/index.js";

/**
 * Busca o grupo monitorado correspondente a um JID de grupo do WhatsApp.
 *
 * @param {string} idWhatsappGrupo - JID do grupo (ex: "120363xxx@g.us")
 * @returns {Promise<import("mongoose").Document|null>} documento do grupo, ou null se não monitorado
 */
export async function obterGrupoMonitorado(idWhatsappGrupo) {
  if (!idWhatsappGrupo) return null;

  return Grupo.findOne({
    clientId: config.clientId,
    idWhatsappGrupo,
    ativo: true
  });
}

/**
 * Verifica se um JID corresponde a um grupo (vs. DM/contato individual).
 * No formato JID do WhatsApp, grupos terminam em "@g.us".
 */
export function ehGrupo(jid) {
  return typeof jid === "string" && jid.endsWith("@g.us");
}

/**
 * Verifica se um grupo está atualmente em "snooze" (pausado temporariamente
 * por feedback do responsável).
 */
export function grupoEmSnooze(grupo) {
  if (!grupo.pausadoAte) return false;
  return new Date(grupo.pausadoAte) > new Date();
}
