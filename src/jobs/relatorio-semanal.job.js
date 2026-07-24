import Relatorio from "../dominio/relatorio.modelo.js";
import { clienteEvolutionPadrao } from "../infra/evolution-client.js";
import { compilarRelatorioSemanal } from "../core/relatorio/compilador.js";
import config from "../config/index.js";
import logger from "../infra/logger.js";

function calcularPeriodoSemanal() {
  const agora = new Date();
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dataSP = seteDiasAtras.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const semanaInicio = new Date(`${dataSP}T00:00:00-03:00`);
  return { semanaInicio, semanaFim: agora };
}

export async function enviarRelatorioSemanal() {
  logger.info("Iniciando geração do relatório semanal");
  const { semanaInicio, semanaFim } = calcularPeriodoSemanal();

  const { grupos, textoWhatsapp } = await compilarRelatorioSemanal(semanaInicio, semanaFim);

  let idMensagemEnviada = null;
  try {
    const resposta = await clienteEvolutionPadrao.post(
      `/message/sendText/${config.evolution.instanceName}`,
      { number: config.notificacao.grupoJid, text: textoWhatsapp }
    );
    idMensagemEnviada = resposta?.key?.id ?? null;
    logger.info("Relatório semanal enviado para Guardian Zap");
  } catch (erro) {
    logger.error("Falha ao enviar relatório semanal via WhatsApp", { erro: erro.message });
  }

  await Relatorio.create({
    clientId: config.clientId,
    semanaInicio,
    semanaFim,
    textoWhatsapp,
    grupos,
    idMensagemEnviada
  });

  logger.info("Relatório semanal salvo no banco", { totalGrupos: grupos.length });
}
