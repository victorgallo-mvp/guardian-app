import { describe, it, expect } from "vitest";
import {
  avaliarTransicao,
  normalizarEstado,
  descreverMotivo,
  MINUTOS_TOLERANCIA
} from "../src/core/conexao/transicao-conexao.js";

const T0 = new Date("2026-10-28T05:00:00Z");
const min = (n) => new Date(T0.getTime() + n * 60_000);

const saudavel = {
  estado: "open", codigo: null, motivo: null,
  abertoDesde: new Date("2026-10-01T00:00:00Z"), caidoDesde: null,
  verificacoesFalhasSeguidas: 0, alertaQuedaEnviadoEm: null
};

describe("transicao-conexao", () => {
  describe("normalizarEstado", () => {
    it("mapeia variantes pra open/close/connecting/desconhecido", () => {
      expect(normalizarEstado("open")).toBe("open");
      expect(normalizarEstado("CLOSE")).toBe("close");
      expect(normalizarEstado("connecting")).toBe("connecting");
      expect(normalizarEstado(undefined)).toBe("desconhecido");
    });
  });

  describe("queda terminal (401 device_removed)", () => {
    it("alerta imediatamente via webhook, mesmo sem persistência", () => {
      const { registro, alertas } = avaliarTransicao(
        saudavel,
        { estado: "close", codigo: 401, motivo: "device_removed", origem: "webhook" },
        min(1)
      );
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatchObject({ tipo: "queda", terminal: true, codigo: 401 });
      expect(alertas[0].descricao).toMatch(/QR code/i);
      expect(registro.alertaQuedaEnviadoEm).toEqual(min(1));
      expect(registro.caidoDesde).toEqual(min(1));
    });

    it("não alerta de novo enquanto a mesma queda persiste", () => {
      const primeira = avaliarTransicao(saudavel, { estado: "close", codigo: 401, origem: "webhook" }, min(1)).registro;
      const segunda = avaliarTransicao(primeira, { estado: "close", codigo: 401, origem: "verificacao" }, min(6));
      expect(segunda.alertas).toHaveLength(0);
      expect(segunda.registro.caidoDesde).toEqual(min(1));
      expect(segunda.registro.verificacoesFalhasSeguidas).toBe(1);
    });
  });

  describe("queda transitória (503) com reconexão automática", () => {
    it("não alerta num close 503 isolado seguido de open", () => {
      const caiu = avaliarTransicao(saudavel, { estado: "close", codigo: 503, origem: "webhook" }, min(1));
      expect(caiu.alertas).toHaveLength(0);
      const conectando = avaliarTransicao(caiu.registro, { estado: "connecting", origem: "webhook" }, min(1));
      expect(conectando.alertas).toHaveLength(0);
      const voltou = avaliarTransicao(conectando.registro, { estado: "open", origem: "webhook" }, min(2));
      expect(voltou.alertas).toHaveLength(0);
      expect(voltou.registro.caidoDesde).toBeNull();
      expect(voltou.registro.abertoDesde).toEqual(min(2));
    });

    it("alerta quando a queda persiste além da tolerância", () => {
      const caiu = avaliarTransicao(saudavel, { estado: "close", codigo: 503, origem: "webhook" }, min(0));
      const ainda = avaliarTransicao(caiu.registro, { estado: "connecting", origem: "webhook" }, min(MINUTOS_TOLERANCIA));
      expect(ainda.alertas).toHaveLength(1);
      expect(ainda.alertas[0]).toMatchObject({ tipo: "queda", terminal: false, codigo: 503 });
    });

    it("alerta após duas verificações periódicas seguidas fora do ar", () => {
      const v1 = avaliarTransicao(saudavel, { estado: "connecting", origem: "verificacao" }, min(0));
      expect(v1.alertas).toHaveLength(0);
      const v2 = avaliarTransicao(v1.registro, { estado: "connecting", origem: "verificacao" }, min(5));
      expect(v2.alertas).toHaveLength(1);
      expect(v2.registro.verificacoesFalhasSeguidas).toBe(2);
    });
  });

  describe("recuperação", () => {
    it("emite alerta de recuperação com a duração quando volta pra open após alerta de queda", () => {
      const caiu = avaliarTransicao(saudavel, { estado: "close", codigo: 401, origem: "webhook" }, min(0));
      const voltou = avaliarTransicao(caiu.registro, { estado: "open", origem: "webhook" }, min(90));
      expect(voltou.alertas).toHaveLength(1);
      expect(voltou.alertas[0]).toMatchObject({ tipo: "recuperacao", duracaoMinutos: 90 });
      expect(voltou.registro.alertaQuedaEnviadoEm).toBeNull();
      expect(voltou.registro.codigo).toBeNull();
    });

    it("não emite recuperação se nunca houve alerta de queda", () => {
      const caiu = avaliarTransicao(saudavel, { estado: "close", codigo: 503, origem: "webhook" }, min(0));
      const voltou = avaliarTransicao(caiu.registro, { estado: "open", origem: "webhook" }, min(1));
      expect(voltou.alertas).toHaveLength(0);
    });
  });

  describe("primeira observação (sem histórico)", () => {
    it("não alerta se encontrar a instância em connecting sem saber há quanto tempo", () => {
      const r = avaliarTransicao(null, { estado: "connecting", origem: "verificacao" }, T0);
      expect(r.alertas).toHaveLength(0);
      expect(r.registro.verificacoesFalhasSeguidas).toBe(1);
    });

    it("alerta se encontrar a instância já deslogada (401)", () => {
      const r = avaliarTransicao(null, { estado: "close", codigo: 401, motivo: "device_removed", origem: "verificacao" }, T0);
      expect(r.alertas).toHaveLength(1);
    });

    it("registra open sem alertas", () => {
      const r = avaliarTransicao(null, { estado: "open", origem: "verificacao" }, T0);
      expect(r.alertas).toHaveLength(0);
      expect(r.registro.abertoDesde).toEqual(T0);
    });
  });

  describe("descreverMotivo", () => {
    it("descreve códigos conhecidos e cai num texto genérico pros demais", () => {
      expect(descreverMotivo(401, "device_removed")).toMatch(/dispositivo removido/i);
      expect(descreverMotivo(999, null)).toMatch(/999/);
      expect(descreverMotivo(null, null)).toMatch(/não informado/i);
    });
  });
});
