/**
 * Configura o webhook da instância Evolution pra apontar pro Guardião com
 * os eventos necessários: MESSAGES_UPSERT (pipeline) e CONNECTION_UPDATE
 * (monitor de conexão). Idempotente — pode rodar quantas vezes quiser.
 *
 * Uso: node scripts/configurar-webhook.js
 */
import config from "../src/config/index.js";
import { clienteEvolutionPadrao } from "../src/infra/evolution-client.js";

const EVENTOS = ["MESSAGES_UPSERT", "CONNECTION_UPDATE"];
const url = `${config.webhookUrlBase}/webhook`;
const instancia = config.evolution.instanceName;

const atual = await clienteEvolutionPadrao.get(`/webhook/find/${instancia}`).catch(() => null);
console.log("Webhook atual:", atual ? { url: atual.url, enabled: atual.enabled, events: atual.events } : "(nenhum)");

const eventos = [...new Set([...(atual?.events ?? []), ...EVENTOS])];
const corpo = { webhook: { enabled: true, url, byEvents: false, base64: false, events: eventos } };

let resposta;
try {
  resposta = await clienteEvolutionPadrao.post(`/webhook/set/${instancia}`, corpo);
} catch (erro) {
  // Versões anteriores da Evolution v2 usam outros nomes de campo
  console.warn("Formato novo recusado, tentando formato legado:", erro.message.slice(0, 200));
  resposta = await clienteEvolutionPadrao.post(`/webhook/set/${instancia}`, {
    webhook: { enabled: true, url, webhookByEvents: false, webhookBase64: false, events: eventos }
  });
}

console.log("Webhook configurado:", { url: resposta?.url ?? url, enabled: resposta?.enabled ?? true, events: resposta?.events ?? eventos });
process.exit(0);
