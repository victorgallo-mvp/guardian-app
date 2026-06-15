/**
 * Modelo Feedback: resposta do responsável a uma notificação.
 *
 * Alimenta o loop de aprendizado (ver core/feedback/aprendizado.servico.js)
 * que ajusta estatísticas do grupo e, futuramente, calibra os prompts.
 */
import mongoose from "mongoose";

const { Schema } = mongoose;

const feedbackSchema = new Schema(
  {
    clientId: { type: String, required: true, index: true },
    notificacaoId: { type: Schema.Types.ObjectId, ref: "Notificacao", required: true, index: true },
    responsavelId: { type: Schema.Types.ObjectId, ref: "Responsavel", required: true },

    tipoFeedback: {
      type: String,
      enum: ["relevante", "falso_positivo", "snooze", "comentario_livre"],
      required: true
    },
    conteudoResposta: { type: String, default: "" },

    recebidoEm: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

export default mongoose.model("Feedback", feedbackSchema);
