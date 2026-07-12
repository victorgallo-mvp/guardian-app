import { Router } from "express";
import mongoose from "mongoose";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Notificacao from "../../dominio/notificacao.modelo.js";
import config from "../../config/index.js";

const router = Router();
router.use(autenticarJwt);

const STATUS_PERMITIDOS = ["enviada", "ciente", "resolvida", "ignorada"];

/**
 * Monta o pipeline base que agrupa notificações por analiseId.
 * Cada alerta vira um documento único com lista de responsáveis notificados.
 */
function piplineBase({ matchInicial, gatilho }) {
  return [
    { $match: matchInicial },
    {
      $lookup: {
        from: "analises",
        localField: "analiseId",
        foreignField: "_id",
        as: "analise"
      }
    },
    { $unwind: { path: "$analise", preserveNullAndEmptyArrays: true } },
    ...(gatilho ? [{ $match: { "analise.detectado.gatilho": gatilho } }] : []),
    {
      $lookup: {
        from: "responsavels",
        localField: "responsavelId",
        foreignField: "_id",
        as: "responsavel"
      }
    },
    { $unwind: { path: "$responsavel", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$analiseId",
        notifId: { $first: "$_id" },
        grupoId: { $first: "$grupoId" },
        gatilho: { $first: "$analise.detectado.gatilho" },
        severidade: { $first: "$analise.detectado.severidade" },
        conteudoMensagem: { $first: "$conteudoMensagem" },
        enviadaEm: { $max: "$enviadaEm" },
        status: { $first: "$status" },
        notificadosNomes: { $addToSet: "$responsavel.nome" },
        notificadosIds: { $push: "$_id" }
      }
    },
    { $sort: { enviadaEm: -1 } },
    {
      $lookup: {
        from: "grupos",
        localField: "grupoId",
        foreignField: "_id",
        as: "grupo"
      }
    },
    { $unwind: { path: "$grupo", preserveNullAndEmptyArrays: true } }
  ];
}

router.get("/", async (req, res) => {
  const { grupoId, status, gatilho, pagina = 1, limite = 30 } = req.query;
  const skip = (Number(pagina) - 1) * Number(limite);

  const matchInicial = { clientId: config.clientId };
  if (grupoId) matchInicial.grupoId = new mongoose.Types.ObjectId(grupoId);
  if (status) matchInicial.status = status;

  const base = piplineBase({ matchInicial, gatilho });

  const [contagem, dados] = await Promise.all([
    Notificacao.aggregate([...base, { $count: "total" }]),
    Notificacao.aggregate([...base, { $skip: skip }, { $limit: Number(limite) }])
  ]);

  const total = contagem[0]?.total ?? 0;

  const resultado = dados.map((n) => ({
    _id: n.notifId,
    analiseId: n._id,
    grupoId: { _id: n.grupoId, nomeGrupo: n.grupo?.nomeGrupo, tipo: n.grupo?.tipo },
    gatilho: n.gatilho ?? null,
    severidade: n.severidade ?? null,
    conteudoMensagem: n.conteudoMensagem,
    enviadaEm: n.enviadaEm,
    status: n.status,
    notificadosNomes: n.notificadosNomes.filter(Boolean),
    notificadosIds: n.notificadosIds
  }));

  res.json({ dados: resultado, total, pagina: Number(pagina), limite: Number(limite) });
});

// Atualiza status — propaga pra todas as notifs do mesmo analiseId (demais responsáveis)
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!STATUS_PERMITIDOS.includes(status)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_PERMITIDOS.join(", ")}` });
  }
  const notificacao = await Notificacao.findOne({ _id: req.params.id, clientId: config.clientId });
  if (!notificacao) return res.status(404).json({ erro: "Notificação não encontrada" });

  await Notificacao.updateMany(
    { clientId: config.clientId, analiseId: notificacao.analiseId },
    { $set: { status } }
  );

  res.json({ ok: true, status });
});

// Ação em lote: atualiza notificações enviadas
// - { status } apenas            → todas do cliente (global)
// - { gatilhos: [...], status }  → por tipo de alerta (coluna)
// - { grupoId, status }          → por grupo (compatibilidade)
router.patch("/lote", async (req, res) => {
  const { grupoId, gatilhos, status } = req.body;
  if (!STATUS_PERMITIDOS.includes(status)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_PERMITIDOS.join(", ")}` });
  }
  const filtro = { clientId: config.clientId, status: "enviada" };
  if (grupoId)         filtro.grupoId  = new mongoose.Types.ObjectId(grupoId);
  if (gatilhos?.length) filtro.gatilho = { $in: gatilhos };

  const resultado = await Notificacao.updateMany(filtro, { $set: { status } });
  res.json({ ok: true, atualizadas: resultado.modifiedCount });
});

export default router;
