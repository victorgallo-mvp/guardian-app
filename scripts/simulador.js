#!/usr/bin/env node
/**
 * Simulador de mensagens recebidas via Evolution API — útil pra testar o
 * pipeline completo (filtros, triagem, análise profunda, notificação) sem
 * precisar de um grupo de WhatsApp real.
 *
 * Uso: npm run simulador -- <idWhatsappGrupo> "texto da mensagem" ["Nome do remetente"]
 */
import { randomUUID } from "node:crypto";
import { conectarMongo, desconectarMongo } from "../src/infra/mongo.js";
import { processarEventoWebhook } from "../src/api/webhooks/evolution.webhook.js";
import config from "../src/config/index.js";

async function main() {
  const [idWhatsappGrupo, texto, remetenteNome = "Simulador"] = process.argv.slice(2);

  if (!idWhatsappGrupo || !texto) {
    console.error('Uso: npm run simulador -- <idWhatsappGrupo> "texto da mensagem" ["Nome do remetente"]');
    process.exitCode = 1;
    return;
  }

  await conectarMongo();

  const payload = {
    event: "messages.upsert",
    instance: config.evolution.instanceName,
    data: {
      key: {
        remoteJid: idWhatsappGrupo,
        fromMe: false,
        id: randomUUID(),
        participant: "5500000000000@s.whatsapp.net"
      },
      pushName: remetenteNome,
      message: { conversation: texto },
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  };

  console.log("Enviando evento simulado:\n", JSON.stringify(payload, null, 2));

  await processarEventoWebhook(payload);

  console.log("\n✅ Evento processado. Confira os logs e o MongoDB pra ver o resultado.");
}

main()
  .catch((erro) => {
    console.error("Erro:", erro.message, erro.stack);
    process.exitCode = 1;
  })
  .finally(() => desconectarMongo());
