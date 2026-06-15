/**
 * Catálogo central dos tipos de gatilho que o sistema sabe detectar.
 *
 * Cada gatilho define uma severidade padrão e os tipos de grupo em que
 * é aplicável. O catálogo é usado tanto pra montar os prompts da IA
 * (lista de gatilhos possíveis pro tipo de grupo) quanto pelo
 * classificador pra validar/normalizar a saída do modelo.
 */

export const CATALOGO_GATILHOS = {
  cliente_irritado: {
    nome: "Cliente irritado/frustrado",
    descricao: "Sentimento negativo crescente em mensagens do cliente",
    severidadePadrao: "atencao",
    aplicavelEm: ["atendimento", "vendas"]
  },
  urgencia_explicita: {
    nome: "Urgência real declarada",
    descricao: "Cliente declara explicitamente urgência ou prazo curto",
    severidadePadrao: "urgente",
    aplicavelEm: ["atendimento", "vendas", "fornecedor"]
  },
  pedido_humano: {
    nome: "Pedido explícito de humano",
    descricao: "Cliente pede pra falar com alguém específico ou responsável",
    severidadePadrao: "urgente",
    aplicavelEm: ["atendimento"]
  },
  risco_cancelamento: {
    nome: "Risco de churn",
    descricao: "Menção a cancelar, mudar de fornecedor, insatisfação prolongada",
    severidadePadrao: "critico",
    aplicavelEm: ["atendimento", "vendas"]
  },
  oportunidade_quente: {
    nome: "Oportunidade comercial quente",
    descricao: "Lead menciona orçamento, prazo de decisão, autoridade ou intenção forte",
    severidadePadrao: "urgente",
    aplicavelEm: ["vendas"]
  },
  problema_operacional: {
    nome: "Problema operacional crítico",
    descricao: "Equipe interna relata bug, conta restrita, campanha pausada, etc",
    severidadePadrao: "urgente",
    aplicavelEm: ["interno"]
  },
  fora_do_escopo: {
    nome: "Pergunta sem resposta",
    descricao: "Cliente fez pergunta importante há tempo e ninguém respondeu",
    severidadePadrao: "atencao",
    aplicavelEm: ["atendimento", "vendas"]
  },
  inatividade_preocupante: {
    nome: "Inatividade após mensagem do cliente",
    descricao: "Cliente mandou mensagem e não recebeu resposta em tempo significativo",
    severidadePadrao: "atencao",
    aplicavelEm: ["atendimento", "vendas"]
  },
  risco_legal: {
    nome: "Menção a processo legal",
    descricao: "Cliente menciona Procon, Reclame Aqui, advogado, processo",
    severidadePadrao: "critico",
    aplicavelEm: ["atendimento", "vendas", "fornecedor"]
  }
};

export const TIPOS_GRUPO_VALIDOS = ["atendimento", "interno", "fornecedor", "vendas", "outro"];

export const NIVEIS_SEVERIDADE = ["info", "atencao", "urgente", "critico"];

/**
 * Retorna os gatilhos do catálogo aplicáveis a um tipo de grupo,
 * já no formato `{ id, ...info }` pra facilitar uso em prompts.
 */
export function obterGatilhosAplicaveis(tipoGrupo) {
  return Object.entries(CATALOGO_GATILHOS)
    .filter(([, info]) => info.aplicavelEm.includes(tipoGrupo))
    .map(([id, info]) => ({ id, ...info }));
}

/** Verifica se um identificador de gatilho existe no catálogo. */
export function gatilhoExiste(idGatilho) {
  return Object.hasOwn(CATALOGO_GATILHOS, idGatilho);
}

/** Retorna a severidade padrão de um gatilho, ou null se o gatilho não existir. */
export function severidadePadraoDoGatilho(idGatilho) {
  return CATALOGO_GATILHOS[idGatilho]?.severidadePadrao ?? null;
}
