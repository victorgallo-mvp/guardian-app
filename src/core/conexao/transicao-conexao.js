/**
 * Máquina de estados da conexão WhatsApp — lógica pura, sem IO.
 *
 * Recebe o registro anterior (ou null) e uma observação nova (vinda do
 * webhook `connection.update` ou da verificação periódica) e devolve o
 * registro atualizado mais a lista de alertas que devem ser disparados.
 *
 * Regras de alerta (pra não gerar ruído com as reconexões automáticas
 * quase diárias por 503):
 *   - `close` com código terminal (401/402/403 — logout, device_removed,
 *     conta restrita) alerta na hora: a Evolution não reconecta sozinha.
 *   - Qualquer outro estado não-open só alerta se persistir: 2 verificações
 *     periódicas seguidas ou >= MINUTOS_TOLERANCIA desde a queda.
 *   - Um alerta de queda por incidente; ao voltar pra `open`, alerta de
 *     recuperação com a duração.
 */

export const CODIGOS_TERMINAIS = new Set([401, 402, 403]);
export const MINUTOS_TOLERANCIA = 10;
export const VERIFICACOES_FALHAS_PARA_ALERTAR = 2;

const DESCRICAO_CODIGO = {
  401: "Sessão encerrada pelo WhatsApp (logout / dispositivo removido no celular). Precisa ler o QR code de novo.",
  402: "Conta restrita ou bloqueada pelo WhatsApp.",
  403: "Acesso negado pelo WhatsApp (conta restrita).",
  408: "Timeout na conexão com o WhatsApp.",
  428: "Conexão fechada pelo servidor; a Evolution reconecta sozinha.",
  440: "Sessão substituída por outra conexão com as mesmas credenciais (conflict replaced).",
  500: "Erro interno reportado pelo WhatsApp.",
  503: "Servidor do WhatsApp indisponível; a Evolution reconecta sozinha.",
  515: "WhatsApp pediu reinício do socket (normal logo após parear)."
};

/** Texto humano pra um código/motivo de desconexão. */
export function descreverMotivo(codigo, motivo) {
  const base = DESCRICAO_CODIGO[codigo] ?? (codigo ? `Desconexão com código ${codigo}.` : "Motivo não informado pela Evolution.");
  return motivo && !base.toLowerCase().includes(String(motivo).toLowerCase())
    ? `${base} (${motivo})`
    : base;
}

/** Normaliza o estado reportado pela Evolution/Baileys pra open|close|connecting|desconhecido. */
export function normalizarEstado(valor) {
  const v = String(valor ?? "").toLowerCase();
  if (v === "open" || v === "connected") return "open";
  if (v === "close" || v === "closed" || v === "disconnected") return "close";
  if (v === "connecting" || v === "refused") return "connecting";
  return "desconhecido";
}

function ehTerminal(codigo, motivo) {
  if (CODIGOS_TERMINAIS.has(Number(codigo))) return true;
  return /device_removed|logged.?out|loggedout/i.test(String(motivo ?? ""));
}

/**
 * @param {object|null} anterior - registro persistido (campos do modelo EstadoConexao) ou null
 * @param {object} observacao - { estado, codigo?, motivo?, origem: "webhook"|"verificacao" }
 * @param {Date} agora
 * @returns {{ registro: object, alertas: Array<object> }}
 */
export function avaliarTransicao(anterior, observacao, agora = new Date()) {
  const estado = normalizarEstado(observacao.estado);
  const codigo = observacao.codigo != null && !Number.isNaN(Number(observacao.codigo)) ? Number(observacao.codigo) : null;
  const motivo = observacao.motivo ?? null;
  const origem = observacao.origem ?? "verificacao";
  const primeiraObservacao = !anterior;

  const registro = {
    estado,
    codigo,
    motivo,
    origemUltimaObservacao: origem,
    abertoDesde: anterior?.abertoDesde ?? null,
    caidoDesde: anterior?.caidoDesde ?? null,
    atualizadoEm: agora,
    ultimaVerificacaoEm: origem === "verificacao" ? agora : (anterior?.ultimaVerificacaoEm ?? null),
    verificacoesFalhasSeguidas: anterior?.verificacoesFalhasSeguidas ?? 0,
    alertaQuedaEnviadoEm: anterior?.alertaQuedaEnviadoEm ?? null
  };
  const alertas = [];

  if (estado === "open") {
    if (anterior?.alertaQuedaEnviadoEm) {
      const caidoDesde = anterior.caidoDesde ?? anterior.alertaQuedaEnviadoEm;
      alertas.push({
        tipo: "recuperacao",
        caidoDesde,
        duracaoMinutos: Math.max(0, Math.round((agora - new Date(caidoDesde)) / 60_000))
      });
    }
    registro.abertoDesde = anterior?.estado === "open" && anterior.abertoDesde ? anterior.abertoDesde : agora;
    registro.caidoDesde = null;
    registro.codigo = null;
    registro.motivo = null;
    registro.verificacoesFalhasSeguidas = 0;
    registro.alertaQuedaEnviadoEm = null;
    return { registro, alertas };
  }

  // Estado não-open (close / connecting / desconhecido)
  registro.caidoDesde = anterior?.caidoDesde && anterior.estado !== "open" ? anterior.caidoDesde : agora;
  if (origem === "verificacao") {
    registro.verificacoesFalhasSeguidas = (anterior?.estado !== "open" ? (anterior?.verificacoesFalhasSeguidas ?? 0) : 0) + 1;
  }
  // Mantém o código/motivo anterior se a observação nova não trouxe nenhum
  if (codigo == null && anterior?.estado !== "open") {
    registro.codigo = anterior?.codigo ?? null;
    registro.motivo = motivo ?? anterior?.motivo ?? null;
  }

  const jaAlertou = Boolean(anterior?.alertaQuedaEnviadoEm);
  const minutosCaido = (agora - new Date(registro.caidoDesde)) / 60_000;
  const persistente =
    registro.verificacoesFalhasSeguidas >= VERIFICACOES_FALHAS_PARA_ALERTAR ||
    minutosCaido >= MINUTOS_TOLERANCIA;

  // Na primeira observação de todas (sem histórico) só alertamos se for terminal:
  // não sabemos há quanto tempo está assim e não queremos ruído no primeiro deploy.
  const deveAlertar = !jaAlertou && (ehTerminal(registro.codigo, registro.motivo) || (!primeiraObservacao && persistente));

  if (deveAlertar) {
    registro.alertaQuedaEnviadoEm = agora;
    alertas.push({
      tipo: "queda",
      estado,
      codigo: registro.codigo,
      motivo: registro.motivo,
      terminal: ehTerminal(registro.codigo, registro.motivo),
      caidoDesde: registro.caidoDesde,
      descricao: descreverMotivo(registro.codigo, registro.motivo)
    });
  }

  return { registro, alertas };
}
