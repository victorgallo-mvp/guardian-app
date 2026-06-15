/**
 * Job periódico: envia um relatório diário resumido aos responsáveis que
 * optaram por recebê-lo (`Responsavel.preferencias.receberRelatorioDiario`).
 */
import Grupo from "../dominio/grupo.modelo.js";
import Responsavel from "../dominio/responsavel.modelo.js";
import Notificacao from "../dominio/notificacao.modelo.js";
import { clienteEvolutionPadrao } from "../infra/evolution-client.js";
import config from "../config/index.js";
import logger from "../infra/logger.js";

/** Converte um número de WhatsApp (ex: "5511999999999") pro JID de contato individual. */
function paraJidContato(numero) {
  return `${numero.replace(/\D/g, "")}@s.whatsapp.net`;
}

/** Retorna a data/hora correspondente ao início do dia atual (00:00, horário local). */
function inicioDoDia() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

/** Monta o texto do relatório diário pra um responsável, considerando apenas os grupos dele. */
function montarTextoRelatorio(grupos, notificacoesHoje) {
  const linhas = [
    `📋 *Resumo do dia* — ${grupos.length} grupo(s) monitorado(s)`,
    `Notificações enviadas hoje: ${notificacoesHoje}`,
    ""
  ];

  for (const grupo of grupos) {
    const stats = grupo.estatisticas ?? {};
    linhas.push(`• ${grupo.nomeGrupo}: ${stats.mensagensProcessadasTotal ?? 0} mensagens processadas no total`);
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

    const notificacoesHoje = await Notificacao.countDocuments({
      responsavelId: responsavel._id,
      enviadaEm: { $gte: desde }
    });

    const texto = montarTextoRelatorio(grupos, notificacoesHoje);

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
