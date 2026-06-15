#!/usr/bin/env node
/**
 * Script de cadastro de um novo grupo monitorado.
 *
 * Uso: npm run cadastrar-grupo
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { conectarMongo, desconectarMongo } from "../src/infra/mongo.js";
import Grupo from "../src/dominio/grupo.modelo.js";
import Responsavel from "../src/dominio/responsavel.modelo.js";
import { TIPOS_GRUPO_VALIDOS, obterGatilhosAplicaveis } from "../src/core/gatilhos/catalogo.gatilhos.js";
import config from "../src/config/index.js";

const rl = createInterface({ input: stdin, output: stdout });

async function perguntar(pergunta, padrao) {
  const sufixo = padrao ? ` (${padrao})` : "";
  const resposta = await rl.question(`${pergunta}${sufixo}: `);
  return resposta.trim() || padrao || "";
}

async function main() {
  await conectarMongo();

  console.log(`Cadastrando grupo pro cliente: ${config.clientId}\n`);

  const idWhatsappGrupo = await perguntar("JID do grupo (ex: 120363xxxxxxxxxx@g.us)");
  const nomeGrupo = await perguntar("Nome do grupo");
  const descricao = await perguntar("Descrição (opcional)");

  let tipo = await perguntar(`Tipo (${TIPOS_GRUPO_VALIDOS.join("/")})`);
  while (!TIPOS_GRUPO_VALIDOS.includes(tipo)) {
    tipo = await perguntar(`Tipo inválido. Opções: ${TIPOS_GRUPO_VALIDOS.join("/")}`);
  }

  const responsaveisDisponiveis = await Responsavel.find({ clientId: config.clientId, ativo: true });
  let responsaveisIds = [];

  if (responsaveisDisponiveis.length) {
    console.log("\nResponsáveis disponíveis:");
    responsaveisDisponiveis.forEach((r, i) => console.log(`  ${i + 1}. ${r.nome} (${r.papel})`));
    const escolha = await perguntar("Números dos responsáveis (separados por vírgula, opcional)");
    responsaveisIds = escolha
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => responsaveisDisponiveis[Number(n) - 1]?._id)
      .filter(Boolean);
  } else {
    console.log("\nNenhum responsável cadastrado ainda — cadastre depois com `npm run cadastrar-responsavel`.");
  }

  const gatilhosAplicaveis = obterGatilhosAplicaveis(tipo);
  console.log(`\nGatilhos aplicáveis a grupos do tipo "${tipo}":`);
  gatilhosAplicaveis.forEach((g) => console.log(`  - ${g.id}: ${g.nome}`));
  console.log("(todos ficam ativos por padrão — `gatilhosAtivos` vazio significa \"todos aplicáveis\")");

  const grupo = await Grupo.create({
    clientId: config.clientId,
    idWhatsappGrupo,
    nomeGrupo,
    descricao,
    tipo,
    responsaveis: responsaveisIds
  });

  console.log(`\n✅ Grupo cadastrado: ${grupo.nomeGrupo} (${grupo._id})`);
}

main()
  .catch((erro) => {
    console.error("Erro ao cadastrar grupo:", erro.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await desconectarMongo();
  });
