import { Router } from "express";
import { autenticarJwt } from "../middlewares/auth-jwt.middleware.js";
import Relatorio from "../../dominio/relatorio.modelo.js";
import { compilarRelatorioSemanal } from "../../core/relatorio/compilador.js";
import { clienteEvolutionPadrao } from "../../infra/evolution-client.js";
import config from "../../config/index.js";
import logger from "../../infra/logger.js";

const router = Router();
router.use(autenticarJwt);

router.get("/", async (req, res) => {
  const relatorios = await Relatorio.find({ clientId: config.clientId })
    .sort({ criadoEm: -1 })
    .limit(12)
    .lean();
  res.json(relatorios);
});

router.get("/:id", async (req, res) => {
  const relatorio = await Relatorio.findOne({
    _id: req.params.id,
    clientId: config.clientId
  }).lean();
  if (!relatorio) return res.status(404).json({ erro: "Relatório não encontrado" });
  res.json(relatorio);
});

router.post("/gerar", async (req, res) => {
  try {
    const agora = new Date();
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dataSP = seteDiasAtras.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const semanaInicio = new Date(`${dataSP}T00:00:00-03:00`);
    const semanaFim = agora;

    const { grupos, textoWhatsapp } = await compilarRelatorioSemanal(semanaInicio, semanaFim);

    let idMensagemEnviada = null;
    try {
      const resposta = await clienteEvolutionPadrao.post(
        `/message/sendText/${config.evolution.instanceName}`,
        { number: config.notificacao.grupoJid, text: textoWhatsapp }
      );
      idMensagemEnviada = resposta?.key?.id ?? null;
    } catch (erroWpp) {
      logger.warn("Relatório gerado mas falha ao enviar WhatsApp", { erro: erroWpp.message });
    }

    const relatorio = await Relatorio.create({
      clientId: config.clientId,
      semanaInicio,
      semanaFim,
      textoWhatsapp,
      grupos,
      idMensagemEnviada
    });

    res.json(relatorio);
  } catch (erro) {
    logger.error("Falha ao gerar relatório semanal via API", { erro: erro.message });
    res.status(500).json({ erro: "Falha ao gerar relatório. Tente novamente." });
  }
});

export default router;
