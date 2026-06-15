import { describe, it, expect } from "vitest";
import { classificarTipoFeedback, extrairNumeroDeJid } from "../src/core/feedback/interpretador.js";

describe("interpretador.extrairNumeroDeJid", () => {
  it("extrai o número de um JID de contato", () => {
    expect(extrairNumeroDeJid("5511999999999@s.whatsapp.net")).toBe("5511999999999");
  });

  it("retorna string vazia pra valores inválidos", () => {
    expect(extrairNumeroDeJid(undefined)).toBe("");
    expect(extrairNumeroDeJid(null)).toBe("");
  });
});

describe("interpretador.classificarTipoFeedback", () => {
  it("classifica polegar pra cima como relevante", () => {
    expect(classificarTipoFeedback("👍 perfeito, obrigado!")).toBe("relevante");
  });

  it("classifica polegar pra baixo como falso_positivo", () => {
    expect(classificarTipoFeedback("👎 não era nada demais")).toBe("falso_positivo");
  });

  it("classifica pedido de pausa como snooze", () => {
    expect(classificarTipoFeedback("pode pausar esse grupo por hoje")).toBe("snooze");
  });

  it("classifica texto livre sem palavras-chave como comentario_livre", () => {
    expect(classificarTipoFeedback("hmm, interessante, vou verificar com a equipe")).toBe("comentario_livre");
  });

  it("prioriza snooze mesmo quando há palavras de relevância na mesma mensagem", () => {
    expect(classificarTipoFeedback("👍 relevante, mas pode pausar esse grupo")).toBe("snooze");
  });
});
