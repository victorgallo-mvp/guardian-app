/**
 * Cliente Anthropic configurado para uso em todo o pipeline de IA.
 *
 * Centraliza a instância do SDK pra garantir configuração consistente
 * (API key) e facilitar mocks nos testes (basta mockar este módulo).
 */
import Anthropic from "@anthropic-ai/sdk";
import config from "../../config/index.js";

const clienteClaude = new Anthropic({
  apiKey: config.anthropic.apiKey
});

export default clienteClaude;
