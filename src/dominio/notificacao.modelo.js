/**
 * Modelo Notificacao: DM enviada a um responsável sobre um gatilho detectado.
 */
import mongoose from "mongoose";

const { Schema } = mongoose;

const notificacaoSchema = new Schema(
  {
    clientId: { type: String, required: true, index: true },
    grupoId: { type: Schema.Types.ObjectId, ref: "Grupo", required: true, index: true },
    analiseId: { type: Schema.Types.ObjectId, ref: "Analise", required: true },
    responsavelId: { type: Schema.Types.ObjectId, ref: "Responsavel", default: null, index: true },

    gatilho: { type: String, default: null, index: true },
    conteudoMensagem: { type: String, required: true },
    idMensagemEnviada: { type: String, default: null },

    enviadaEm: { type: Date, default: Date.now },

    feedbackId: { type: Schema.Types.ObjectId, ref: "Feedback", default: null },
    status: {
      type: String,
      enum: ["enviada", "ciente", "resolvida", "ignorada"],
      default: "enviada"
    }
  },
  { timestamps: false }
);

notificacaoSchema.index({ responsavelId: 1, status: 1, enviadaEm: -1 });

export default mongoose.model("Notificacao", notificacaoSchema);
