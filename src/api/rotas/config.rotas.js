import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Cliente from "../../dominio/cliente.modelo.js";
import { CATALOGO_GATILHOS } from "../../core/gatilhos/catalogo.gatilhos.js";
import config from "../../config/index.js";

const router = Router();
router.use(autenticarJwt);

router.get("/", async (req, res) => {
  const cliente = await Cliente.findOne({ identificador: config.clientId }).lean();
  if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado no banco" });

  const gatilhos = Object.entries(CATALOGO_GATILHOS).map(([id, g]) => ({
    id,
    nome: g.nome,
    descricao: g.descricao,
    severidadePadrao: g.severidadePadrao,
    aplicavelEm: g.aplicavelEm,
    ativo: !(cliente.gatilhosDesativados ?? []).includes(id)
  }));

  res.json({
    nivelSensibilidadePadrao: cliente.configuracoes?.nivelSensibilidadePadrao ?? "medio",
    horarioSilenciosoInicio: cliente.configuracoes?.horarioSilenciosoInicio ?? "22:00",
    horarioSilenciosoFim: cliente.configuracoes?.horarioSilenciosoFim ?? "08:00",
    gatilhosDesativados: cliente.gatilhosDesativados ?? [],
    gatilhos
  });
});

router.put("/", async (req, res) => {
  const { nivelSensibilidadePadrao, horarioSilenciosoInicio, horarioSilenciosoFim, gatilhosDesativados } = req.body;
  const atualizacao = {};

  if (nivelSensibilidadePadrao) atualizacao["configuracoes.nivelSensibilidadePadrao"] = nivelSensibilidadePadrao;
  if (horarioSilenciosoInicio) atualizacao["configuracoes.horarioSilenciosoInicio"] = horarioSilenciosoInicio;
  if (horarioSilenciosoFim) atualizacao["configuracoes.horarioSilenciosoFim"] = horarioSilenciosoFim;
  if (gatilhosDesativados !== undefined) atualizacao.gatilhosDesativados = gatilhosDesativados;

  const cliente = await Cliente.findOneAndUpdate(
    { identificador: config.clientId },
    { $set: atualizacao },
    { new: true, runValidators: true }
  );

  if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado no banco" });
  res.json({ ok: true, gatilhosDesativados: cliente.gatilhosDesativados });
});

export default router;
