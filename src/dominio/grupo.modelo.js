/**
 * Modelo Grupo: representa um grupo de WhatsApp monitorado.
 *
 * Apenas grupos cadastrados aqui (e com `ativo: true`) são processados
 * pelo pipeline de análise — funciona como allowlist (ver
 * core/filtros/grupo-permitido.filtro.js).
 */
import mongoose from "mongoose";

const { Schema } = mongoose;

const configuracoesEspecificasSchema = new Schema(
  {
    nivelSensibilidade: {
      type: String,
      enum: ["baixo", "medio", "alto"],
      default: null
    },
    ignorarMembros: { type: [String], default: [] },
    palavrasChaveAlerta: { type: [String], default: [] },
    contextoAdicional: { type: String, default: "" }
  },
  { _id: false }
);

const estatisticasSchema = new Schema(
  {
    mensagensProcessadasTotal: { type: Number, default: 0 },
    notificacoesEnviadas: { type: Number, default: 0 },
    falsosPositivos: { type: Number, default: 0 },
    relevantesConfirmados: { type: Number, default: 0 },
    ultimaAtividade: { type: Date, default: null }
  },
  { _id: false }
);

const grupoSchema = new Schema(
  {
    clientId: { type: String, required: true, index: true },

    idWhatsappGrupo: { type: String, required: true, unique: true, index: true },
    nomeGrupo: { type: String, required: true },
    descricao: { type: String, default: "" },

    tipo: {
      type: String,
      enum: ["atendimento", "interno", "fornecedor", "vendas", "outro"],
      required: true
    },

    responsaveis: [{ type: Schema.Types.ObjectId, ref: "Responsavel" }],

    gatilhosAtivos: { type: [String], default: [] },

    configuracoesEspecificas: { type: configuracoesEspecificasSchema, default: () => ({}) },

    estatisticas: { type: estatisticasSchema, default: () => ({}) },

    // Quando definido, grupo fica em "snooze" até essa data/hora
    pausadoAte: { type: Date, default: null },

    ativo: { type: Boolean, default: true }
  },
  { timestamps: { createdAt: "cadastradoEm", updatedAt: false } }
);

grupoSchema.index({ clientId: 1, ativo: 1 });

export default mongoose.model("Grupo", grupoSchema);
