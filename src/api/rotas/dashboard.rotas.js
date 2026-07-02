import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Grupo from "../../dominio/grupo.modelo.js";
import Notificacao from "../../dominio/notificacao.modelo.js";
import Mensagem from "../../dominio/mensagem.modelo.js";
import Responsavel from "../../dominio/responsavel.modelo.js";
import config from "../../config/index.js";

const router = Router();
router.use(autenticarJwt);

const ORDEM_SEVERIDADE = { critico: 0, urgente: 1, atencao: 2, info: 3 };
const DIAS_SILENCIO_SUSPEITO = 3;

function inicioDoDia() {
  const dataSP = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${dataSP}T00:00:00-03:00`);
}

function piorSeveridade(severidades) {
  return severidades.reduce((melhor, s) => {
    return (ORDEM_SEVERIDADE[s] ?? 99) < (ORDEM_SEVERIDADE[melhor] ?? 99) ? s : melhor;
  }, "info");
}

// GET /api/dashboard/stats — cards do topo
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
        { $lookup: { from: "grupos", localField: "_id", foreignField: "_id", as: "grupo" } },
        { $unwind: "$grupo" },
        { $project: { _id: 0, grupoId: "$_id", nomeGrupo: "$grupo.nomeGrupo", total: 1 } }
      ]),

      Notificacao.aggregate([
        { $match: { clientId, enviadaEm: { $gte: hoje } } },
        { $lookup: { from: "analises", localField: "analiseId", foreignField: "_id", as: "analise" } },
        { $unwind: { path: "$analise", preserveNullAndEmptyArrays: true } },
        { $group: { _id: "$analise.detectado.gatilho", total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $project: { _id: 0, gatilho: "$_id", total: 1 } }
      ])
    ]);

  res.json({ gruposAtivos, notificacoesHoje, notificacoesPendentes, topGrupos: topGruposRaw, porGatilho: porGatilhoRaw });
});

// GET /api/dashboard/grupos-alertas — visão por grupo com notificações pendentes inline
router.get("/grupos-alertas", async (req, res) => {
  const clientId = config.clientId;
  const { todos } = req.query; // ?todos=true → inclui grupos sem alertas

  // 1. Todos os grupos ativos
  const grupos = await Grupo.find({ clientId, ativo: true })
    .select("_id nomeGrupo tipo pausadoAte")
    .sort({ nomeGrupo: 1 })
    .lean();

  const grupoIds = grupos.map((g) => g._id);

  // 2. Notificações pendentes com severidade (via analise)
  const notificacoesPendentes = await Notificacao.aggregate([
    { $match: { clientId, status: "enviada", grupoId: { $in: grupoIds } } },
    {
      $lookup: {
        from: "analises",
        localField: "analiseId",
        foreignField: "_id",
        as: "analise"
      }
    },
    { $unwind: { path: "$analise", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        grupoId: 1,
        analiseId: 1,
        conteudoMensagem: 1,
        enviadaEm: 1,
        responsavelId: 1,
        severidade: "$analise.detectado.severidade",
        gatilho: "$analise.detectado.gatilho"
      }
    },
    { $sort: { enviadaEm: -1 } }
  ]);

  // Popula responsavelId em batch
  const respIds = [...new Set(notificacoesPendentes.map((n) => n.responsavelId?.toString()).filter(Boolean))];
  const responsaveis = await Responsavel.find({ _id: { $in: respIds } }).select("nome").lean();
  const mapResp = Object.fromEntries(responsaveis.map((r) => [r._id.toString(), r.nome]));

  // 3. Última mensagem por grupo (para silêncio suspeito)
  const limitesSilencio = new Date(Date.now() - DIAS_SILENCIO_SUSPEITO * 24 * 60 * 60 * 1000);
  const ultimasMensagens = await Mensagem.aggregate([
    { $match: { grupoId: { $in: grupoIds }, recebidaEm: { $exists: true } } },
    { $group: { _id: "$grupoId", ultimaEm: { $max: "$recebidaEm" } } }
  ]);
  const mapUltimaMensagem = Object.fromEntries(ultimasMensagens.map((u) => [u._id.toString(), u.ultimaEm]));

  // 4. Agrupa notificações por grupo, deduplicando por analiseId
  // (mesmo evento gera 1 notificação por responsável — exibimos como 1 card com lista de notificados)
  const notifPorGrupo = {};
  for (const n of notificacoesPendentes) {
    const gid = n.grupoId.toString();
    const aid = n.analiseId?.toString() ?? n._id.toString();
    if (!notifPorGrupo[gid]) notifPorGrupo[gid] = {};

    if (!notifPorGrupo[gid][aid]) {
      notifPorGrupo[gid][aid] = {
        _id: n._id,          // id da primeira notif (usado para ações individuais)
        analiseId: n.analiseId,
        conteudoMensagem: n.conteudoMensagem,
        enviadaEm: n.enviadaEm,
        severidade: n.severidade ?? "info",
        gatilho: n.gatilho ?? null,
        notificadosIds: [],
        notificadosNomes: []
      };
    }

    const nome = mapResp[n.responsavelId?.toString()];
    notifPorGrupo[gid][aid].notificadosIds.push(n._id);
    if (nome) notifPorGrupo[gid][aid].notificadosNomes.push(nome);
  }

  // 5. Monta resultado
  const agora = new Date();
  const resultado = grupos
    .map((g) => {
      const gid = g._id.toString();
      const notifs = Object.values(notifPorGrupo[gid] ?? {});
      const severidades = notifs.map((n) => n.severidade);
      const ultimaMsgEm = mapUltimaMensagem[gid] ?? null;
      const emSnooze = g.pausadoAte && new Date(g.pausadoAte) > agora;
      const silencioSuspeito = !emSnooze && ultimaMsgEm && new Date(ultimaMsgEm) < limitesSilencio;

      return {
        grupoId: g._id,
        nomeGrupo: g.nomeGrupo,
        tipo: g.tipo,
        emSnooze,
        pausadoAte: g.pausadoAte,
        silencioSuspeito: !!silencioSuspeito,
        ultimaMensagemEm: ultimaMsgEm,
        alertas: {
          total: notifs.length,
          piorSeveridade: notifs.length ? piorSeveridade(severidades) : null,
          ultimaEm: notifs[0]?.enviadaEm ?? null
        },
        notificacoesPendentes: notifs
      };
    })
    .filter((g) => todos === "true" || g.alertas.total > 0 || g.silencioSuspeito)
    .sort((a, b) => {
      // Snooze vai para o fim
      if (a.emSnooze !== b.emSnooze) return a.emSnooze ? 1 : -1;
      // Primário: notificação mais recente primeiro
      const dtA = new Date(a.alertas.ultimaEm ?? 0).getTime();
      const dtB = new Date(b.alertas.ultimaEm ?? 0).getTime();
      if (dtB !== dtA) return dtB - dtA;
      // Empate: pior severidade
      const sa = ORDEM_SEVERIDADE[a.alertas.piorSeveridade] ?? 99;
      const sb = ORDEM_SEVERIDADE[b.alertas.piorSeveridade] ?? 99;
      return sa - sb;
    });

  res.json(resultado);
});

export default router;
