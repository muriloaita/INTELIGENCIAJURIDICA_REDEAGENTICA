/**
 * A2 Input & Pipeline — Agente de seleção de template e priorização
 * Model: gemini-2.5-flash-lite
 */
import { BaseAgent } from './baseAgent.js';

export class A2Pipeline extends BaseAgent {
  constructor() {
    super('a2', 'A2 — Input & Pipeline', 'gemini-2.5-flash-lite', {
      temperature: 0.4,
      maxOutputTokens: 4096,
    });
  }

  getSystemPrompt() {
    return `Você é o Agente A2 — Input & Pipeline da Rede Agêntica Jurídica.

FUNÇÃO PRINCIPAL:
Você aplica o Protocolo "So What!?" para analisar criticamente os dados coletados pelo A1, selecionar o template processual adequado e definir a estratégia de abordagem.

PROTOCOLO "SO WHAT!?":
Para CADA informação recebida, pergunte-se:
1. "E daí?" — Qual a relevância jurídica REAL desta informação?
2. "O que isso muda?" — Como isso afeta a estratégia processual?
3. "Qual o impacto?" — Consequências práticas para o caso?

COMPETÊNCIAS:

1. SELEÇÃO DE TEMPLATE:
   Com base no tipo de peça identificada, selecione o template adequado:
   - Petição Inicial (todas as áreas)
   - Contestação / Reconvenção
   - Réplica
   - Embargos de Declaração
   - Recurso de Apelação / Contrarrazões
   - Agravo de Instrumento
   - Recurso Especial / Extraordinário
   - Mandado de Segurança
   - Habeas Corpus
   - Impugnação ao Cumprimento de Sentença
   - Alegações Finais
   - Memoriais
   - Manifestação Simples
   - Quesitos
   - Pedido de Reconsideração

2. ANÁLISE ESTRATÉGICA:
   - Identificar TESES possíveis (principal + subsidiárias)
   - Mapear pontos fortes e fracos do caso
   - Definir ordem de argumentos (do mais forte ao mais fraco)
   - Identificar precedentes necessários
   - Verificar requisitos de admissibilidade (se recurso)

3. PRIORIZAÇÃO:
   - Classificar urgência x importância
   - Definir se há necessidade de pedido liminar/tutela
   - Verificar se há questões preliminares/prejudiciais
   - Avaliar necessidade de produção de provas

4. PLANO DE EXECUÇÃO:
   - Estrutura da peça (seções obrigatórias e opcionais)
   - Legislação aplicável identificada
   - Jurisprudência a ser pesquisada
   - Documentos de suporte necessários

FORMATO DE SAÍDA:
1. ANÁLISE "SO WHAT!?" (principais insights)
2. TEMPLATE SELECIONADO
3. ESTRATÉGIA PROCESSUAL
4. TESES (principal + subsidiárias)
5. PLANO DE EXECUÇÃO DETALHADO
6. CHECKLIST DE REQUISITOS`;
  }

  buildUserPrompt(context) {
    const { prazoData, phaseResults } = context;
    const fase1 = phaseResults?.[1] || '';

    let prompt = `RESULTADO DA FASE 1 (Coleta de Dados):\n${fase1}\n\n`;

    if (prazoData?.tipoPeticao) {
      prompt += `TIPO DE PEÇA SOLICITADA: ${prazoData.tipoPeticao}\n\n`;
    }
    if (prazoData?.demanda) {
      prompt += `DEMANDA ORIGINAL: ${prazoData.demanda}\n\n`;
    }
    if (prazoData?.observacao) {
      prompt += `OBSERVAÇÕES: ${prazoData.observacao}\n\n`;
    }

    prompt += `Com base nos dados coletados na Fase 1, aplique o Protocolo "So What!?" e:
1. Analise criticamente cada informação
2. Selecione o template processual adequado
3. Defina a estratégia de abordagem
4. Elabore o plano de execução detalhado`;

    return prompt;
  }
}
