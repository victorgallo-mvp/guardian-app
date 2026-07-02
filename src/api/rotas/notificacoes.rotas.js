import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Notificacao from "../../dominio/notificacao.modelo.js";
import config from "../../config/index.js";

const router = Router();
router.use(autenticarJwt);

router.get("/", async (req, res) => {
  const { grupoId, status, gatilho, pagina = 1, limite = 30 } = req.query;
  const filtro = { clientId: config.clientId };

  if (grupoId) filtro.grupoId = grupoId;
  if (status) filtro.status = status;

  const skip = (Number(pagina) - 1) * Number(limite);

  let query = Notificacao.find(filtro)
    .populate("grupoId", "nomeGrupo tipo")
    .populate("responsavelId", "nome whatsappNumero")
    .populate({ path: "analiseId", select: "detectado mensagemId" })
    .sort({ enviadaEm: -1 })
    .skip(skip)
    .limit(Number(limite));

  const [notificacoes, total] = await Promise.all([query.lean(), Notificacao.countDocuments(filtro)]);

  // Filtra por gatilho se informado (vem do populate da analise)
  const resultado = gatilho
    ? notificacoes.filter((n) => n.analiseId?.detectado?.gatilho === gatilho)
    : notificacoes;

  res.json({
    dados: resultado,
    total: gatilho ? resultado.length : total,
    pagina: Number(pagina),
    limite: Number(limite)
  });
});

// Atualiza status (ciente / resolvida / enviada)
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body;
  const statusPermitidos = ["enviada", "ciente", "resolvida", "ignorada"];

  if (!statusPermitidos.includes(status)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${statusPermitidos.join(", ")}` });
  }

  const notificacao = await Notificacao.findOneAndUpdate(
    { _id: req.params.id, clientId: config.clientId },
    { $set: { status } },
    { new: true }
  );

  if (!notificacao) return res.status(404).json({ erro: "Notificação não encontrada" });
  res.json(notificacao);
});

export default router;
