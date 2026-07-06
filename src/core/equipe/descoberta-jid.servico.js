/**
 * Auto-descoberta de JIDs @lid de funcionários.
 *
 * Quando uma mensagem chega de um JID ainda não mapeado, consulta a
 * Evolution API para obter o número de telefone desse JID e cruza com
 * os funcionários cadastrados. Se houver match, salva o @lid e invalida
 * o cache — a partir daí o membro é reconhecido como agência.
 */
import Funcionario from "../../dominio/funcionario.modelo.js";
import { clienteEvolutionPadrao } from "../../infra/evolution-client.js";
import { invalidarCacheEquipe } from "../ia/construtor-prompt.js";
import config from "../../config/index.js";
import logger from "../../infra/logger.js";

// JIDs já verificados nesta sessão e que não têm match (evita consultas repetidas)
const jidsVerificados = new Set();

/**
 * Tenta descobrir e persistir o @lid de um funcionário a partir de um JID
 * recebido em mensagem de grupo.
 *
 * Só age se o JID ainda não está associado a nenhum funcionário cadastrado
 * e se existe ao menos um funcionário com número mas sem @lid.
 *
 * @param {string} remetenteJid - ex: "208808810954881@lid"
 */
export async function tentarDescobertaJid(remetenteJid) {
  if (!remetenteJid || jidsVerificados.has(remetenteJid)) return;

  // Já está mapeado a algum funcionário?
  const jaMapeado = await Funcionario.exists({ clientId: config.clientId, whatsappJid: remetenteJid });
  if (jaMapeado) {
    jidsVerificados.add(remetenteJid);
    return;
  }

  // Há funcionários com número mas sem @lid?
  const semJid = await Funcionario.find({
    clientId: config.clientId,
    ativo: true,
    whatsappNumero: { $ne: null },
    whatsappJid: null
  }).select("_id nome whatsappNumero").lean();

  if (!semJid.length) {
    jidsVerificados.add(remetenteJid);
    return;
  }

  // Consulta Evolution API para obter o número de telefone deste @lid
  let numeroTelefone = null;
  try {
    const resposta = await clienteEvolutionPadrao.get(
      `/contact/fetchProfile/${config.evolution.instanceName}?number=${remetenteJid}`
    );
    // A Evolution API pode retornar o número em diferentes campos
    numeroTelefone =
      resposta?.phone ??
      resposta?.number ??
      resposta?.wuid?.replace(/\D/g, "") ??
      null;
  } catch {
    // Silencioso — consulta de perfil pode falhar para JIDs @lid
  }

  if (numeroTelefone) {
    const numeroNormalizado = String(numeroTelefone).replace(/\D/g, "");
    const match = semJid.find((f) => f.whatsappNumero.replace(/\D/g, "") === numeroNormalizado);

    if (match) {
      await Funcionario.updateOne({ _id: match._id }, { $set: { whatsappJid: remetenteJid } });
      invalidarCacheEquipe();
      jidsVerificados.add(remetenteJid);
      logger.info("JID @lid descoberto e salvo automaticamente", {
        nome: match.nome,
        jid: remetenteJid,
        numero: numeroNormalizado
      });
      return;
    }
  }

  // Fallback: se a Evolution API não devolveu número, marca como verificado
  // para não repetir a consulta nesta sessão (será tentado novamente após restart)
  jidsVerificados.add(remetenteJid);
}
