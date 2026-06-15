/**
 * Throttling de notificações: decide se uma notificação pode ser enviada
 * agora, considerando deduplicação (mesmo gatilho recente), snooze do grupo
 * e horário/dias preferidos do responsável.
 *
 * Alertas de severidade "critico" ignoram horário/dias preferidos —
 * urgência real não deve esperar o expediente do responsável.
 */
import { jaNotificadoRecentemente } from "../gatilhos/deduplicador.js";
import { grupoEmSnooze } from "../filtros/grupo-permitido.filtro.js";
import { dentroDaJanelaHoraria, formatarHora } from "../../shared/utils.js";

/**
 * Verifica se uma notificação pode ser enviada agora pra um responsável.
 *
 * @param {object} grupo - documento Grupo
 * @param {object} analise - `detectado` da análise validada (com `gatilho`, `severidade`)
 * @param {object} responsavel - documento Responsavel
 * @returns {Promise<{podeEnviar: boolean, motivo?: string}>}
 */
export async function podeEnviarNotificacao({ grupo, analise, responsavel }) {
  if (grupoEmSnooze(grupo)) {
    return { podeEnviar: false, motivo: "Grupo está em snooze" };
  }

  const duplicado = await jaNotificadoRecentemente(grupo._id, analise.gatilho);
  if (duplicado) {
    return { podeEnviar: false, motivo: "Notificação duplicada (mesmo gatilho recente)" };
  }

  if (analise.severidade === "critico") {
    return { podeEnviar: true };
  }

  const agora = new Date();
  const diasUteis = responsavel.preferencias?.diasUteis ?? [1, 2, 3, 4, 5];
  if (!diasUteis.includes(agora.getDay())) {
    return { podeEnviar: false, motivo: "Fora dos dias configurados pro responsável" };
  }

  const { inicio, fim } = responsavel.preferencias?.horariosNotificacao ?? {};
  if (inicio && fim && !dentroDaJanelaHoraria(formatarHora(agora), inicio, fim)) {
    return { podeEnviar: false, motivo: "Fora do horário configurado pro responsável" };
  }

  return { podeEnviar: true };
}
