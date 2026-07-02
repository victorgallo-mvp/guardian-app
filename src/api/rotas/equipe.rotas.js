import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Funcionario from "../../dominio/funcionario.modelo.js";
import { invalidarCacheEquipe } from "../../core/ia/construtor-prompt.js";
import config from "../../config/index.js";

const router = Router();
router.use(autenticarJwt);

router.get("/", async (req, res) => {
  const { ativo } = req.query;
  const filtro = { clientId: config.clientId };
  if (ativo !== undefined) filtro.ativo = ativo === "true";

  const equipe = await Funcionario.find(filtro).sort({ nome: 1 }).lean();
  res.json(equipe);
});

router.post("/", async (req, res) => {
  const { nome, cargo, whatsappJid } = req.body;
  if (!nome) return res.status(400).json({ erro: "nome é obrigatório" });

  const jidFormatado = whatsappJid
    ? whatsappJid.includes("@") ? whatsappJid : `${whatsappJid}@s.whatsapp.net`
    : null;

  const funcionario = await Funcionario.create({
    clientId: config.clientId,
    nome,
    cargo: cargo ?? "",
    whatsappJid: jidFormatado
  });

  invalidarCacheEquipe();
  res.status(201).json(funcionario);
});

router.put("/:id", async (req, res) => {
  const { nome, cargo, whatsappJid, ativo } = req.body;
  const atualizacao = {};
  if (nome !== undefined) atualizacao.nome = nome;
  if (cargo !== undefined) atualizacao.cargo = cargo;
  if (ativo !== undefined) atualizacao.ativo = ativo;
  if (whatsappJid !== undefined) {
    atualizacao.whatsappJid = whatsappJid
      ? whatsappJid.includes("@") ? whatsappJid : `${whatsappJid}@s.whatsapp.net`
      : null;
  }

  const funcionario = await Funcionario.findOneAndUpdate(
    { _id: req.params.id, clientId: config.clientId },
    { $set: atualizacao },
    { new: true, runValidators: true }
  );

  if (!funcionario) return res.status(404).json({ erro: "Funcionário não encontrado" });
  invalidarCacheEquipe();
  res.json(funcionario);
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
