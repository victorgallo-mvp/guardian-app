import { describe, it, expect } from "vitest";
import {
  extrairTextoMensagem,
  determinarTipoMensagem,
  mensagemEhValida
} from "../src/core/filtros/mensagem-valida.filtro.js";
import { ehGrupo, grupoEmSnooze } from "../src/core/filtros/grupo-permitido.filtro.js";

describe("mensagem-valida.filtro", () => {
  describe("extrairTextoMensagem", () => {
    it("extrai texto de conversation simples", () => {
      const payload = { message: { conversation: "  oi, tudo bem?  " } };
      expect(extrairTextoMensagem(payload)).toBe("oi, tudo bem?");
    });

    it("extrai texto de extendedTextMessage", () => {
      const payload = { message: { extendedTextMessage: { text: "mensagem longa" } } };
      expect(extrairTextoMensagem(payload)).toBe("mensagem longa");
    });

    it("extrai legenda de imagem", () => {
      const payload = { message: { imageMessage: { caption: "legenda da foto" } } };
      expect(extrairTextoMensagem(payload)).toBe("legenda da foto");
    });

    it("retorna string vazia quando não há texto extraível", () => {
      const payload = { message: { stickerMessage: {} } };
      expect(extrairTextoMensagem(payload)).toBe("");
    });
  });

  describe("determinarTipoMensagem", () => {
    it.each([
      [{ message: { conversation: "oi" } }, "texto"],
      [{ message: { extendedTextMessage: { text: "oi" } } }, "texto"],
      [{ message: { imageMessage: {} } }, "imagem"],
      [{ message: { audioMessage: {} } }, "audio"],
      [{ message: { documentMessage: {} } }, "documento"],
      [{ message: { stickerMessage: {} } }, "sticker"],
      [{ message: {} }, "outro"]
    ])("classifica %j como %s", (payload, esperado) => {
      expect(determinarTipoMensagem(payload)).toBe(esperado);
    });
  });

  describe("mensagemEhValida", () => {
    const grupo = { configuracoesEspecificas: { ignorarMembros: ["bot@s.whatsapp.net"] } };

    it("rejeita payload sem key", () => {
      expect(mensagemEhValida({}, grupo).valida).toBe(false);
    });

    it("rejeita mensagens enviadas pelo próprio bot", () => {
      const payload = { key: { fromMe: true, remoteJid: "g@g.us" }, message: { conversation: "oi" } };
      expect(mensagemEhValida(payload, grupo).valida).toBe(false);
    });

    it("rejeita mensagens de remetentes ignorados", () => {
      const payload = {
        key: { fromMe: false, remoteJid: "g@g.us", participant: "bot@s.whatsapp.net" },
        message: { conversation: "oi" }
      };
      expect(mensagemEhValida(payload, grupo).valida).toBe(false);
    });

    it("rejeita tipos sem texto analisável", () => {
      const payload = {
        key: { fromMe: false, remoteJid: "g@g.us", participant: "user@s.whatsapp.net" },
        message: { stickerMessage: {} }
      };
      expect(mensagemEhValida(payload, grupo).valida).toBe(false);
    });

    it("rejeita mensagens sem conteúdo textual", () => {
      const payload = {
        key: { fromMe: false, remoteJid: "g@g.us", participant: "user@s.whatsapp.net" },
        message: { conversation: "" }
      };
      expect(mensagemEhValida(payload, grupo).valida).toBe(false);
    });

    it("aceita mensagens de texto válidas", () => {
      const payload = {
        key: { fromMe: false, remoteJid: "g@g.us", participant: "user@s.whatsapp.net" },
        message: { conversation: "preciso de ajuda urgente" }
      };
      const resultado = mensagemEhValida(payload, grupo);
      expect(resultado).toEqual({ valida: true, texto: "preciso de ajuda urgente", tipo: "texto" });
    });
  });
});

describe("grupo-permitido.filtro", () => {
  describe("ehGrupo", () => {
    it("identifica JIDs de grupo", () => {
      expect(ehGrupo("120363123456789@g.us")).toBe(true);
    });

    it("não identifica JIDs de contato individual como grupo", () => {
      expect(ehGrupo("5511999999999@s.whatsapp.net")).toBe(false);
    });

    it("retorna false para valores não-string", () => {
      expect(ehGrupo(undefined)).toBe(false);
      expect(ehGrupo(null)).toBe(false);
    });
  });

  describe("grupoEmSnooze", () => {
    it("retorna false quando pausadoAte não está definido", () => {
      expect(grupoEmSnooze({ pausadoAte: null })).toBe(false);
    });

    it("retorna true quando pausadoAte está no futuro", () => {
      const futuro = new Date(Date.now() + 60 * 60 * 1000);
      expect(grupoEmSnooze({ pausadoAte: futuro })).toBe(true);
    });

    it("retorna false quando pausadoAte já passou", () => {
      const passado = new Date(Date.now() - 60 * 60 * 1000);
      expect(grupoEmSnooze({ pausadoAte: passado })).toBe(false);
    });
  });
});
