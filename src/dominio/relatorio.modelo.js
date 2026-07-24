import mongoose from "mongoose";

const { Schema } = mongoose;

const grupoResumoSchema = new Schema(
  {
    grupoId: { type: Schema.Types.ObjectId, ref: "Grupo" },
    nomeGrupo: String,
    categoria: {
      type: String,
      enum: ["sem_pendencia", "com_pendencia", "alerta_aberto", "sem_atividade"]
    },
    resumo: String,
    totalMensagens: { type: Number, default: 0 },
    totalAlertas: { type: Number, default: 0 },
    alertasAbertos: { type: Number, default: 0 }
  },
  { _id: false }
);

const relatorioSchema = new Schema({
  clientId: { type: String, required: true, index: true },
  semanaInicio: { type: Date, required: true },
  semanaFim: { type: Date, required: true },
  textoWhatsapp: String,
  grupos: [grupoResumoSchema],
  idMensagemEnviada: { type: String, default: null },
  criadoEm: { type: Date, default: Date.now }
});

export default mongoose.model("Relatorio", relatorioSchema);
