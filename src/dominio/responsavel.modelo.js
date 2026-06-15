/**
 * Modelo Responsavel: pessoa que recebe notificações sobre um ou mais grupos.
 */
import mongoose from "mongoose";

const { Schema } = mongoose;

const preferenciasSchema = new Schema(
  {
    receberFalsosPositivos: { type: Boolean, default: false },
    horariosNotificacao: {
      inicio: { type: String, default: "08:00" },
      fim: { type: String, default: "20:00" }
    },
    diasUteis: { type: [Number], default: [1, 2, 3, 4, 5] },
    receberRelatorioDiario: { type: Boolean, default: true }
  },
  { _id: false }
);

const responsavelSchema = new Schema(
  {
    clientId: { type: String, required: true, index: true },

    nome: { type: String, required: true },
    papel: {
      type: String,
      enum: ["gerente_atendimento", "diretor", "supervisor", "operador"],
      required: true
    },

    whatsappNumero: { type: String, required: true, index: true },

    preferencias: { type: preferenciasSchema, default: () => ({}) },

    ativo: { type: Boolean, default: true }
  },
  { timestamps: { createdAt: "cadastradoEm", updatedAt: false } }
);

responsavelSchema.index({ clientId: 1, ativo: 1 });

export default mongoose.model("Responsavel", responsavelSchema);
