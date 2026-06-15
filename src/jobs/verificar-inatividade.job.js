/**
 * Job periódico: reavalia a mensagem mais recente de cada grupo monitorado
 * quando ela já ficou um tempo sem resposta e sem análise profunda.
 *
 * Gatilhos como "inatividade_preocupante" e "fora_do_escopo" dependem do
 * tempo decorrido, não de uma nova mensagem — sem este job, eles só
 * seriam detectados se alguém mandasse outra mensagem depois.
 */
import Grupo from "../dominio/grupo.modelo.js";
import Mensagem from "../dominio/mensagem.modelo.js";
import logger from "../infra/logger.js";
import { obterContextoRecente } from "../core/contexto/janela-rolante.servico.js";
import { limiteDiarioExcedido } from "../core/ia/controle-custo.servico.js";
import { executarAnaliseEDecidirNotificacao } from "../core/pipeline-mensagem.servico.js";

const HORAS_SEM_RESPOSTA_LIMIAR = 2;
const HORAS_JANELA_MAXIMA = 24;

/**
 * Para cada grupo ativo, busca a última mensagem que:
 * - foi marcada na triagem como `precisaAtencao`
 * - ainda não recebeu análise profunda
 * - está há mais de `HORAS_SEM_RESPOSTA_LIMIAR` sem novas mensagens, mas
 *   dentro de `HORAS_JANELA_MAXIMA` (evita reprocessar histórico antigo)
 *
 * e roda a análise profunda + decisão de notificação sobre ela.
 */
export async function verificarInatividade() {
  const agora = Date.now();
  const desde = new Date(agora - HORAS_JANELA_MAXIMA * 60 * 60 * 1000);
  const antesDe = new Date(agora - HORAS_SEM_RESPOSTA_LIMIAR * 60 * 60 * 1000);

  const grupos = await Grupo.find({ ativo: true });

  for (const grupo of grupos) {
    const ultimaMensagem = await Mensagem.findOne({
      grupoId: grupo._id,
      recebidaEm: { $gte: desde, $lte: antesDe },
      analiseProfundaId: null,
      "triagem.precisaAtencao": true
    }).sort({ recebidaEm: -1 });

    if (!ultimaMensagem) continue;

    if (await limiteDiarioExcedido(grupo.clientId)) {
      logger.debug("Limite diário de custo atingido, pulando reavaliação de inatividade", {
        grupoId: grupo._id
      });
      continue;
    }

    const contexto = await obterContextoRecente(grupo.clientId, grupo._id, {
      excluirMensagemId: ultimaMensagem._id
    });

    const { notificou } = await executarAnaliseEDecidirNotificacao({
      mensagem: ultimaMensagem,
      contexto,
      grupo
    });

    logger.info("Reavaliação de inatividade concluída", {
      grupoId: grupo._id,
      mensagemId: ultimaMensagem._id,
      notificou
    });
  }
}
