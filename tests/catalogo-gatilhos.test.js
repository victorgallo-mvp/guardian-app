import { describe, it, expect } from "vitest";
import {
  CATALOGO_GATILHOS,
  obterGatilhosAplicaveis,
  gatilhoExiste,
  severidadePadraoDoGatilho
} from "../src/core/gatilhos/catalogo.gatilhos.js";

describe("catalogo.gatilhos", () => {
  describe("obterGatilhosAplicaveis", () => {
    it("retorna apenas gatilhos aplicáveis ao tipo de grupo", () => {
      const aplicaveis = obterGatilhosAplicaveis("interno");
      expect(aplicaveis.length).toBeGreaterThan(0);
      for (const gatilho of aplicaveis) {
        expect(gatilho.aplicavelEm).toContain("interno");
        expect(gatilho).toHaveProperty("id");
        expect(gatilho).toHaveProperty("severidadePadrao");
      }
    });

    it("inclui cliente_irritado pra grupos de atendimento", () => {
      const aplicaveis = obterGatilhosAplicaveis("atendimento").map((g) => g.id);
      expect(aplicaveis).toContain("cliente_irritado");
    });

    it("não inclui problema_operacional pra grupos de atendimento", () => {
      const aplicaveis = obterGatilhosAplicaveis("atendimento").map((g) => g.id);
      expect(aplicaveis).not.toContain("problema_operacional");
    });
  });

  describe("gatilhoExiste", () => {
    it("retorna true pra gatilhos do catálogo", () => {
      for (const id of Object.keys(CATALOGO_GATILHOS)) {
        expect(gatilhoExiste(id)).toBe(true);
      }
    });

    it("retorna false pra gatilhos inexistentes", () => {
      expect(gatilhoExiste("gatilho_inventado")).toBe(false);
    });
  });

  describe("severidadePadraoDoGatilho", () => {
    it("retorna a severidade padrão de um gatilho existente", () => {
      expect(severidadePadraoDoGatilho("risco_legal")).toBe("critico");
    });

    it("retorna null pra gatilhos inexistentes", () => {
      expect(severidadePadraoDoGatilho("gatilho_inventado")).toBeNull();
    });
  });
});
