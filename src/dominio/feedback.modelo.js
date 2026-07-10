import mongoose from "mongoose";

const { Schema } = mongoose;

const feedbackSchema = new Schema(
  {
    clientId:         { type: String, required: true, index: true },
    grupoId:          { type: Schema.Types.ObjectId, ref: "Grupo", required: true },
    notificacaoId:    { type: Schema.Types.ObjectId, ref: "Notificacao", required: true },
    analiseId:        { type: Schema.Types.ObjectId, ref: "Analise", index: true },
    gatilho:          { type: String, default: null },
    tipo:             { type: String, enum: ["positivo", "negativo"], required: true },
    motivo:           { type: String, default: null, maxlength: 200 },
    mensagemConteudo: { type: String, default: null },
    criadoEm:         { type: Date, default: Date.now }
  },
  { timestamps: false }
);

feedbackSchema.index({ clientId: 1, criadoEm: -1 });

export default mongoose.model("Feedback", feedbackSchema);
