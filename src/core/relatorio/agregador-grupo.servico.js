import Mensagem from "../../dominio/mensagem.modelo.js";
import Notificacao from "../../dominio/notificacao.modelo.js";

export async function agregarDadosGrupo(grupoId, semanaInicio, semanaFim) {
  const [mensagens, alertas, alertasAbertos] = await Promise.all([
    Mensagem.find({ grupoId, recebidaEm: { $gte: semanaInicio, $lte: semanaFim } })
      .sort({ recebidaEm: 1 })
      .limit(150)
      .select("conteudo isAgencia remetenteNome tipoMensagem recebidaEm")
      .lean(),
    Notificacao.find({ grupoId, enviadaEm: { $gte: semanaInicio, $lte: semanaFim } })
      .select("gatilho status enviadaEm")
      .lean(),
    Notificacao.countDocuments({
      grupoId,
      enviadaEm: { $gte: semanaInicio, $lte: semanaFim },
      status: "enviada"
    })
  ]);

  return { mensagens, alertas, alertasAbertos };
}
