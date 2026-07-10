/**
 * Modelo Cliente: raiz do multi-tenant.
 *
 * Representa uma agência/empresa usuária do sistema. Todo o resto do domínio
 * (grupos, responsáveis, mensagens, etc.) referencia um `clientId` que
 * corresponde ao campo `identificador` deste modelo.
 *
 * Embora hoje rodemos com um único cliente (mono-tenant operacional via
 * env CLIENT_ID), o schema já suporta múltiplos clientes sem refatoração.
 */
import mongoose from "mongoose";

const { Schema } = mongoose;

const evolutionInstanceSchema = new Schema(
  {
    nome: { type: String, required: true },
    apiUrl: { type: String, required: true },
    apiKey: { type: String, required: true }
  },
  { _id: false }
);

const configuracoesSchema = new Schema(
  {
    nivelSensibilidadePadrao: {
      type: String,
      enum: ["baixo", "medio", "alto"],
      default: "medio"
    },
    janelaContextoMensagens: { type: Number, default: 30 },
    limiteCustoDiarioUsd: { type: Number, default: 5 },
    horarioSilenciosoInicio: { type: String, default: "22:00" },
    horarioSilenciosoFim: { type: String, default: "08:00" }
  },
  { _id: false }
);

const clienteSchema = new Schema(
  {
    identificador: { type: String, required: true, unique: true, index: true },
    nome: { type: String, required: true },

    evolutionInstance: { type: evolutionInstanceSchema, required: true },

    configuracoes: { type: configuracoesSchema, default: () => ({}) },

    // Gatilhos desativados globalmente (blacklist, vale para todos os grupos)
    gatilhosDesativados: { type: [String], default: [] },

    // Treinamento personalizado: frases de encerramento e contexto injetado nos prompts
    treinamento: {
      frasesEncerraConversa: {
        type: [
          new Schema(
            { texto: { type: String, required: true, maxlength: 150 } },
            { timestamps: { createdAt: "criadoEm", updatedAt: false } }
          )
        ],
        default: []
      },
      contextoPersonalizado: { type: String, default: null, maxlength: 800 }
    },

    ativo: { type: Boolean, default: true }
  },
  { timestamps: { createdAt: "criadoEm", updatedAt: "atualizadoEm" } }
);

export default mongoose.model("Cliente", clienteSchema);
