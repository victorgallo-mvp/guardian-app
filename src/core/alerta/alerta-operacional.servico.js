/**
 * Alertas operacionais (saúde do próprio Guardião), separados das
 * notificações de gatilho que vão pros responsáveis.
 *
 * Canais, todos best-effort:
 *   1. Log estruturado (sempre).
 *   2. Grupo de notificação no WhatsApp, pela mesma instância da Evolution.
 *      Funciona pra "voltou"; numa queda real tende a falhar, por isso o
 *      canal 3 existe.
 *   3. Webhook externo (`ALERTA_WEBHOOK_URL`): POST JSON pra n8n, Slack,
 *      Discord, Make, etc. É o único canal que chega quando o WhatsApp caiu.
 */
import config from "../../config/index.js";
import logger from "../../infra/logger.js";
import { clienteEvolutionPadrao } from "../../infra/evolution-client.js";

const TIMEOUT_WEBHOOK_MS = 10_000;

function formatarDataBRT(data) {
  return new Date(data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Monta o texto do alerta de queda da conexão. */
export function construirTextoQueda({ instanceName, alerta, agora = new Date() }) {
  const linhas = [
    `🔴 *Guardião: WhatsApp desconectado*`,
    ``,
    `Instância: ${instanceName}`,
    `Estado: ${alerta.estado}${alerta.codigo ? ` (código ${alerta.codigo})` : ""}`,
    `Desde: ${formatarDataBRT(alerta.caidoDesde)} BRT`,
    `Motivo: ${alerta.descricao}`,
    ``
  ];
  if (alerta.terminal) {
    linhas.push(
      `Enquanto estiver assim, nenhuma mensagem de grupo chega ao Guardião e nenhuma notificação sai.`,
      `Para reconectar, leia o QR code em ${config.evolution.apiUrl}/manager.`,
      `⚠️ Não clique várias vezes em "Restart" da instância: isso cria sockets duplicados e trava a reconexão.`
    );
  } else {
    linhas.push(`A Evolution deveria reconectar sozinha. Se este alerta se repetir, verifique o manager em ${config.evolution.apiUrl}/manager.`);
  }
  linhas.push(``, `Detectado em ${formatarDataBRT(agora)} BRT.`);
  return linhas.join("\n");
}

/** Monta o texto do alerta de recuperação. */
export function construirTextoRecuperacao({ instanceName, alerta, agora = new Date() }) {
  return [
    `🟢 *Guardião: WhatsApp reconectado*`,
    ``,
    `Instância: ${instanceName}`,
    `Ficou fora por ~${alerta.duracaoMinutos} min (desde ${formatarDataBRT(alerta.caidoDesde)} BRT).`,
    `Mensagens enviadas nos grupos nesse período não foram processadas.`,
    ``,
    `Reconectado em ${formatarDataBRT(agora)} BRT.`
  ].join("\n");
}

async function enviarWhatsApp(texto) {
  const resposta = await clienteEvolutionPadrao.post(
    `/message/sendText/${config.evolution.instanceName}`,
    { number: config.notificacao.grupoJid, text: texto }
  );
  return resposta?.key?.id ?? null;
}

async function enviarWebhookExterno(payload) {
  const url = config.alertas.webhookUrl;
  if (!url) return false;

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_WEBHOOK_MS);
  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controlador.signal
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dispara um alerta operacional em todos os canais configurados.
 * Nunca lança: falhas de canal viram log.
 *
 * @param {object} params
 * @param {"queda"|"recuperacao"} params.tipo
 * @param {string} params.texto - mensagem pronta (WhatsApp / webhook)
 * @param {object} params.dados - metadados estruturados (vão no webhook e no log)
 * @param {boolean} [params.tentarWhatsApp=true]
 * @returns {Promise<{ whatsapp: boolean, webhook: boolean }>}
 */
export async function enviarAlertaOperacional({ tipo, texto, dados = {}, tentarWhatsApp = true }) {
  const resultado = { whatsapp: false, webhook: false };
  const nivel = tipo === "queda" ? "error" : "info";
  logger.log(nivel, `Alerta operacional: ${tipo}`, { ...dados, clientId: config.clientId });

  const payload = {
    servico: "guardiao-wpp",
    clientId: config.clientId,
    tipo,
    titulo: tipo === "queda" ? "WhatsApp desconectado" : "WhatsApp reconectado",
    texto,
    dados,
    emitidoEm: new Date().toISOString()
  };

  const tarefas = [];

  if (tentarWhatsApp) {
    tarefas.push(
      enviarWhatsApp(texto)
        .then(() => { resultado.whatsapp = true; })
        .catch((erro) => logger.warn("Alerta operacional: falha ao enviar pelo WhatsApp", { tipo, erro: erro.message }))
    );
  }

  tarefas.push(
    enviarWebhookExterno(payload)
      .then((ok) => { resultado.webhook = ok; })
      .catch((erro) => logger.warn("Alerta operacional: falha ao chamar webhook externo", { tipo, erro: erro.message }))
  );

  await Promise.all(tarefas);

  if (tipo === "queda" && !resultado.whatsapp && !resultado.webhook) {
    logger.error("Alerta operacional de queda não chegou a nenhum canal externo. Configure ALERTA_WEBHOOK_URL.", dados);
  }

  return resultado;
}
