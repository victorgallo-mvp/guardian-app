/**
 * Job periódico: envia um relatório diário resumido aos responsáveis que
 * optaram por recebê-lo (`Responsavel.preferencias.receberRelatorioDiario`).
 */
import Grupo from "../dominio/grupo.modelo.js";
import Responsavel from "../dominio/responsavel.modelo.js";
import Notificacao from "../dominio/notificacao.modelo.js";
import Mensagem from "../dominio/mensagem.modelo.js";
import { clienteEvolutionPadrao } from "../infra/evolution-client.js";
import config from "../config/index.js";
import logger from "../infra/logger.js";

/** Converte um número de WhatsApp (ex: "5511999999999") pro JID de contato individual. */
function paraJidContato(numero) {
  return `${numero.replace(/\D/g, "")}@s.whatsapp.net`;
}

/** Retorna 00:00 do dia atual no horário de Brasília, expresso em UTC. */
function inicioDoDia() {
  const dataSP = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${dataSP}T00:00:00-03:00`);
}

/** Monta o texto do relatório diário pra um responsável, considerando apenas os grupos dele. */
function montarTextoRelatorio(grupos, notificacoesHoje, msgsPorGrupo) {
  const linhas = [
    `📋 *Resumo do dia* — ${grupos.length} grupo(s) monitorado(s)`,
    `Notificações enviadas hoje: ${notificacoesHoje}`,
    ""
  ];

  for (const grupo of grupos) {
    const msgs = msgsPorGrupo[grupo._id.toString()] ?? 0;
    linhas.push(`• ${grupo.nomeGrupo}: ${msgs} msg(s) processada(s) hoje`);
  }

  return linhas.join("\n");
}

/** Envia o relatório diário pra todos os responsáveis ativos que optaram por recebê-lo. */
export async function enviarRelatorioDiario() {
  const desde = inicioDoDia();

  const responsaveis = await Responsavel.find({
    ativo: true,
    "preferencias.receberRelatorioDiario": true
  });

  for (const responsavel of responsaveis) {
    const grupos = await Grupo.find({ responsaveis: responsavel._id, ativo: true });
    if (!grupos.length) continue;

    const grupoIds = grupos.map((g) => g._id);

    const [notificacoesHoje, contagensHoje] = await Promise.all([
      Notificacao.countDocuments({ responsavelId: responsavel._id, enviadaEm: { $gte: desde } }),
      Mensagem.aggregate([
        { $match: { grupoId: { $in: grupoIds }, recebidaEm: { $gte: desde } } },
        { $group: { _id: "$grupoId", total: { $sum: 1 } } }
      ])
    ]);

    const msgsPorGrupo = Object.fromEntries(contagensHoje.map((c) => [c._id.toString(), c.total]));

    const texto = montarTextoRelatorio(grupos, notificacoesHoje, msgsPorGrupo);

    try {
      await clienteEvolutionPadrao.post(`/message/sendText/${config.evolution.instanceName}`, {
        number: paraJidContato(responsavel.whatsappNumero),
        text: texto
      });
    } catch (erro) {
      logger.error("Falha ao enviar relatório diário", {
        responsavelId: responsavel._id,
        erro: erro.message
      });
    }
  }
}
