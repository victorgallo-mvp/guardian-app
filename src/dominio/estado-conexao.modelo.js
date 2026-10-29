/**
 * Modelo EstadoConexao: último estado conhecido da sessão WhatsApp de uma
 * instância da Evolution API, mais o controle de alertas de queda.
 *
 * Um documento por instância. Persistido (em vez de só memória) pra que
 * um restart do Guardião não dispare alerta de "voltou" espúrio nem perca
 * o registro de que já avisamos sobre a queda atual.
 */
import mongoose from "mongoose";

const { Schema } = mongoose;

const estadoConexaoSchema = new Schema(
  {
    instanceName: { type: String, required: true, unique: true },

    /** open | close | connecting | desconhecido */
    estado: { type: String, required: true, default: "desconhecido" },
    /** Código de desconexão reportado pela Evolution/Baileys (401, 503, ...) */
    codigo: { type: Number, default: null },
    /** Texto curto do motivo (ex: "device_removed") quando disponível */
    motivo: { type: String, default: null },
    /** webhook | verificacao */
    origemUltimaObservacao: { type: String, default: null },

    abertoDesde: { type: Date, default: null },
    caidoDesde: { type: Date, default: null },
    atualizadoEm: { type: Date, default: Date.now },
    ultimaVerificacaoEm: { type: Date, default: null },

    /** Verificações periódicas consecutivas em que a instância não estava open */
    verificacoesFalhasSeguidas: { type: Number, default: 0 },
    /** Quando avisamos sobre a queda atual (null = saudável ou ainda não avisado) */
    alertaQuedaEnviadoEm: { type: Date, default: null }
  },
  { collection: "estados_conexao", timestamps: false }
);

export default mongoose.model("EstadoConexao", estadoConexaoSchema);
