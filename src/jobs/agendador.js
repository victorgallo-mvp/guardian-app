/**
 * Agendador de jobs periódicos, usando node-cron.
 *
 * Chamado pelo entry point (`index.js`) após a conexão com o banco ser
 * estabelecida.
 */
import cron from "node-cron";
import logger from "../infra/logger.js";
import { verificarInatividade } from "./verificar-inatividade.job.js";
import { enviarRelatorioDiario } from "./relatorio-diario.job.js";

/** Registra os jobs periódicos da aplicação. */
export function iniciarJobs() {
  // A cada 30 minutos: reavalia mensagens sem resposta há tempo suficiente
  cron.schedule("*/30 * * * *", async () => {
    try {
      await verificarInatividade();
    } catch (erro) {
      logger.error("Falha no job de verificação de inatividade", { erro: erro.message, stack: erro.stack });
    }
  });

  // Diariamente às 18:00 SP (21:00 UTC — Railway roda em UTC)
  cron.schedule("0 21 * * *", async () => {
    try {
      await enviarRelatorioDiario();
    } catch (erro) {
      logger.error("Falha no job de relatório diário", { erro: erro.message, stack: erro.stack });
    }
  });

  logger.info("Jobs periódicos agendados (verificação de inatividade a cada 30min, relatório diário às 18:00 SP)");
}
