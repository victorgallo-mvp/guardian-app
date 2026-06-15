/**
 * Rotas administrativas: visão rápida do estado do sistema (grupos
 * monitorados, gasto diário de IA), protegidas por `ADMIN_TOKEN`.
 */
import { Router } from "express";
import { autenticarAdmin } from "../middlewares/auth-admin.middleware.js";
import Grupo from "../../dominio/grupo.modelo.js";
import { obterGastoDiarioUsd } from "../../core/ia/controle-custo.servico.js";
import config from "../../config/index.js";

const router = Router();

router.use(autenticarAdmin);

router.get("/status", async (req, res, next) => {
  try {
    const grupos = await Grupo.find({ clientId: config.clientId })
      .select("nomeGrupo tipo ativo pausadoAte estatisticas")
      .lean();

    const gastoHojeUsd = await obterGastoDiarioUsd(config.clientId);

    res.json({
      clientId: config.clientId,
      custo: {
        gastoHojeUsd,
        limiteDiarioUsd: config.limites.custoDiarioUsd
      },
      grupos
    });
  } catch (erro) {
    next(erro);
  }
});

export default router;
