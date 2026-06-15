import { describe, it, expect } from "vitest";
import { construirMensagemNotificacao } from "../src/core/notificacao/construtor-mensagem.js";

describe("construtor-mensagem.construirMensagemNotificacao", () => {
  const grupo = { nomeGrupo: "Cliente XPTO - Atendimento" };
  const mensagem = { recebidaEm: new Date("2026-06-10T14:30:00Z") };

  it("monta a mensagem com nome do gatilho, grupo, explicação e citações", () => {
    const analise = {
      detectado: {
        gatilho: "risco_cancelamento",
        severidade: "critico",
        confiancaScore: 0.9,
        explicacao: "Cliente mencionou que vai trocar de fornecedor.",
        citacoes: ["vou procurar outro fornecedor"]
      },
      contextoDoCliente: "Cliente reclama há 2 semanas do mesmo problema",
      recomendacaoAcao: "Ligar hoje e oferecer desconto de retenção"
    };

    const texto = construirMensagemNotificacao({ analise, grupo, mensagem });

    expect(texto).toContain("Risco de churn");
    expect(texto).toContain("Cliente XPTO - Atendimento");
    expect(texto).toContain("Cliente mencionou que vai trocar de fornecedor.");
    expect(texto).toContain("> vou procurar outro fornecedor");
    expect(texto).toContain("Cliente reclama há 2 semanas do mesmo problema");
    expect(texto).toContain("Ligar hoje e oferecer desconto de retenção");
    expect(texto).toContain("🚨");
  });

  it("omite seções opcionais quando ausentes", () => {
    const analise = {
      detectado: {
        gatilho: "fora_do_escopo",
        severidade: "atencao",
        confiancaScore: 0.6,
        explicacao: "Pergunta do cliente ficou sem resposta.",
        citacoes: []
      },
      contextoDoCliente: "",
      recomendacaoAcao: ""
    };

    const texto = construirMensagemNotificacao({ analise, grupo, mensagem });

    expect(texto).not.toContain("Trechos:");
    expect(texto).not.toContain("Contexto:");
    expect(texto).not.toContain("💡");
    expect(texto).toContain("⚠️");
  });
});
