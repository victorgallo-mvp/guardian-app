import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Grupo from "../../dominio/grupo.modelo.js";
import Responsavel from "../../dominio/responsavel.modelo.js";
import config from "../../config/index.js";
import { CATALOGO_GATILHOS, obterGatilhosAplicaveis } from "../../core/gatilhos/catalogo.gatilhos.js";

const router = Router();
router.use(autenticarJwt);

// Lista todos os grupos (com stats resumidas)
router.get("/", async (req, res) => {
  const { ativo, tipo } = req.query;
  const filtro = { clientId: config.clientId };
  if (ativo !== undefined) filtro.ativo = ativo === "true";
  if (tipo) filtro.tipo = tipo;

  const grupos = await Grupo.find(filtro)
    .populate("responsaveis", "nome whatsappNumero")
    .sort({ nomeGrupo: 1 })
    .lean();

  res.json(grupos);
});

// Cria novo grupo
router.post("/", async (req, res) => {
  const {
    idWhatsappGrupo,
    nomeGrupo,
    descricao,
    tipo,
    responsaveis = [],
    configuracoesEspecificas = {},
    membrosAgencia = []
  } = req.body;

  if (!idWhatsappGrupo || !nomeGrupo || !tipo) {
    return res.status(400).json({ erro: "idWhatsappGrupo, nomeGrupo e tipo são obrigatórios" });
  }

  const existente = await Grupo.findOne({ idWhatsappGrupo });
  if (existente) {
    return res.status(409).json({ erro: "Grupo já cadastrado", grupoId: existente._id });
  }

  const grupo = await Grupo.create({
    clientId: config.clientId,
    idWhatsappGrupo,
    nomeGrupo,
    descricao,
    tipo,
    responsaveis,
    configuracoesEspecificas,
    membrosAgencia,
    gatilhosDesativados: []
  });

  res.status(201).json(grupo);
});

// Detalhes de um grupo
router.get("/:id", async (req, res) => {
  const grupo = await Grupo.findOne({ _id: req.params.id, clientId: config.clientId })
    .populate("responsaveis", "nome whatsappNumero cargo")
    .lean();
  if (!grupo) return res.status(404).json({ erro: "Grupo não encontrado" });

  // Inclui gatilhos aplicáveis ao tipo com flag de ativo/inativo
  const gatilhosAplicaveis = obterGatilhosAplicaveis(grupo.tipo).map((g) => ({
    ...g,
    ativo: !(grupo.gatilhosDesativados ?? []).includes(g.id)
  }));

  res.json({ ...grupo, gatilhosAplicaveis });
});

// Atualiza grupo
router.put("/:id", async (req, res) => {
  const permitidos = [
    "nomeGrupo",
    "descricao",
    "tipo",
    "responsaveis",
    "ativo",
    "pausadoAte",
    "membrosAgencia",
    "gatilhosDesativados",
    "configuracoesEspecificas"
  ];
  const atualizacao = {};
  for (const campo of permitidos) {
    if (req.body[campo] !== undefined) atualizacao[campo] = req.body[campo];
  }

  const grupo = await Grupo.findOneAndUpdate(
    { _id: req.params.id, clientId: config.clientId },
    { $set: atualizacao },
    { new: true, runValidators: true }
  ).populate("responsaveis", "nome whatsappNumero cargo");

  if (!grupo) return res.status(404).json({ erro: "Grupo não encontrado" });
  res.json(grupo);
});

// Desativa monitoramento (soft delete)
router.delete("/:id", async (req, res) => {
  const grupo = await Grupo.findOneAndUpdate(
    { _id: req.params.id, clientId: config.clientId },
    { $set: { ativo: false } },
    { new: true }
  );
  if (!grupo) return res.status(404).json({ erro: "Grupo não encontrado" });
  res.json({ ok: true, mensagem: "Monitoramento desativado" });
});

export default router;
