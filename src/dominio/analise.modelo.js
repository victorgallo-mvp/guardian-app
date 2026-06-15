/**
 * Modelo Analise: resultado da análise profunda (Sonnet) sobre uma mensagem.
 */
import mongoose from "mongoose";

const { Schema } = mongoose;

const contextoAnalisadoSchema = new Schema(
  {
    mensagemAtual: { type: String, required: true },
    mensagensAnteriores: { type: [Schema.Types.Mixed], default: [] },
    totalContexto: { type: Number, default: 0 }
  },
  { _id: false }
);

const detectadoSchema = new Schema(
  {
    gatilho: { type: String, required: true },
    severidade: {
      type: String,
      enum: ["info", "atencao", "urgente", "critico"],
      required: true
    },
    confiancaScore: { type: Number, required: true },
    explicacao: { type: String, required: true },
    citacoes: { type: [String], default: [] }
  },
  { _id: false }
);

const analiseSchema = new Schema(
  {
    clientId: { type: String, required: true, index: true },
    grupoId: { type: Schema.Types.ObjectId, ref: "Grupo", required: true, index: true },
    mensagemId: { type: Schema.Types.ObjectId, ref: "Mensagem", required: true },

    contextoAnalisado: { type: contextoAnalisadoSchema, required: true },

    detectado: { type: detectadoSchema, required: true },

    contextoDoCliente: { type: String, default: "" },
    recomendacaoAcao: { type: String, default: "" },

    analisadaEm: { type: Date, default: Date.now },
    modeloUsado: { type: String, required: true },
    custoTokensUsd: { type: Number, default: 0 }
  },
  { timestamps: false }
);

analiseSchema.index({ grupoId: 1, analisadaEm: -1 });

export default mongoose.model("Analise", analiseSchema);
