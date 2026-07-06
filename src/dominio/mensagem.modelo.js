/**
 * Modelo Mensagem: mensagem capturada de um grupo monitorado.
 *
 * `idMensagemWhatsapp` tem índice único pra garantir idempotência —
 * receber o mesmo evento de webhook duas vezes não duplica a mensagem.
 */
import mongoose from "mongoose";

const { Schema } = mongoose;

const triagemSchema = new Schema(
  {
    processadaEm: { type: Date, default: null },
    precisaAtencao: { type: Boolean, default: null },
    confiancaScore: { type: Number, default: null },
    motivoBreve: { type: String, default: "" },
    custoUsd: { type: Number, default: 0 }
  },
  { _id: false }
);

const mensagemSchema = new Schema(
  {
    clientId: { type: String, required: true, index: true },
    grupoId: { type: Schema.Types.ObjectId, ref: "Grupo", required: true, index: true },

    idMensagemWhatsapp: { type: String, required: true, unique: true, index: true },
    remetenteJid: { type: String, required: true },
    remetenteNome: { type: String, default: "" },
    remetenteNumero: { type: String, default: null }, // extraído de participantAlt (@s.whatsapp.net)
    isAgencia: { type: Boolean, default: null },       // null = mensagem antiga sem classificação

    conteudo: { type: String, default: "" },
    tipoMensagem: {
      type: String,
      enum: ["texto", "imagem", "audio", "documento", "sticker", "outro"],
      default: "texto"
    },
    citouMensagem: { type: String, default: null },

    recebidaEm: { type: Date, required: true, index: true },

    triagem: { type: triagemSchema, default: () => ({}) },

    analiseProfundaId: { type: Schema.Types.ObjectId, ref: "Analise", default: null }
  },
  { timestamps: false }
);

mensagemSchema.index({ grupoId: 1, recebidaEm: -1 });

export default mongoose.model("Mensagem", mensagemSchema);
