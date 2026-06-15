#!/usr/bin/env node
/**
 * Script de cadastro de um novo responsável (quem recebe as notificações).
 *
 * Uso: npm run cadastrar-responsavel
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { conectarMongo, desconectarMongo } from "../src/infra/mongo.js";
import Responsavel from "../src/dominio/responsavel.modelo.js";
import config from "../src/config/index.js";

const PAPEIS_VALIDOS = ["gerente_atendimento", "diretor", "supervisor", "operador"];

const rl = createInterface({ input: stdin, output: stdout });

async function perguntar(pergunta, padrao) {
  const sufixo = padrao ? ` (${padrao})` : "";
  const resposta = await rl.question(`${pergunta}${sufixo}: `);
  return resposta.trim() || padrao || "";
}

async function main() {
  await conectarMongo();

  console.log(`Cadastrando responsável pro cliente: ${config.clientId}\n`);

  const nome = await perguntar("Nome");

  let papel = await perguntar(`Papel (${PAPEIS_VALIDOS.join("/")})`);
  while (!PAPEIS_VALIDOS.includes(papel)) {
    papel = await perguntar(`Papel inválido. Opções: ${PAPEIS_VALIDOS.join("/")}`);
  }

  const numeroBruto = await perguntar("Número de WhatsApp (com DDI, ex: 5511999999999)");
  const whatsappNumero = numeroBruto.replace(/\D/g, "");

  const receberRelatorioDiario = (await perguntar("Receber relatório diário? (s/n)", "s"))
    .toLowerCase()
    .startsWith("s");

  const responsavel = await Responsavel.create({
    clientId: config.clientId,
    nome,
    papel,
    whatsappNumero,
    preferencias: { receberRelatorioDiario }
  });

  console.log(`\n✅ Responsável cadastrado: ${responsavel.nome} (${responsavel._id})`);
  console.log("Lembre-se de vincular este responsável a grupos com `npm run cadastrar-grupo`.");
}

main()
  .catch((erro) => {
    console.error("Erro ao cadastrar responsável:", erro.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await desconectarMongo();
  });
