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
import { dentroDaJanelaHoraria, diaDaSemana, formatarHora } from "../../shared/utils.js";
import Notificacao from "../../dominio/notificacao.modelo.js";

const COOLDOWN_GERAL_MINUTOS = 15;

/** Retorna true se qualquer notificação foi enviada pro responsável neste grupo nos últimos COOLDOWN_GERAL_MINUTOS. */
async function grupoEmCooldownGeral(grupoId, responsavelId) {
  const desde = new Date(Date.now() - COOLDOWN_GERAL_MINUTOS * 60 * 1000);
  const recente = await Notificacao.findOne({ grupoId, responsavelId, enviadaEm: { $gte: desde } }).lean();
  return recente !== null;
}

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

  if (analise.severidade === "critico") {
    return { podeEnviar: true };
  }

  const emCooldown = await grupoEmCooldownGeral(grupo._id, responsavel._id);
  if (emCooldown) {
    return { podeEnviar: false, motivo: `Grupo em cooldown (notificação enviada há menos de ${COOLDOWN_GERAL_MINUTOS} min)` };
  }

  const duplicado = await jaNotificadoRecentemente(grupo._id, analise.gatilho, responsavel._id);
  if (duplicado) {
    return { podeEnviar: false, motivo: "Notificação duplicada (mesmo gatilho recente)" };
  }

  const agora = new Date();
  const diasUteis = responsavel.preferencias?.diasUteis ?? [1, 2, 3, 4, 5];
  if (!diasUteis.includes(diaDaSemana(agora))) {
    return { podeEnviar: false, motivo: "Fora dos dias configurados pro responsável" };
  }

  const { inicio, fim } = responsavel.preferencias?.horariosNotificacao ?? {};
  if (inicio && fim && !dentroDaJanelaHoraria(formatarHora(agora), inicio, fim)) {
    return { podeEnviar: false, motivo: "Fora do horário configurado pro responsável" };
  }

  return { podeEnviar: true };
}
