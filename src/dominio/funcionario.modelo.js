import mongoose from "mongoose";

const { Schema } = mongoose;

const funcionarioSchema = new Schema(
  {
    clientId: { type: String, required: true, index: true },
    nome: { type: String, required: true },
    cargo: { type: String, default: "" },
    whatsappNumero: { type: String, default: null },
    whatsappJid: { type: String, default: null },
    ativo: { type: Boolean, default: true }
  },
  { timestamps: { createdAt: "cadastradoEm", updatedAt: "atualizadoEm" } }
);

funcionarioSchema.index({ clientId: 1, ativo: 1 });

export default mongoose.model("Funcionario", funcionarioSchema);
