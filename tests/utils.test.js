import { describe, it, expect, vi } from "vitest";
import { truncar, dentroDaJanelaHoraria, comRetry } from "../src/shared/utils.js";

describe("utils.truncar", () => {
  it("retorna o texto original quando menor que o tamanho máximo", () => {
    expect(truncar("oi", 10)).toBe("oi");
  });

  it("trunca e adiciona '...' quando o texto excede o tamanho máximo", () => {
    expect(truncar("0123456789abc", 10)).toBe("0123456789...");
  });

  it("retorna string vazia pra valores vazios/nulos", () => {
    expect(truncar("", 10)).toBe("");
    expect(truncar(null, 10)).toBe("");
  });
});

describe("utils.dentroDaJanelaHoraria", () => {
  it("considera sempre dentro quando início == fim", () => {
    expect(dentroDaJanelaHoraria("13:00", "08:00", "08:00")).toBe(true);
  });

  it("janela normal (não cruza meia-noite)", () => {
    expect(dentroDaJanelaHoraria("10:00", "08:00", "20:00")).toBe(true);
    expect(dentroDaJanelaHoraria("21:00", "08:00", "20:00")).toBe(false);
    expect(dentroDaJanelaHoraria("08:00", "08:00", "20:00")).toBe(true);
    expect(dentroDaJanelaHoraria("20:00", "08:00", "20:00")).toBe(false);
  });

  it("janela que cruza a meia-noite", () => {
    expect(dentroDaJanelaHoraria("23:00", "22:00", "08:00")).toBe(true);
    expect(dentroDaJanelaHoraria("02:00", "22:00", "08:00")).toBe(true);
    expect(dentroDaJanelaHoraria("12:00", "22:00", "08:00")).toBe(false);
  });
});

describe("utils.comRetry", () => {
  it("retorna o resultado na primeira tentativa quando não há erro", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const resultado = await comRetry(fn, { tentativas: 3, delayBaseMs: 1 });
    expect(resultado).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("tenta novamente após falhas e retorna o resultado quando eventualmente funciona", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("falha 1"))
      .mockRejectedValueOnce(new Error("falha 2"))
      .mockResolvedValue("ok");

    const aoFalhar = vi.fn();
    const resultado = await comRetry(fn, { tentativas: 3, delayBaseMs: 1, aoFalhar });

    expect(resultado).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(aoFalhar).toHaveBeenCalledTimes(2);
  });

  it("lança o último erro após esgotar as tentativas", async () => {
    const erroFinal = new Error("falha definitiva");
    const fn = vi.fn().mockRejectedValue(erroFinal);

    await expect(comRetry(fn, { tentativas: 2, delayBaseMs: 1 })).rejects.toThrow("falha definitiva");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
