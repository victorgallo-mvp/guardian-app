/**
 * Rota do webhook da Evolution API.
 *
 * Configure a URL pública `${WEBHOOK_URL_BASE}/webhook` como webhook geral
 * da instância na Evolution API (evento `messages.upsert`).
 */
import { Router } from "express";
import { tratarWebhookEvolution } from "../webhooks/evolution.webhook.js";

const router = Router();

router.post("/", tratarWebhookEvolution);

export default router;
