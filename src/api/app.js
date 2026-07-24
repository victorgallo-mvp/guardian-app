import express from "express";
import cors from "cors";
import config from "../config/index.js";
import webhookRotas from "./rotas/webhook.rotas.js";
import adminRotas from "./rotas/admin.rotas.js";
import authRotas from "./rotas/auth.rotas.js";
import dashboardRotas from "./rotas/dashboard.rotas.js";
import gruposApiRotas from "./rotas/grupos-api.rotas.js";
import notificacoesRotas from "./rotas/notificacoes.rotas.js";
import equipeRotas from "./rotas/equipe.rotas.js";
import catalogoRotas from "./rotas/catalogo.rotas.js";
import configRotas from "./rotas/config.rotas.js";
import feedbackRotas from "./rotas/feedback.rotas.js";
import treinamentoRotas from "./rotas/treinamento.rotas.js";
import relatoriosRotas from "./rotas/relatorios.rotas.js";
import { tratadorErros } from "./middlewares/tratador-erros.middleware.js";

const app = express();

app.use(cors({ origin: config.dashboard.corsOrigin, credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.get("/", (req, res) => {
  res.json({ status: "ok", servico: "guardiao-wpp" });
});

app.use("/webhook", webhookRotas);
app.use("/admin", adminRotas);

// Dashboard API
app.use("/api/auth", authRotas);
app.use("/api/dashboard", dashboardRotas);
app.use("/api/grupos", gruposApiRotas);
app.use("/api/notificacoes", notificacoesRotas);
app.use("/api/equipe", equipeRotas);
app.use("/api/catalogo", catalogoRotas);
app.use("/api/config", configRotas);
app.use("/api/feedback", feedbackRotas);
app.use("/api/treinamento", treinamentoRotas);
app.use("/api/relatorios", relatoriosRotas);

app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada" });
});

app.use(tratadorErros);

export default app;
