/**
 * Conexão com o MongoDB via Mongoose.
 *
 * Centraliza a inicialização da conexão e os listeners de eventos,
 * pra termos visibilidade de quedas/reconexões em produção.
 */
import mongoose from "mongoose";
import config from "../config/index.js";
import logger from "./logger.js";

let conectado = false;

/**
 * Conecta ao MongoDB. Idempotente: chamadas subsequentes não reconectam
 * se já existir uma conexão ativa.
 */
export async function conectarMongo() {
  if (conectado) return mongoose.connection;

  mongoose.connection.on("connected", () => {
    logger.info("MongoDB conectado");
  });

  mongoose.connection.on("error", (erro) => {
    logger.error("Erro na conexão com MongoDB", { erro: erro.message });
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB desconectado");
    conectado = false;
  });

  await mongoose.connect(config.mongo.uri);
  conectado = true;

  return mongoose.connection;
}

/** Encerra a conexão com o MongoDB. Usado em shutdown gracioso e testes. */
export async function desconectarMongo() {
  if (!conectado) return;
  await mongoose.disconnect();
  conectado = false;
}
