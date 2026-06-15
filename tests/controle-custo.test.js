import { describe, it, expect } from "vitest";
import { calcularCustoUsd } from "../src/core/ia/controle-custo.servico.js";

describe("controle-custo.calcularCustoUsd", () => {
  it("calcula o custo do Haiku 4.5 (US$1/US$5 por milhão de tokens)", () => {
    const custo = calcularCustoUsd("claude-haiku-4-5", 1_000_000, 1_000_000);
    expect(custo).toBeCloseTo(1.0 + 5.0, 6);
  });

  it("calcula o custo do Sonnet 4.5 (US$3/US$15 por milhão de tokens)", () => {
    const custo = calcularCustoUsd("claude-sonnet-4-5", 1_000_000, 1_000_000);
    expect(custo).toBeCloseTo(3.0 + 15.0, 6);
  });

  it("calcula proporcionalmente pra quantidades menores de tokens", () => {
    const custo = calcularCustoUsd("claude-haiku-4-5", 500_000, 0);
    expect(custo).toBeCloseTo(0.5, 6);
  });

  it("usa um preço padrão pra modelos sem preço cadastrado", () => {
    const custo = calcularCustoUsd("modelo-desconhecido", 1_000_000, 1_000_000);
    expect(custo).toBeCloseTo(3.0 + 15.0, 6);
  });

  it("retorna zero quando não há tokens", () => {
    expect(calcularCustoUsd("claude-haiku-4-5", 0, 0)).toBe(0);
  });
});
