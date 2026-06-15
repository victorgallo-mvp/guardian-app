#!/usr/bin/env node
/**
 * Script pra testar a detecção (triagem + análise profunda) com uma
 * mensagem arbitrária, sem precisar de um webhook real. Não persiste nada.
 *
 * Uso: npm run testar-deteccao -- <idWhatsappGrupo> "texto da mensagem"
 */
import { conectarMongo, desconectarMongo } from "../src/infra/mongo.js";
import Grupo from "../src/dominio/grupo.modelo.js";
import { obterContextoRecente } from "../src/core/contexto/janela-rolante.servico.js";
import { executarTriagem } from "../src/core/ia/triagem.servico.js";
import { executarAnalise } from "../src/core/ia/analise.servico.js";
import config from "../src/config/index.js";

async function main() {
  const [idWhatsappGrupo, texto] = process.argv.slice(2);

  if (!idWhatsappGrupo || !texto) {
    console.error('Uso: npm run testar-deteccao -- <idWhatsappGrupo> "texto da mensagem"');
    process.exitCode = 1;
    return;
  }

  await conectarMongo();

  const grupo = await Grupo.findOne({ clientId: config.clientId, idWhatsappGrupo });
  if (!grupo) {
    throw new Error(`Grupo "${idWhatsappGrupo}" não encontrado pro cliente ${config.clientId}`);
  }

  const mensagem = {
    conteudo: texto,
    remetenteNome: "Teste",
    remetenteJid: "teste@s.whatsapp.net",
    recebidaEm: new Date()
  };

  const contexto = await obterContextoRecente(config.clientId, grupo._id);

  console.log(`\nGrupo: ${grupo.nomeGrupo} (${grupo.tipo})`);
  console.log(`Mensagem: "${texto}"`);
  console.log(`Contexto: ${contexto.totalContexto} mensagem(ns) anteriores\n`);

  console.log("--- Triagem (Haiku) ---");
  const triagem = await executarTriagem({ mensagem, contexto, grupo });
  console.log(JSON.stringify(triagem, null, 2));

  if (!triagem.precisaAtencao) {
    console.log("\nTriagem decidiu que não precisa de análise profunda. Fim.");
    return;
  }

  console.log("\n--- Análise profunda (Sonnet) ---");
  const analise = await executarAnalise({ mensagem, contexto, grupo });
  console.log(JSON.stringify(analise, null, 2));
}

main()
  .catch((erro) => {
    console.error("Erro:", erro.message);
    process.exitCode = 1;
  })
  .finally(() => desconectarMongo());
