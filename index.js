/**
 * Entry point do Guardião WPP: conecta ao MongoDB, inicia o servidor HTTP
 * (webhook + admin) e agenda os jobs periódicos.
 */
import app from "./src/api/app.js";
import config from "./src/config/index.js";
import logger from "./src/infra/logger.js";
import { conectarMongo, desconectarMongo } from "./src/infra/mongo.js";
import { iniciarJobs } from "./src/jobs/agendador.js";

async function iniciar() {
  await conectarMongo();

  const servidor = app.listen(config.servidor.porta, () => {
    logger.info("Guardião WPP no ar", {
      porta: config.servidor.porta,
      ambiente: config.servidor.ambiente,
      clientId: config.clientId,
      webhookUrlBase: config.webhookUrlBase
    });
  });

  iniciarJobs();

  async function encerrar(sinal) {
    logger.info("Encerrando Guardião WPP", { sinal });
    servidor.close(async () => {
      await desconectarMongo();
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => encerrar("SIGTERM"));
  process.on("SIGINT", () => encerrar("SIGINT"));
}

iniciar().catch((erro) => {
  logger.error("Falha ao iniciar o Guardião WPP", { erro: erro.message, stack: erro.stack });
  process.exit(1);
});
