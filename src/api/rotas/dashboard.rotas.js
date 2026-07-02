import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Grupo from "../../dominio/grupo.modelo.js";
import Notificacao from "../../dominio/notificacao.modelo.js";
import Mensagem from "../../dominio/mensagem.modelo.js";
import config from "../../config/index.js";

const router = Router();
router.use(autenticarJwt);

function inicioDoDia() {
  const dataSP = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${dataSP}T00:00:00-03:00`);
}

router.get("/stats", async (req, res) => {
  const hoje = inicioDoDia();
  const clientId = config.clientId;

  const [gruposAtivos, notificacoesHoje, notificacoesPendentes, topGruposRaw, porGatilhoRaw] =
    await Promise.all([
      Grupo.countDocuments({ clientId, ativo: true }),

      Notificacao.countDocuments({ clientId, enviadaEm: { $gte: hoje } }),

      Notificacao.countDocuments({ clientId, status: "enviada" }),

      Notificacao.aggregate([
        { $match: { clientId, enviadaEm: { $gte: hoje } } },
        { $group: { _id: "$grupoId", total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "grupos",
            localField: "_id",
            foreignField: "_id",
            as: "grupo"
          }
        },
        { $unwind: "$grupo" },
        { $project: { _id: 0, grupoId: "$_id", nomeGrupo: "$grupo.nomeGrupo", total: 1 } }
      ]),

      Notificacao.aggregate([
        { $match: { clientId, enviadaEm: { $gte: hoje } } },
        {
          $lookup: {
            from: "analises",
            localField: "analiseId",
            foreignField: "_id",
            as: "analise"
          }
        },
        { $unwind: { path: "$analise", preserveNullAndEmptyArrays: true } },
        { $group: { _id: "$analise.detectado.gatilho", total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $project: { _id: 0, gatilho: "$_id", total: 1 } }
      ])
    ]);

  res.json({
    gruposAtivos,
    notificacoesHoje,
    notificacoesPendentes,
    topGrupos: topGruposRaw,
    porGatilho: porGatilhoRaw
  });
});

export default router;
