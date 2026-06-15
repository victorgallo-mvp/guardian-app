/**
 * Carrega, valida e expõe a configuração da aplicação.
 *
 * Lê variáveis de ambiente (via dotenv) e valida com Zod, garantindo que
 * o processo falhe rápido (fail-fast) se faltar alguma variável essencial,
 * em vez de quebrar silenciosamente em produção.
 *
 * Também carrega `cliente.yaml` como configuração de referência do cliente
 * atual (usado por scripts de cadastro e como fallback).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const esquemaEnv = z.object({
  MONGO_URI: z.string().min(1, "MONGO_URI é obrigatório"),

  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY é obrigatório"),
  MODELO_TRIAGEM: z.string().default("claude-haiku-4-5"),
  MODELO_ANALISE: z.string().default("claude-sonnet-4-5"),

  EVOLUTION_API_URL: z.string().url("EVOLUTION_API_URL deve ser uma URL válida"),
  EVOLUTION_API_KEY: z.string().min(1, "EVOLUTION_API_KEY é obrigatório"),
  EVOLUTION_INSTANCE_NAME: z.string().min(1, "EVOLUTION_INSTANCE_NAME é obrigatório"),

  CLIENT_ID: z.string().min(1, "CLIENT_ID é obrigatório"),

  LIMITE_CUSTO_DIARIO_USD: z.coerce.number().positive().default(5),
  ADMIN_TOKEN: z.string().min(8, "ADMIN_TOKEN deve ter pelo menos 8 caracteres"),

  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.string().default("info"),

  WEBHOOK_URL_BASE: z.string().url("WEBHOOK_URL_BASE deve ser uma URL válida")
});

function carregarEnv() {
  const resultado = esquemaEnv.safeParse(process.env);

  if (!resultado.success) {
    const erros = resultado.error.issues
      .map((problema) => `  - ${problema.path.join(".")}: ${problema.message}`)
      .join("\n");
    throw new Error(`Configuração inválida. Verifique seu .env:\n${erros}`);
  }

  return resultado.data;
}

function carregarConfigCliente() {
  const caminho = path.join(__dirname, "cliente.yaml");
  const conteudo = readFileSync(caminho, "utf-8");
  return parseYaml(conteudo);
}

const env = carregarEnv();
const clienteYaml = carregarConfigCliente();

const config = {
  mongo: {
    uri: env.MONGO_URI
  },

  anthropic: {
    apiKey: env.ANTHROPIC_API_KEY,
    modeloTriagem: env.MODELO_TRIAGEM,
    modeloAnalise: env.MODELO_ANALISE
  },

  evolution: {
    apiUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instanceName: env.EVOLUTION_INSTANCE_NAME
  },

  clientId: env.CLIENT_ID,
  clienteReferencia: clienteYaml,

  limites: {
    custoDiarioUsd: env.LIMITE_CUSTO_DIARIO_USD
  },

  admin: {
    token: env.ADMIN_TOKEN
  },

  servidor: {
    porta: env.PORT,
    ambiente: env.NODE_ENV,
    nivelLog: env.LOG_LEVEL
  },

  webhookUrlBase: env.WEBHOOK_URL_BASE
};

export default config;
