import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Funcionario from "../../dominio/funcionario.modelo.js";
import { invalidarCacheEquipe } from "../../core/ia/construtor-prompt.js";
import { clienteEvolutionPadrao } from "../../infra/evolution-client.js";
import config from "../../config/index.js";
import logger from "../../infra/logger.js";

const router = Router();
router.use(autenticarJwt);

/** Normaliza número para formato E.164 sem símbolo (ex: "5537980886497"). */
function normalizarNumero(numero) {
  const soDigitos = numero.replace(/\D/g, "");
  if (soDigitos.startsWith("55") && soDigitos.length >= 12) return soDigitos;
  return `55${soDigitos}`;
}

/**
 * Consulta a Evolution API para descobrir o JID real do número.
 * Retorna o JID (ex: "208808810954881@lid") ou null se não encontrado.
 */
async function resolverJidViaEvolution(numero) {
  try {
    const resposta = await clienteEvolutionPadrao.post(
      `/chat/whatsappNumbers/${config.evolution.instanceName}`,
      { numbers: [numero] }
    );
    const contato = Array.isArray(resposta) ? resposta[0] : null;
    if (contato?.exists && contato?.jid) return contato.jid;
    return null;
  } catch (erro) {
    logger.warn("Não foi possível resolver JID via Evolution API", { numero, erro: erro.message });
    return null;
  }
}

router.get("/", async (req, res) => {
  const { ativo } = req.query;
  const filtro = { clientId: config.clientId };
  if (ativo !== undefined) filtro.ativo = ativo === "true";

  const equipe = await Funcionario.find(filtro).sort({ nome: 1 }).lean();
  res.json(equipe);
});

router.post("/", async (req, res) => {
  const { nome, cargo, whatsappNumero } = req.body;
  if (!nome) return res.status(400).json({ erro: "nome é obrigatório" });

  let whatsappJid = null;
  let numeroNormalizado = null;

  if (whatsappNumero?.trim()) {
    numeroNormalizado = normalizarNumero(whatsappNumero);
    whatsappJid = await resolverJidViaEvolution(numeroNormalizado);
  }

  const funcionario = await Funcionario.create({
    clientId: config.clientId,
    nome,
    cargo: cargo ?? "",
    whatsappNumero: numeroNormalizado,
    whatsappJid
  });

  invalidarCacheEquipe();
  res.status(201).json({ ...funcionario.toObject(), jidResolvido: !!whatsappJid });
});

router.put("/:id", async (req, res) => {
  const { nome, cargo, whatsappNumero, ativo } = req.body;
  const atualizacao = {};
  if (nome !== undefined) atualizacao.nome = nome;
  if (cargo !== undefined) atualizacao.cargo = cargo;
  if (ativo !== undefined) atualizacao.ativo = ativo;

  if (whatsappNumero !== undefined) {
    if (whatsappNumero?.trim()) {
      atualizacao.whatsappNumero = normalizarNumero(whatsappNumero);
      atualizacao.whatsappJid = await resolverJidViaEvolution(atualizacao.whatsappNumero);
    } else {
      atualizacao.whatsappNumero = null;
      atualizacao.whatsappJid = null;
    }
  }

  const funcionario = await Funcionario.findOneAndUpdate(
    { _id: req.params.id, clientId: config.clientId },
    { $set: atualizacao },
    { new: true, runValidators: true }
  );

  if (!funcionario) return res.status(404).json({ erro: "Funcionário não encontrado" });
  invalidarCacheEquipe();
  res.json({ ...funcionario.toObject(), jidResolvido: !!funcionario.whatsappJid });
});

router.delete("/:id", async (req, res) => {
  const funcionario = await Funcionario.findOneAndUpdate(
    { _id: req.params.id, clientId: config.clientId },
    { $set: { ativo: false } },
    { new: true }
  );
  if (!funcionario) return res.status(404).json({ erro: "Funcionário não encontrado" });
  invalidarCacheEquipe();
  res.json({ ok: true });
});

export default router;
