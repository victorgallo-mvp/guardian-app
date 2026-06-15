/**
 * Logger estruturado da aplicação, baseado em Winston.
 *
 * Centraliza a configuração de logs pra garantir formato consistente
 * (timestamp, nível, contexto) em todos os módulos. Nunca usar console.log
 * diretamente em código de produção — sempre importar este logger.
 */
import winston from "winston";

const { combine, timestamp, printf, colorize, json } = winston.format;

const formatoConsole = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaTexto = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${ts} [${level}] ${message}${metaTexto}`;
});

const transportes = [
  new winston.transports.Console({
    format: combine(colorize(), timestamp({ format: "HH:mm:ss" }), formatoConsole)
  })
];

// Em produção também escreve em formato JSON, mais fácil de agregar em
// ferramentas de observabilidade (ex: Railway logs, Datadog, etc).
if (process.env.NODE_ENV === "production") {
  transportes.push(
    new winston.transports.File({
      filename: "logs/app.log",
      format: combine(timestamp(), json())
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(timestamp(), json()),
  transports: transportes
});

export default logger;
