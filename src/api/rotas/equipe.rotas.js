import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Funcionario from "../../dominio/funcionario.modelo.js";
import { invalidarCacheEquipe } from "../../core/ia/construtor-prompt.js";
import config from "../../config/index.js";

const router = Router();
router.use(autenticarJwt);

/** Normaliza número para formato E.164 sem símbolo (ex: "5537980886497"). */
function normalizarNumero(numero) {
  const soDigitos = numero.replace(/\D/g, "");
  if (soDigitos.startsWith("55") && soDigitos.length >= 12) return soDigitos;
  return `55${soDigitos}`;
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

  const numeroNormalizado = whatsappNumero?.trim() ? normalizarNumero(whatsappNumero) : null;

  const funcionario = await Funcionario.create({
    clientId: config.clientId,
    nome,
    cargo: cargo ?? "",
    whatsappNumero: numeroNormalizado,
    whatsappJid: null
  });

  invalidarCacheEquipe();
  res.status(201).json(funcionario.toObject());
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
      atualizacao.whatsappJid = null; // auto-descoberto passivamente via webhook
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
  const resultado = await Funcionario.deleteOne({ _id: req.params.id, clientId: config.clientId });
  if (!resultado.deletedCount) return res.status(404).json({ erro: "Funcionário não encontrado" });
  invalidarCacheEquipe();
  res.json({ ok: true });
});

export default router;
