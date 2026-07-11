/**
 * Job periódico: notifica responsáveis quando um cliente fica sem resposta
 * por mais de HORAS_SEM_RESPOSTA horas ÚTEIS (dentro do expediente).
 *
 * Lógica direta — sem IA. A condição é determinística:
 *   1. Hora atual está dentro do expediente (EXPEDIENTE_INICIO–EXPEDIENTE_FIM)
 *   2. Última mensagem do grupo é de cliente (não agência)
 *   3. Essa mensagem tem mais de HORAS_SEM_RESPOSTA horas úteis sem resposta
 *   4. Nenhuma mensagem de agência foi enviada depois dela
 *   5. Nenhuma notificação foi enviada para este grupo nas últimas HORAS_DEDUP
 *
 * Horas úteis: soma de tempo dentro da janela 7h–17h BRT, dia a dia.
 * Mensagens enviadas fora do expediente só começam a contar a partir do
 * próximo início de expediente — evitando alertas por mensagens noturnas
 * que chegam logo após as 7h.
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
import { obterTreinamento } from "../core/ia/construtor-prompt.js";
import Funcionario from "../dominio/funcionario.modelo.js";
import config from "../config/index.js";

const HORAS_SEM_RESPOSTA  = 2;
const HORAS_JANELA_MAXIMA = 72;  // calendário — cobre fins de semana

// Expediente em BRT (America/Sao_Paulo — sem DST desde 2019, sempre UTC-3)
const TZ                = "America/Sao_Paulo";
const EXPEDIENTE_INICIO = 7;   // inclusive
const EXPEDIENTE_FIM    = 17;  // exclusive

// ─── helpers de fuso ────────────────────────────────────────────────────────

function partsBRT(date) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false
  }).formatToParts(date);
  const g = (t) => p.find((x) => x.type === t)?.value ?? "00";
  return { ano: g("year"), mes: g("month"), dia: g("day"), hora: Number(g("hour")) % 24 };
}

/** Hora atual em BRT (0–23). */
function horaBRT(date = new Date()) {
  return partsBRT(date).hora;
}

/** Retorna true se a data for sábado (6) ou domingo (0) em BRT. */
function ehFimDeSemanaBRT(date = new Date()) {
  const dia = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(date);
  return dia === "Saturday" || dia === "Sunday";
}

/** Retorna true se o texto contém apenas emojis e espaços (sem texto alfabético). */
function somenteEmojis(texto) {
  if (!texto?.trim()) return false;
  return texto.replace(/\p{Emoji_Presentation}/gu, "").trim().length === 0;
}

/**
 * Retorna o timestamp do início do expediente (EXPEDIENTE_INICIO h BRT)
 * no mesmo dia BRT de `date`.
 */
function inicioExpedienteDia(date) {
  const { ano, mes, dia } = partsBRT(date);
  // Brasil é UTC-3 fixo — o sufixo -03:00 é sempre correto
  return new Date(`${ano}-${mes}-${dia}T${String(EXPEDIENTE_INICIO).padStart(2, "0")}:00:00-03:00`);
}

/**
 * Horas úteis decorridas entre `from` e `to`, contando apenas os
 * intervalos dentro de [EXPEDIENTE_INICIO, EXPEDIENTE_FIM) BRT.
 *
 * Ex.: mensagem às 22h → conta a partir das 7h do dia seguinte.
 */
function horasUteisDecorridas(from, to) {
  if (to <= from) return 0;

  const MS_HORA      = 60 * 60 * 1000;
  const MS_DIA       = 24 * MS_HORA;
  const HORAS_EXPEDI = EXPEDIENTE_FIM - EXPEDIENTE_INICIO;

  let total     = 0;
  let diaInicio = inicioExpedienteDia(from); // 7h BRT no dia de 'from'

  while (diaInicio.getTime() < to.getTime()) {
    // diaInicio é sempre às 7h BRT = 10h UTC → getDay() reflete o dia BRT correto
    const diaSemana = diaInicio.getDay(); // 0=Dom, 6=Sáb
    if (diaSemana !== 0 && diaSemana !== 6) {
      const fimExpediente = new Date(diaInicio.getTime() + HORAS_EXPEDI * MS_HORA);
      const inicio = Math.max(from.getTime(), diaInicio.getTime());
      const fim    = Math.min(to.getTime(),   fimExpediente.getTime());
      if (fim > inicio) total += (fim - inicio) / MS_HORA;
    }
    diaInicio = new Date(diaInicio.getTime() + MS_DIA);
  }

  return total;
}

