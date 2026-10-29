/**
 * Monitor da conexão WhatsApp da instância Evolution.
 *
 * Duas fontes alimentam a mesma máquina de estados (`transicao-conexao.js`):
 *   - webhook `connection.update` (tempo real, depende da Evolution estar viva)
 *   - verificação periódica via `GET /instance/connectionState` (rede de
 *     segurança: pega Evolution morta, webhook desconfigurado, etc.)
 *
 * Persiste o estado em `EstadoConexao` e dispara alertas operacionais nas
 * transições relevantes.
 */
import config from "../../config/index.js";
import logger from "../../infra/logger.js";
import { clienteEvolutionPadrao } from "../../infra/evolution-client.js";
import EstadoConexao from "../../dominio/estado-conexao.modelo.js";
import { avaliarTransicao, normalizarEstado } from "./transicao-conexao.js";
import {
  enviarAlertaOperacional,
  construirTextoQueda,
  construirTextoRecuperacao
} from "../alerta/alerta-operacional.servico.js";

const instanceName = () => config.evolution.instanceName;

/**
 * Consulta o estado ao vivo na Evolution, sem persistir nem alertar.
 * Devolve `{ estado, codigo, motivo }`; em falha de rede, `estado: "desconhecido"`
 * com o erro no `motivo` (Evolution fora do ar também é uma queda).
 */
export async function consultarEstadoAoVivo() {
  try {
    const resposta = await clienteEvolutionPadrao.get(`/instance/connectionState/${instanceName()}`);
    const estado = normalizarEstado(resposta?.instance?.state);
    if (estado === "open") return { estado, codigo: null, motivo: null };

    // Fora do ar: tenta enriquecer com o motivo da última desconexão
    let codigo = null;
    let motivo = null;
    try {
      const instancias = await clienteEvolutionPadrao.get(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName())}`);
      const inst = Array.isArray(instancias) ? instancias.find((i) => i?.name === instanceName()) ?? instancias[0] : null;
      codigo = inst?.disconnectionReasonCode ?? null;
      const bruto = inst?.disconnectionObject;
      const tipo = typeof bruto === "string" ? bruto.match(/"type":"([a-z_]+)"/i)?.[1] : bruto?.error?.data?.attrs?.type;
      motivo = tipo ?? null;
    } catch (erro) {
      logger.debug("Monitor conexão: não foi possível obter motivo da desconexão", { erro: erro.message });
    }
    return { estado, codigo, motivo };
  } catch (erro) {
    return { estado: "desconhecido", codigo: null, motivo: `evolution inacessível: ${erro.message}` };
  }
}

/** Último estado persistido (pra dashboard/admin). */
export async function obterEstadoConexao() {
  return EstadoConexao.findOne({ instanceName: instanceName() }).lean();
}

/**
 * Registra uma observação (webhook ou verificação), persiste a transição e
 * dispara os alertas resultantes.
 *
 * @param {{ estado: string, codigo?: number|string|null, motivo?: string|null, origem: "webhook"|"verificacao" }} observacao
 */
export async function registrarObservacao(observacao) {
  const agora = new Date();
  const anterior = await EstadoConexao.findOne({ instanceName: instanceName() }).lean();
  const { registro, alertas } = avaliarTransicao(anterior, observacao, agora);

  await EstadoConexao.updateOne(
    { instanceName: instanceName() },
    { $set: registro, $setOnInsert: { instanceName: instanceName() } },
    { upsert: true }
  );

  if (anterior?.estado !== registro.estado) {
    logger.info("Monitor conexão: estado mudou", {
      de: anterior?.estado ?? null,
      para: registro.estado,
      codigo: registro.codigo,
      motivo: registro.motivo,
      origem: observacao.origem
    });
  }

  for (const alerta of alertas) {
    if (alerta.tipo === "queda") {
      await enviarAlertaOperacional({
        tipo: "queda",
        texto: construirTextoQueda({ instanceName: instanceName(), alerta, agora }),
        dados: { instanceName: instanceName(), ...alerta },
        // Se a sessão caiu de vez, não adianta tentar mandar por ela mesma
        tentarWhatsApp: !alerta.terminal
      });
    } else if (alerta.tipo === "recuperacao") {
      await enviarAlertaOperacional({
        tipo: "recuperacao",
        texto: construirTextoRecuperacao({ instanceName: instanceName(), alerta, agora }),
        dados: { instanceName: instanceName(), ...alerta }
      });
    }
  }

  return { registro, alertas };
}

/**
 * Trata o payload do evento `connection.update` da Evolution.
 * Formato observado (v2.x): `{ instance, state, statusReason }`.
 */
export async function processarEventoConexao(dados) {
  if (!dados) return null;
  const nomeInstancia = dados.instance ?? dados.instanceName ?? null;
  if (nomeInstancia && nomeInstancia !== instanceName()) {
    logger.debug("Monitor conexão: evento de outra instância ignorado", { instancia: nomeInstancia });
    return null;
  }

  const estado = dados.state ?? dados.connection ?? dados.status;
  const codigo = dados.statusReason ?? dados.lastDisconnect?.error?.output?.statusCode ?? null;
  const motivo = dados.lastDisconnect?.error?.data?.attrs?.type ?? dados.reason ?? null;

  return registrarObservacao({ estado, codigo, motivo, origem: "webhook" });
}

/** Verificação periódica (job). */
export async function verificarConexao() {
  const observacao = await consultarEstadoAoVivo();
  return registrarObservacao({ ...observacao, origem: "verificacao" });
}
