/**
 * Job periódico: notifica responsáveis quando um cliente fica sem resposta
 * por mais de HORAS_SEM_RESPOSTA horas.
 *
 * Lógica direta — sem IA. A condição é determinística:
 *   1. Última mensagem do grupo é de cliente (não agência)
 *   2. Essa mensagem tem mais de HORAS_SEM_RESPOSTA e menos de HORAS_JANELA_MAXIMA
 *   3. Nenhuma mensagem de agência foi enviada depois dela
 *   4. Nenhuma notificação foi enviada para este grupo nas últimas HORAS_DEDUP
 *
 * Throttling e horário do responsável são verificados pelo enviador (podeEnviarNotificacao).
 */
import Grupo from "../dominio/grupo.modelo.js";
import Mensagem from "../dominio/mensagem.modelo.js";
import Notificacao from "../dominio/notificacao.modelo.js";
import Analise from "../dominio/analise.modelo.js";
import Cliente from "../dominio/cliente.modelo.js";
import logger from "../infra/logger.js";
import { enviarNotificacoes } from "../core/notificacao/enviador.servico.js";
import { grupoEmSnooze } from "../core/filtros/grupo-permitido.filtro.js";
import { mensagemEncerraConversa } from "../core/filtros/encerra-conversa.filtro.js";
import Funcionario from "../dominio/funcionario.modelo.js";
import config from "../config/index.js";

const HORAS_SEM_RESPOSTA = 2;
const HORAS_JANELA_MAXIMA = 24;
const HORAS_DEDUP = 4;

export async function verificarInatividade() {
  const agora = Date.now();
  const antesDe = new Date(agora - HORAS_SEM_RESPOSTA * 60 * 60 * 1000);
  const desde   = new Date(agora - HORAS_JANELA_MAXIMA * 60 * 60 * 1000);
  const dedupDesde = new Date(agora - HORAS_DEDUP * 60 * 60 * 1000);

  // Grupos internos não têm "cliente" esperando resposta
  const grupos = await Grupo.find({ clientId: config.clientId, ativo: true, tipo: { $ne: "interno" } });

  const cliente = await Cliente.findOne({ identificador: config.clientId }).select("gatilhosDesativados").lean();
  const gatilhosDesativadosGlobal = cliente?.gatilhosDesativados ?? [];

  if (gatilhosDesativadosGlobal.includes("fora_do_escopo")) {
    logger.debug("Job inatividade: fora_do_escopo desativado globalmente, abortando");
    return;
  }

  let totalNotificados = 0;

  for (const grupo of grupos) {
    try {
      if (grupoEmSnooze(grupo)) continue;
      if (grupo.gatilhosDesativados?.includes("fora_do_escopo")) continue;

      // JIDs conhecidos da equipe — necessário para checar mensagens antigas (isAgencia: null)
      const funcionarios = await Funcionario.find({ clientId: grupo.clientId, ativo: true }).select("whatsappJid").lean();
      const jidsEquipe = funcionarios.map((f) => f.whatsappJid).filter(Boolean);

      // Última mensagem de cliente no período de interesse
      const ultimaMsgCliente = await Mensagem.findOne({
        grupoId: grupo._id,
        isAgencia: { $ne: true },
        recebidaEm: { $gte: desde, $lte: antesDe }
      })
        .sort({ recebidaEm: -1 })
        .lean();

      if (!ultimaMsgCliente) continue;

      // Última mensagem é agradecimento/confirmação que não exige resposta?
      if (mensagemEncerraConversa(ultimaMsgCliente.conteudo)) {
        logger.debug("Job inatividade: última mensagem do cliente encerra conversa, pulando", {
          grupoId: grupo._id,
          conteudo: ultimaMsgCliente.conteudo?.slice(0, 50)
        });
        continue;
      }

      // Agência respondeu depois dessa mensagem?
      // Inclui mensagens antigas (isAgencia: null) verificando o JID diretamente.
      const filtroAgencia = jidsEquipe.length
        ? { grupoId: grupo._id, $or: [{ isAgencia: true }, { isAgencia: null, remetenteJid: { $in: jidsEquipe } }], recebidaEm: { $gt: ultimaMsgCliente.recebidaEm } }
        : { grupoId: grupo._id, isAgencia: true, recebidaEm: { $gt: ultimaMsgCliente.recebidaEm } };
      const respostaAgencia = await Mensagem.findOne(filtroAgencia).lean();

      if (respostaAgencia) continue;

      // Já notificamos este grupo nas últimas HORAS_DEDUP?
      const notifRecente = await Notificacao.findOne({
        clientId: grupo.clientId,
        grupoId: grupo._id,
        enviadaEm: { $gte: dedupDesde }
      }).lean();

      if (notifRecente) continue;

      const horasEsperando = Math.round(
        (agora - new Date(ultimaMsgCliente.recebidaEm).getTime()) / (1000 * 60 * 60)
      );

      const analiseDoc = await Analise.create({
        clientId: grupo.clientId,
        grupoId: grupo._id,
        mensagemId: ultimaMsgCliente._id,
        contextoAnalisado: {
          mensagemAtual: ultimaMsgCliente.conteudo ?? "",
          mensagensAnteriores: [],
          totalContexto: 0
        },
        detectado: {
          gatilho: "fora_do_escopo",
          severidade: "urgente",
          confiancaScore: 0.9,
          explicacao: `Cliente aguarda resposta há ${horasEsperando}h sem retorno da equipe.`,
          citacoes: ultimaMsgCliente.conteudo ? [ultimaMsgCliente.conteudo.slice(0, 200)] : []
        },
        contextoDoCliente: `Última mensagem: "${(ultimaMsgCliente.conteudo ?? "").slice(0, 150)}"`,
        recomendacaoAcao: "Responder o cliente o quanto antes para evitar insatisfação.",
        modeloUsado: "job-inatividade",
        custoTokensUsd: 0
      });

      await enviarNotificacoes({ analiseDoc, grupo, mensagem: ultimaMsgCliente });
      totalNotificados++;

      logger.info("Job inatividade: notificação enviada", {
        grupoId: grupo._id,
        nomeGrupo: grupo.nomeGrupo,
        horasEsperando,
        mensagemId: ultimaMsgCliente._id
      });
    } catch (erro) {
      logger.error("Job inatividade: erro ao processar grupo", {
        grupoId: grupo._id,
        erro: erro.message,
        stack: erro.stack
      });
    }
  }

  if (totalNotificados > 0) {
    logger.info(`Job inatividade: ${totalNotificados} grupo(s) notificado(s) por ausência de resposta`);
  } else {
    logger.debug("Job inatividade: nenhum grupo com inatividade detectada");
  }
}
