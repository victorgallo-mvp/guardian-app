import { describe, it, expect } from "vitest";
import { validarResultadoAnalise, deveGerarNotificacao } from "../src/core/gatilhos/classificador.js";

function resultadoBase(overrides = {}) {
  return {
    gatilho: "cliente_irritado",
    severidade: "atencao",
    confiancaScore: 0.8,
    explicacao: "Cliente demonstrou frustração com o atraso na entrega.",
    citacoes: ["isso é um absurdo"],
    contextoDoCliente: "Cliente aguarda entrega há 5 dias",
    recomendacaoAcao: "Ligar pro cliente e dar uma posição",
    ...overrides
  };
}

describe("classificador.validarResultadoAnalise", () => {
  it("aceita um resultado válido e aplicável ao tipo de grupo", () => {
    const { valido, resultado } = validarResultadoAnalise(resultadoBase(), "atendimento");
    expect(valido).toBe(true);
    expect(resultado.gatilho).toBe("cliente_irritado");
  });

  it("rejeita resultado fora do formato esperado (campo obrigatório faltando)", () => {
    const bruto = resultadoBase();
    delete bruto.explicacao;
    const { valido, motivo } = validarResultadoAnalise(bruto, "atendimento");
    expect(valido).toBe(false);
    expect(motivo).toMatch(/formato esperado/);
  });

  it("rejeita gatilho que não existe no catálogo", () => {
    const { valido, motivo } = validarResultadoAnalise(resultadoBase({ gatilho: "gatilho_inventado" }), "atendimento");
    expect(valido).toBe(false);
    expect(motivo).toMatch(/não existe no catálogo/);
  });

  it("rejeita gatilho que existe mas não é aplicável ao tipo de grupo", () => {
    const { valido, motivo } = validarResultadoAnalise(
      resultadoBase({ gatilho: "problema_operacional", severidade: "urgente" }),
      "atendimento"
    );
    expect(valido).toBe(false);
    expect(motivo).toMatch(/não é aplicável/);
  });

  it("preenche valores default pra campos opcionais ausentes", () => {
    const bruto = resultadoBase();
    delete bruto.citacoes;
    delete bruto.contextoDoCliente;
    delete bruto.recomendacaoAcao;

    const { valido, resultado } = validarResultadoAnalise(bruto, "atendimento");
    expect(valido).toBe(true);
    expect(resultado.citacoes).toEqual([]);
    expect(resultado.contextoDoCliente).toBe("");
    expect(resultado.recomendacaoAcao).toBe("");
  });
});

describe("classificador.deveGerarNotificacao", () => {
  const grupo = { gatilhosAtivos: [] };

  it("não notifica quando a confiança está abaixo do mínimo", () => {
    const analise = resultadoBase({ confiancaScore: 0.3 });
    const { notificar, motivo } = deveGerarNotificacao(analise, grupo, "medio");
    expect(notificar).toBe(false);
    expect(motivo).toMatch(/Confiança/);
  });

  it("não notifica quando o gatilho não está na lista de gatilhos ativos do grupo", () => {
    const analise = resultadoBase({ severidade: "critico" });
    const grupoComFiltro = { gatilhosAtivos: ["risco_legal"] };
    const { notificar, motivo } = deveGerarNotificacao(analise, grupoComFiltro, "baixo");
    expect(notificar).toBe(false);
    expect(motivo).toMatch(/gatilhos ativos/);
  });

  it("não notifica quando severidade está abaixo do limiar de sensibilidade", () => {
    const analise = resultadoBase({ severidade: "atencao" });
    const { notificar, motivo } = deveGerarNotificacao(analise, grupo, "medio");
    expect(notificar).toBe(false);
    expect(motivo).toMatch(/limiar de sensibilidade/);
  });

  it("notifica quando severidade atinge o limiar de sensibilidade", () => {
    const analise = resultadoBase({ severidade: "atencao" });
    const { notificar } = deveGerarNotificacao(analise, grupo, "alto");
    expect(notificar).toBe(true);
  });

  it("notifica críticos mesmo com sensibilidade baixa", () => {
    const analise = resultadoBase({ severidade: "critico" });
    const { notificar } = deveGerarNotificacao(analise, grupo, "baixo");
    expect(notificar).toBe(true);
  });
});
