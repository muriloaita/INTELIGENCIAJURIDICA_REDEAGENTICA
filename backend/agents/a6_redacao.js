/**
 * A6 Redação Estratégica — Agente redator da peça jurídica completa
 * Model: gemini-2.5-pro (useGrounding: true, maxOutputTokens: 8192)
 */
import { BaseAgent } from './baseAgent.js';

export class A6Redacao extends BaseAgent {
  constructor() {
    super('a6', 'A6 — Redação Estratégica', 'gemini-2.5-pro', {
      temperature: 0.6,
      maxOutputTokens: 8192,
      useGrounding: true,
    });
  }

  getSystemPrompt() {
    return `Você é o Agente A6 — Redação Estratégica da Rede Agêntica Jurídica.

FUNÇÃO PRINCIPAL:
Você é o REDATOR CHEFE. Redigirá a peça jurídica completa com base em TODO o trabalho realizado pelas fases anteriores (A1 a A5). Sua produção deve ter qualidade de peça profissional, pronta para protocolo.

PADRÃO DE EXCELÊNCIA:
Você deve produzir peças no nível de um advogado sênior com 20+ anos de experiência, especialista na área do caso.

ESTRUTURA DE PEÇAS JURÍDICAS BRASILEIRAS:

Para PETIÇÃO INICIAL:
1. Endereçamento (ao juízo competente, com a vara correta)
2. Qualificação das Partes (completa, conforme art. 319 do CPC)
3. Dos Fatos (narrativa cronológica, clara e objetiva)
4. Do Direito (fundamentação jurídica detalhada)
5. Da Jurisprudência (precedentes relevantes com citações completas)
6. Dos Pedidos (específicos, conforme art. 324 do CPC)
7. Do Valor da Causa (fundamentado)
8. Requerimentos Finais (provas, citação, etc.)

Para RECURSO DE APELAÇÃO:
1. Endereçamento (ao juízo a quo para encaminhamento ao tribunal)
2. Tempestividade e Preparo
3. Dos Fatos e do Processado
4. Das Razões Recursais
   a) Preliminares (se houver)
   b) Mérito
5. Da Jurisprudência Favorável
6. Do Pedido de Provimento
7. Requerimentos

Para EMBARGOS DE DECLARAÇÃO:
1. Endereçamento
2. Tempestividade
3. Cabimento (omissão, contradição, obscuridade ou erro material)
4. Da(s) Omissão(ões) / Contradição(ões) / Obscuridade(s)
5. Dos Efeitos Infringentes (se aplicável)
6. Prequestionamento (se aplicável)
7. Pedido

Para AGRAVO DE INSTRUMENTO:
1. Endereçamento (ao tribunal competente)
2. Tempestividade
3. Cabimento (art. 1.015 do CPC — rol taxativo/mitigado)
4. Da Decisão Agravada
5. Das Razões para Reforma
6. Do Pedido de Efeito Suspensivo/Ativo (se aplicável)
7. Do Pedido de Provimento

Para CONTESTAÇÃO:
1. Endereçamento
2. Tempestividade
3. Preliminares (art. 337 do CPC)
4. Prejudiciais de Mérito (prescrição, decadência)
5. Do Mérito
6. Da Jurisprudência
7. Dos Pedidos
8. Requerimentos (provas)

REGRAS DE REDAÇÃO:
- Use linguagem jurídica formal, mas acessível
- Parágrafos curtos e objetivos (máximo 5-6 linhas)
- SEMPRE cite artigos de lei com exatidão
- SEMPRE cite jurisprudência com: Tribunal, tipo de recurso, número, relator, data e ementa
- Use negrito para destaques importantes
- Use citações em bloco (recuo) para transcrições de decisões
- NUNCA invente jurisprudência — use apenas as fornecidas pelos agentes anteriores ou pelo grounding
- Adapte o tom ao tipo de peça (mais combativo em recursos, mais técnico em iniciais)
- Integre os argumentos de superação do Steel Man (A5) como blindagem da tese

FORMATAÇÃO:
- Use formatação Markdown para estruturar a peça
- Negrito para destaques: **texto importante**
- Citações em bloco: > texto citado
- Numeração para requisitos e pedidos

QUALIDADE:
- A peça deve estar PRONTA para protocolo
- Verifique coerência interna entre fatos, direito e pedidos
- Garanta que TODOS os pedidos têm fundamentação correspondente
- Inclua pedido de justiça gratuita se aplicável
- Data e local ao final`;
  }

  buildUserPrompt(context) {
    const { prazoData, phaseResults, ragContext, templateContext } = context;
    const fase1 = phaseResults?.[1] || '';
    const fase2 = phaseResults?.[2] || '';
    const fase3 = phaseResults?.[3] || '';
    const fase4 = phaseResults?.[4] || '';
    const fase5 = phaseResults?.[5] || '';

    let prompt = `MATERIAL COMPLETO PARA REDAÇÃO DA PEÇA JURÍDICA:\n\n`;

    // Template de referência (estrutura do documento)
    if (templateContext) {
      prompt += `═══ TEMPLATE / MODELO ESTRUTURAL ═══\nUse este template como REFERÊNCIA DE ESTRUTURA para a peça. Siga a organização, formatação e estilo indicados.\n${templateContext}\n\n`;
    }

    // Contexto RAG (peças similares da base de conhecimento)
    if (ragContext) {
      prompt += `═══ BASE DE CONHECIMENTO INTERNA (Peças Similares de Referência) ═══\nEstas são peças jurídicas reais do escritório com conteúdo similar. Use como REFERÊNCIA DE CONTEÚDO, argumentação e estilo de redação.\n${ragContext}\n\n`;
    }

    // Dados originais
    prompt += `═══ DADOS DO CASO ═══\n`;
    if (prazoData?.demanda) prompt += `Demanda: ${prazoData.demanda}\n`;
    if (prazoData?.autos) prompt += `Autos: ${prazoData.autos}\n`;
    if (prazoData?.tipoPeticao) prompt += `Tipo de Peça: ${prazoData.tipoPeticao}\n`;
    if (prazoData?.observacao) prompt += `Observações: ${prazoData.observacao}\n`;
    prompt += `\n`;

    // Resultados de todas as fases
    prompt += `═══ FASE 1 — DADOS PROCESSUAIS COLETADOS ═══\n${fase1}\n\n`;
    prompt += `═══ FASE 2 — ESTRATÉGIA E PLANO DE EXECUÇÃO ═══\n${fase2}\n\n`;
    prompt += `═══ FASE 3 — FUNDAMENTAÇÃO JURÍDICA COMPLETA ═══\n${fase3}\n\n`;
    prompt += `═══ FASE 4 — SÍNTESE R.O.P.A. ═══\n${fase4}\n\n`;
    prompt += `═══ FASE 5 — STEEL MAN (Análise Adversária + Superação) ═══\n${fase5}\n\n`;

    prompt += `INSTRUÇÕES FINAIS:
1. Redija a peça jurídica COMPLETA no tipo "${prazoData?.tipoPeticao || 'petição'}"
2. PRIORIZE a estrutura do TEMPLATE (se fornecido) para a formatação da peça
3. Use as PEÇAS DA BASE DE CONHECIMENTO como referência de estilo, argumentação e qualidade
4. Integre TODA a fundamentação das fases anteriores
5. Incorpore as superações do Steel Man como blindagem argumentativa
6. A peça deve estar PRONTA para protocolo judicial
7. Mantenha o padrão de qualidade e linguagem do escritório Marques & Gameiro`;

    return prompt;
  }
}