// ─── job ────────────────────────────────────────────────────────────────────

export async function verificarInatividade() {
  // Só notifica em dias úteis dentro do expediente
  const agora = new Date();
  if (ehFimDeSemanaBRT(agora)) {
    logger.debug("Job inatividade: fim de semana, abortando");
    return;
  }
  const horaAtual = horaBRT(agora);
  if (horaAtual < EXPEDIENTE_INICIO || horaAtual >= EXPEDIENTE_FIM) {
    logger.debug("Job inatividade: fora do expediente, abortando", { horaAtual });
    return;
  }

  const desde = new Date(agora.getTime() - HORAS_JANELA_MAXIMA * 60 * 60 * 1000);

  // Grupos internos não têm "cliente" esperando resposta
  const grupos = await Grupo.find({ clientId: config.clientId, ativo: true, tipo: { $ne: "interno" } });

  const cliente = await Cliente.findOne({ identificador: config.clientId }).select("gatilhosDesativados").lean();
  const gatilhosDesativadosGlobal = cliente?.gatilhosDesativados ?? [];

  if (gatilhosDesativadosGlobal.includes("fora_do_escopo")) {
    logger.debug("Job inatividade: fora_do_escopo desativado globalmente, abortando");
    return;
  }

  const { frases: frasesEncerraConversa } = await obterTreinamento(config.clientId);
  let totalNotificados = 0;

  for (const grupo of grupos) {
    try {
      if (grupoEmSnooze(grupo)) continue;
      if (grupo.gatilhosDesativados?.includes("fora_do_escopo")) continue;

      // JIDs conhecidos da equipe — necessário para checar mensagens antigas (isAgencia: null)
      const funcionarios = await Funcionario.find({ clientId: grupo.clientId, ativo: true }).select("whatsappJid").lean();
      const jidsEquipe = funcionarios.map((f) => f.whatsappJid).filter(Boolean);

      // Última mensagem de cliente dentro da janela calendário
      // (sem filtro de tempo mínimo — o check de horas úteis é feito em código)
      const ultimaMsgCliente = await Mensagem.findOne({
        grupoId: grupo._id,
        isAgencia: { $ne: true },
        recebidaEm: { $gte: desde }
      })
        .sort({ recebidaEm: -1 })
        .lean();

      if (!ultimaMsgCliente) continue;

      // Horas úteis decorridas desde a última mensagem do cliente
      const horasUteis = horasUteisDecorridas(new Date(ultimaMsgCliente.recebidaEm), new Date(agora));
      if (horasUteis < HORAS_SEM_RESPOSTA) continue;

      // Mensagem composta só de emojis não exige resposta
      if (somenteEmojis(ultimaMsgCliente.conteudo)) {
        logger.debug("Job inatividade: última mensagem é só emoji, pulando", {
          grupoId: grupo._id,
          conteudo: ultimaMsgCliente.conteudo
        });
        continue;
      }

      // Última mensagem é agradecimento/confirmação que não exige resposta?
      if (mensagemEncerraConversa(ultimaMsgCliente.conteudo, frasesEncerraConversa)) {
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

      // Já notificamos este grupo desde que essa mensagem do cliente chegou?
      // Uma notificação por evento — só reseta quando o cliente mandar nova mensagem.
      const jaNotificado = await Notificacao.findOne({
        grupoId: grupo._id,
        enviadaEm: { $gte: ultimaMsgCliente.recebidaEm }
      }).lean();

      if (jaNotificado) continue;

      const horasEsperando = Math.round(horasUteis);

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
          explicacao: `Cliente aguarda resposta há ${horasEsperando}h úteis sem retorno da equipe.`,
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
        horasUteis: horasEsperando,
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
