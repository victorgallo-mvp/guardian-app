import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Notificacao from "../../dominio/notificacao.modelo.js";
import config from "../../config/index.js";

const router = Router();
router.use(autenticarJwt);

const STATUS_PERMITIDOS = ["enviada", "ciente", "resolvida", "ignorada"];

router.get("/", async (req, res) => {
  const { grupoId, status, gatilho, pagina = 1, limite = 30 } = req.query;
  const filtro = { clientId: config.clientId };
  if (grupoId) filtro.grupoId = grupoId;
  if (status) filtro.status = status;

  const skip = (Number(pagina) - 1) * Number(limite);
  const [notificacoes, total] = await Promise.all([
    Notificacao.find(filtro)
      .populate("grupoId", "nomeGrupo tipo")
      .populate("responsavelId", "nome whatsappNumero")
      .populate({ path: "analiseId", select: "detectado mensagemId" })
      .sort({ enviadaEm: -1 })
      .skip(skip)
      .limit(Number(limite))
      .lean(),
    Notificacao.countDocuments(filtro)
  ]);

  const resultado = gatilho
    ? notificacoes.filter((n) => n.analiseId?.detectado?.gatilho === gatilho)
    : notificacoes;

  res.json({ dados: resultado, total: gatilho ? resultado.length : total, pagina: Number(pagina), limite: Number(limite) });
});

// Atualiza status individual
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!STATUS_PERMITIDOS.includes(status)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_PERMITIDOS.join(", ")}` });
  }
  const notificacao = await Notificacao.findOneAndUpdate(
    { _id: req.params.id, clientId: config.clientId },
    { $set: { status } },
    { new: true }
  );
  if (!notificacao) return res.status(404).json({ erro: "Notificação não encontrada" });
  res.json(notificacao);
});

// Ação em lote: atualiza todas as notificações enviadas de um grupo
router.patch("/lote", async (req, res) => {
  const { grupoId, status } = req.body;
  if (!grupoId) return res.status(400).json({ erro: "grupoId é obrigatório" });
  if (!STATUS_PERMITIDOS.includes(status)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_PERMITIDOS.join(", ")}` });
  }
  const resultado = await Notificacao.updateMany(
    { clientId: config.clientId, grupoId, status: "enviada" },
    { $set: { status } }
  );
  res.json({ ok: true, atualizadas: resultado.modifiedCount });
});

export default router;
