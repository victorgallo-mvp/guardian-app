import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Cliente from "../../dominio/cliente.modelo.js";
import Feedback from "../../dominio/feedback.modelo.js";
import { invalidarCacheTreinamento } from "../../core/ia/construtor-prompt.js";
import config from "../../config/index.js";

const router = Router();
router.use(autenticarJwt);

const MAX_FRASES = 150;
const MAX_FRASE_CHARS = 150;
const MAX_CONTEXTO_CHARS = 800;

async function obterCliente() {
  return Cliente.findOne({ identificador: config.clientId });
}

// GET /api/treinamento — retorna estado atual do treinamento
router.get("/", async (req, res) => {
  const cliente = await obterCliente();
  const treinamento = cliente?.treinamento ?? { frasesEncerraConversa: [], contextoPersonalizado: null };
  res.json({
    frasesEncerraConversa: treinamento.frasesEncerraConversa ?? [],
    contextoPersonalizado: treinamento.contextoPersonalizado ?? null,
    limites: { maxFrases: MAX_FRASES, maxFraseChars: MAX_FRASE_CHARS, maxContextoChars: MAX_CONTEXTO_CHARS }
  });
});

// POST /api/treinamento/frases — adiciona frase de encerramento customizada
router.post("/frases", async (req, res) => {
  const { texto } = req.body;
  if (!texto?.trim()) return res.status(400).json({ erro: "texto é obrigatório" });

  const normalizado = texto.trim().slice(0, MAX_FRASE_CHARS);

  const cliente = await obterCliente();
  const frases = cliente?.treinamento?.frasesEncerraConversa ?? [];

  if (frases.length >= MAX_FRASES) {
    return res.status(400).json({ erro: `Limite de ${MAX_FRASES} frases atingido` });
  }

  const jaExiste = frases.some((f) => f.texto.toLowerCase() === normalizado.toLowerCase());
  if (jaExiste) return res.status(400).json({ erro: "Frase já cadastrada" });

  await Cliente.updateOne(
    { identificador: config.clientId },
    { $push: { "treinamento.frasesEncerraConversa": { texto: normalizado } } }
  );

  invalidarCacheTreinamento();
  res.json({ ok: true });
});

// DELETE /api/treinamento/frases/:id — remove frase por _id
router.delete("/frases/:id", async (req, res) => {
  await Cliente.updateOne(
    { identificador: config.clientId },
    { $pull: { "treinamento.frasesEncerraConversa": { _id: req.params.id } } }
  );
  invalidarCacheTreinamento();
  res.json({ ok: true });
});

// PUT /api/treinamento/contexto — atualiza contexto personalizado
router.put("/contexto", async (req, res) => {
  const { contexto } = req.body;
  const valor = (contexto ?? "").trim().slice(0, MAX_CONTEXTO_CHARS) || null;

  await Cliente.updateOne(
    { identificador: config.clientId },
    { $set: { "treinamento.contextoPersonalizado": valor } }
  );

  invalidarCacheTreinamento();
  res.json({ ok: true });
});

// GET /api/treinamento/sugestoes — feedbacks negativos recentes como sugestões de frases
router.get("/sugestoes", async (req, res) => {
  const sugestoes = await Feedback.find({ clientId: config.clientId, tipo: "negativo" })
    .populate("grupoId", "nomeGrupo")
    .sort({ criadoEm: -1 })
    .limit(20)
    .select("mensagemConteudo gatilho motivo grupoId criadoEm")
    .lean();

  res.json(sugestoes);
});

export default router;
