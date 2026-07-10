import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Feedback from "../../dominio/feedback.modelo.js";
import Notificacao from "../../dominio/notificacao.modelo.js";
import Analise from "../../dominio/analise.modelo.js";
import Mensagem from "../../dominio/mensagem.modelo.js";
import config from "../../config/index.js";

const router = Router();
router.use(autenticarJwt);

// POST /api/feedback — registra feedback (👍/👎) em uma notificação
router.post("/", async (req, res) => {
  const { notificacaoId, tipo, motivo } = req.body;

  if (!notificacaoId) return res.status(400).json({ erro: "notificacaoId é obrigatório" });
  if (!["positivo", "negativo"].includes(tipo)) {
    return res.status(400).json({ erro: "tipo deve ser 'positivo' ou 'negativo'" });
  }

  const notif = await Notificacao.findOne({ _id: notificacaoId, clientId: config.clientId }).lean();
  if (!notif) return res.status(404).json({ erro: "Notificação não encontrada" });

  // Busca conteúdo da mensagem original para uso em exemplos de treinamento
  let mensagemConteudo = null;
  if (notif.analiseId) {
    const analise = await Analise.findById(notif.analiseId).select("mensagemId detectado").lean();
    if (analise?.mensagemId) {
      const msg = await Mensagem.findById(analise.mensagemId).select("conteudo").lean();
      mensagemConteudo = msg?.conteudo?.slice(0, 300) ?? null;
    }
  }

  // Upsert por analiseId — um feedback por alerta (substitui se já existia)
  const feedback = await Feedback.findOneAndUpdate(
    { clientId: config.clientId, analiseId: notif.analiseId },
    {
      $set: {
        clientId: config.clientId,
        grupoId: notif.grupoId,
        notificacaoId: notif._id,
        analiseId: notif.analiseId,
        gatilho: notif.gatilho,
        tipo,
        motivo: motivo?.trim().slice(0, 200) || null,
        mensagemConteudo,
        criadoEm: new Date()
      }
    },
    { upsert: true, new: true }
  );

  // Propaga feedbackId para todas as notificações do mesmo alerta
  await Notificacao.updateMany(
    { clientId: config.clientId, analiseId: notif.analiseId },
    { $set: { feedbackId: feedback._id } }
  );

  res.json({ ok: true, feedbackId: feedback._id, tipo });
});

// GET /api/feedback — histórico de feedbacks
router.get("/", async (req, res) => {
  const { tipo, gatilho, pagina = 1, limite = 30 } = req.query;
  const filtro = { clientId: config.clientId };
  if (tipo) filtro.tipo = tipo;
  if (gatilho) filtro.gatilho = gatilho;

  const skip = (Number(pagina) - 1) * Number(limite);
  const [dados, total] = await Promise.all([
    Feedback.find(filtro)
      .populate("grupoId", "nomeGrupo")
      .sort({ criadoEm: -1 })
      .skip(skip)
      .limit(Number(limite))
      .lean(),
    Feedback.countDocuments(filtro)
  ]);

  res.json({ dados, total, pagina: Number(pagina), limite: Number(limite) });
});

export default router;
