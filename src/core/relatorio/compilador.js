import Grupo from "../../dominio/grupo.modelo.js";
import config from "../../config/index.js";
import logger from "../../infra/logger.js";
import { agregarDadosGrupo } from "./agregador-grupo.servico.js";
import { gerarResumoGrupo } from "./construtor-grupo.js";

const CATEGORIA_LABEL = {
  alerta_aberto: "🔴 Alertas em aberto",
  com_pendencia: "🟡 Com pendências resolvidas",
  sem_pendencia: "🟢 Sem pendências",
  sem_atividade: "⚪ Sem atividade"
};

function primeiraSentenca(texto) {
  const match = texto.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : texto.slice(0, 130);
}

export async function compilarRelatorioSemanal(semanaInicio, semanaFim) {
  const grupos = await Grupo.find({
    clientId: config.clientId,
    ativo: true,
    tipo: { $ne: "interno" }
  }).lean();

  const resultados = await Promise.all(
    grupos.map(async (grupo) => {
      try {
        const dados = await agregarDadosGrupo(grupo._id, semanaInicio, semanaFim);
        const { resumo, categoria } = await gerarResumoGrupo(grupo, dados);
        return {
          grupoId: grupo._id,
          nomeGrupo: grupo.nomeGrupo,
          categoria,
          resumo,
          totalMensagens: dados.mensagens.length,
          totalAlertas: dados.alertas.length,
          alertasAbertos: dados.alertasAbertos
        };
      } catch (erro) {
        logger.error("Falha ao gerar resumo do grupo no relatório semanal", {
          grupoId: grupo._id,
          nomeGrupo: grupo.nomeGrupo,
          erro: erro.message
        });
        return {
          grupoId: grupo._id,
          nomeGrupo: grupo.nomeGrupo,
          categoria: "sem_pendencia",
          resumo: "Não foi possível gerar o resumo desta semana.",
          totalMensagens: 0,
          totalAlertas: 0,
          alertasAbertos: 0
        };
      }
    })
  );

  const porCategoria = {
    alerta_aberto: resultados.filter((r) => r.categoria === "alerta_aberto"),
    com_pendencia: resultados.filter((r) => r.categoria === "com_pendencia"),
    sem_pendencia: resultados.filter((r) => r.categoria === "sem_pendencia"),
    sem_atividade: resultados.filter((r) => r.categoria === "sem_atividade")
  };

  const dataInicio = semanaInicio.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const dataFim = semanaFim.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const linhas = [
    `📊 *Relatório Semanal — ${dataInicio} a ${dataFim}*`,
    `${grupos.length} grupos monitorados`,
    ""
  ];

  // Detalhes para grupos que precisam de atenção
  for (const cat of ["alerta_aberto", "com_pendencia"]) {
    const lista = porCategoria[cat];
    if (!lista.length) continue;
    linhas.push(`*${CATEGORIA_LABEL[cat]}* (${lista.length})`);
    for (const g of lista) {
      linhas.push(`• *${g.nomeGrupo}* — ${primeiraSentenca(g.resumo)}`);
    }
    linhas.push("");
  }

  // Grupos sem problema: só contagem
  const totalSemPendencia = porCategoria.sem_pendencia.length;
  const totalSemAtividade = porCategoria.sem_atividade.length;
  if (totalSemPendencia) linhas.push(`${CATEGORIA_LABEL.sem_pendencia}: ${totalSemPendencia} grupo(s)`);
  if (totalSemAtividade) linhas.push(`${CATEGORIA_LABEL.sem_atividade}: ${totalSemAtividade} grupo(s)`);

  return {
    grupos: resultados,
    textoWhatsapp: linhas.join("\n").trim()
  };
}
