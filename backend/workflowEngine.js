/**
 * WorkflowEngine - Motor de orquestração da Rede Agêntica Jurídica
 * Executa as 7 fases sequencialmente com busca RAG, SSE events e persistência
 */
import { v4 as uuidv4 } from 'uuid';
import { A1Coletor } from './agents/a1_coletor.js';
import { A2Pipeline } from './agents/a2_pipeline.js';
import { A3Conhecimento } from './agents/a3_conhecimento.js';
import { A4Sintese } from './agents/a4_sintese.js';
import { A5SteelMan } from './agents/a5_steelman.js';
import { A6Redacao } from './agents/a6_redacao.js';
import { A7Revisor } from './agents/a7_revisor.js';

export class WorkflowEngine {
  /**
   * @param {import('./vertexClient.js').VertexClient} vertexClient
   * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
   * @param {import('./rag/ragSearch.js').RagSearch|null} ragSearch
   */
  constructor(vertexClient, supabaseClient, ragSearch) {
    this.vertexClient = vertexClient;
    this.supabase = supabaseClient;
    this.ragSearch = ragSearch;
    this.activeWorkflows = new Map();
  }

  /**
   * Inicia um workflow completo com 7 fases
   * @param {object} prazoData - Dados da demanda
   * @param {object} agentConfigs - Configurações customizadas por agente
   * @param {function} onEvent - Callback para emitir eventos SSE
   * @param {string} [externalWorkflowId] - ID externo (do server) para manter sincronismo com SSE
   * @returns {Promise<string>} - workflowId
   */
  async startWorkflow(prazoData, agentConfigs, onEvent, externalWorkflowId = null) {
    const workflowId = externalWorkflowId || uuidv4();
    this.activeWorkflows.set(workflowId, {
      status: 'running',       // 'running' | 'awaiting_input' | 'completed' | 'error' | 'cancelled'
      cancel: false,
      prazoData,
      currentPhase: null,      // ID da fase em execução
      completedPhases: [],     // IDs das fases concluídas
      phaseResults: {},        // Resultados acumulados de cada fase
      checkpointData: null,    // Dados do checkpoint quando pausado
      docxUrl: null,           // URL do DOCX gerado
      createdAt: new Date().toISOString(),
      resumeResolve: null,     // Promise resolve para retomar após checkpoint
    });

    const phases = [
      { id: 1, agent: new A1Coletor(), name: 'Coleta & Organização' },
      { id: 2, agent: new A2Pipeline(), name: 'Intenção & Conhecimento' },
      { id: 3, agent: new A3Conhecimento(), name: 'Gestão de Conhecimento', useRag: true },
      { id: 4, agent: new A4Sintese(), name: 'Síntese R.O.P.A.' },
      { id: 5, agent: new A5SteelMan(), name: 'Gestão de Risco' },
      { id: 6, agent: new A6Redacao(), name: 'Redação Estratégica', useRag: true },
      { id: 7, agent: new A7Revisor(), name: 'Revisão & Validação' },
    ];

    const accumulatedContext = { prazoData, phaseResults: {} };

    // Pré-carregar template se existir para o tipo de petição
    let templateContext = null;
    try {
      const tipoPeticao = prazoData.tipoPeticao || '';
      const { data: templates } = await this.supabase
        .from('templates')
        .select('*')
        .or(`category.ilike.%${tipoPeticao}%,name.ilike.%${tipoPeticao}%`)
        .limit(1);

      if (templates && templates.length > 0) {
        const tmpl = templates[0];
        templateContext = `══ TEMPLATE DE REFERÊNCIA ══\n` +
          `Nome: ${tmpl.name}\n` +
          `Categoria: ${tmpl.category}\n` +
          `Instruções: ${tmpl.instructions || ''}\n` +
          `Descrição: ${tmpl.description || ''}\n` +
          (tmpl.content ? `\nConteúdo do Template:\n${tmpl.content}\n` : '');
        console.log(`[WorkflowEngine] Template encontrado: "${tmpl.name}"`);
      }
    } catch (err) {
      console.log('[WorkflowEngine] Nenhum template encontrado, seguindo sem template.');
    }

    try {
      for (const phase of phases) {
        const wf = this.activeWorkflows.get(workflowId);

        // Verificar cancelamento
        if (wf?.cancel) {
          wf.status = 'cancelled';
          onEvent({ type: 'workflow_cancelled', workflowId });
          break;
        }

        // Atualizar fase atual no estado do workflow
        wf.currentPhase = phase.id;

        // Emitir início da fase
        onEvent({
          type: 'phase_start',
          phaseId: phase.id,
          name: phase.name,
          workflowId,
        });

        // Busca RAG antes das fases 3 e 6
        let ragContext = null;
        if (phase.useRag && this.ragSearch) {
          try {
            const query = [
              prazoData.tipoPeticao,
              prazoData.observacao || '',
              prazoData.demanda,
            ]
              .filter(Boolean)
              .join(' ');

            // Filtrar por categoria da base de conhecimento
            // Mapear nomes legíveis para slugs da base (quando selecionam do dropdown fallback)
            const LABEL_TO_SLUG = {
              'MANIFESTAÇÃO DA PARTE': 'manifestacao',
              'ESPECIFICAÇÃO DE PROVAS': 'geral',
              'IMPUGNAÇÃO À CONTESTAÇÃO': 'impugnacao',
              'QUESITOS': 'quesitos',
              'CUMPRIMENTO DE INTIMAÇÃO': 'cumprimento_sentenca',
              'AGRAVO DE INSTRUMENTO': 'agravo_instrumento',
              'EMBARGOS DE DECLARAÇÃO': 'embargos_declaracao',
              'RECURSO DE APELAÇÃO': 'recurso_apelacao',
              'RECURSO INOMINADO': 'recurso_apelacao',
              'OUTRAS': null,
            };
            const tipoPeticao = prazoData.tipoPeticao || '';
            const categoria = LABEL_TO_SLUG[tipoPeticao] !== undefined
              ? LABEL_TO_SLUG[tipoPeticao]
              : tipoPeticao; // Se já é um slug da base, usa direto

            // Tentar busca filtrada primeiro (mais relevante), depois busca geral
            let ragResults = await this.ragSearch.search(query, {
              topK: 10,
              categoria,
            });

            // Se a busca filtrada retornou poucos resultados, complementar com busca geral
            if (ragResults.length < 3) {
              const geralResults = await this.ragSearch.search(query, { topK: 5 });
              // Combinar sem duplicatas
              const ids = new Set(ragResults.map((r) => r.id));
              for (const r of geralResults) {
                if (!ids.has(r.id)) ragResults.push(r);
              }
            }

            ragContext = this.ragSearch.formatContextForPrompt(ragResults);
            console.log(`[WorkflowEngine] RAG Fase ${phase.id}: ${ragResults.length} docs encontrados (categoria: ${categoria || 'geral'})`);
          } catch (err) {
            console.error(`[WorkflowEngine] Erro na busca RAG (fase ${phase.id}):`, err.message);
          }
        }

        // Montar contexto para o agente — inclui RAG + Template
        const context = { ...accumulatedContext, ragContext, templateContext };
        const agentConfig = agentConfigs?.[phase.agent.id];

        // Executar agente
        const result = await phase.agent.execute(
          this.vertexClient,
          context,
          agentConfig
        );

        // Acumular resultado no contexto de execução e no estado do workflow
        accumulatedContext.phaseResults[phase.id] = result.result;
        wf.phaseResults[phase.id] = result.result;

        // ── Checkpoint Humano após Fase 3 (Gestão de Conhecimento) ──
        // Lógica simplificada: só interromper se os dados de ENTRADA do usuário
        // são insuficientes para redigir a peça. Se o usuário informou o nº
        // do processo, a base de conhecimento tem tudo que precisa.
        if (phase.id === 3) {
          const hasTipoPeticao = !!(prazoData.tipoPeticao && prazoData.tipoPeticao.trim());
          const hasDemanda = !!(prazoData.demanda && prazoData.demanda.trim());
          const hasAutos = !!(prazoData.autos && prazoData.autos.trim());

          // Só pausar se NÃO temos tipo de petição E NÃO temos descrição da demanda
          // (se o usuário forneceu pelo menos um desses, o sistema consegue prosseguir)
          const shouldPause = !hasTipoPeticao && !hasDemanda;

          if (shouldPause) {
            console.log('[WorkflowEngine] Dados insuficientes para redigir. Pausando para solicitar informações.');

            const checkpointData = {
              items: [
                ...(!hasTipoPeticao ? [{ item: 'Tipo de Peça', status: 'AUSENTE', mensagem: 'Informe o tipo de petição a ser redigida (ex: Manifestação, Embargos, Recurso).' }] : []),
                ...(!hasDemanda ? [{ item: 'Descrição da Demanda', status: 'AUSENTE', mensagem: 'Descreva brevemente o que deve ser argumentado na peça.' }] : []),
                ...(!hasAutos ? [{ item: 'Número do Processo', status: 'INCOMPLETO', mensagem: 'Informar o número dos autos pode melhorar a qualidade da peça (opcional).' }] : []),
              ],
              pode_prosseguir: false,
              motivo: 'Informe ao menos o tipo de peça ou a descrição da demanda para prosseguir.',
            };

            wf.status = 'awaiting_input';
            wf.checkpointData = checkpointData;

            onEvent({
              type: 'checkpoint_required',
              workflowId,
              checkpointData,
            });

            // Aguardar resposta do usuário
            await new Promise((resolve) => {
              wf.resumeResolve = resolve;
            });

            // Verificar se foi cancelado enquanto aguardava
            if (wf.cancel) {
              wf.status = 'cancelled';
              onEvent({ type: 'workflow_cancelled', workflowId });
              return workflowId;
            }

            // Retomar
            wf.status = 'running';
            wf.checkpointData = null;

            if (wf.phaseResults['user_checkpoint_response']) {
              accumulatedContext.phaseResults['user_checkpoint_response'] = wf.phaseResults['user_checkpoint_response'];
            }

            onEvent({ type: 'checkpoint_resolved', workflowId });
          } else {
            console.log(`[WorkflowEngine] Dados suficientes (tipo=${hasTipoPeticao}, demanda=${hasDemanda}, autos=${hasAutos}). Prosseguindo sem interrupção.`);
          }
        }

        // Salvar no Supabase
        try {
          await this.supabase.from('workflow_executions').insert({
            workflow_id: workflowId,
            phase_id: phase.id,
            agent_id: phase.agent.id,
            input_context: JSON.stringify({ prazoData }).substring(0, 5000),
            output_result: result.result,
            rag_documents_used: ragContext
              ? [ragContext.substring(0, 1000)]
              : [],
            grounding_sources: result.groundingSources || [],
            tokens_input: result.tokensInput,
            tokens_output: result.tokensOutput,
            execution_time_ms: result.executionTime,
          });
        } catch (dbErr) {
          console.error(
            `[WorkflowEngine] Erro ao salvar fase ${phase.id} no Supabase:`,
            dbErr.message
          );
        }

        // Emitir resultado da fase
        onEvent({
          type: 'phase_complete',
          phaseId: phase.id,
          name: phase.name,
          result: result.result,
          tokensInput: result.tokensInput,
          tokensOutput: result.tokensOutput,
          executionTime: result.executionTime,
          workflowId,
        });

        // Marcar fase como concluída no estado do workflow
        wf.completedPhases.push(phase.id);
      }

      // Workflow concluído — atualizar estado preservando dados acumulados
      const wfFinal = this.activeWorkflows.get(workflowId);
      if (wfFinal && wfFinal.status !== 'cancelled') {
        wfFinal.status = 'completed';
        wfFinal.currentPhase = null;
        onEvent({ type: 'workflow_complete', workflowId });
      }
    } catch (error) {
      console.error('[WorkflowEngine] Erro no workflow:', error);
      const wfErr = this.activeWorkflows.get(workflowId);
      if (wfErr) {
        wfErr.status = 'error';
        wfErr.currentPhase = null;
      }
      onEvent({
        type: 'error',
        error: error.message,
        workflowId,
      });
    }

    return workflowId;
  }

  /**
   * Para um workflow em execução
   * @param {string} workflowId
   */
  stopWorkflow(workflowId) {
    const wf = this.activeWorkflows.get(workflowId);
    if (wf) {
      wf.cancel = true;
      // Se está aguardando input, resolver a Promise para desbloquear o loop
      if (wf.resumeResolve) {
        wf.resumeResolve();
        wf.resumeResolve = null;
      }
      console.log(`[WorkflowEngine] Workflow ${workflowId} marcado para cancelamento.`);
    }
  }

  /**
   * Retorna o status de um workflow
   * @param {string} workflowId
   * @returns {object|null}
   */
  getWorkflowStatus(workflowId) {
    return this.activeWorkflows.get(workflowId) || null;
  }

  /**
   * Faz o parse do bloco CHECKLIST_VALIDACAO_JSON do output do A2
   * @param {string} text - Texto completo do output do agente
   * @returns {object|null} Dados da checklist parseados ou null
   */
  parseChecklist(text) {
    // Tentar vários padrões de extração (o LLM pode formatar de formas diferentes)
    const patterns = [
      /---CHECKLIST_VALIDACAO_JSON---([\s\S]*?)---FIM_CHECKLIST---/,
      /```json\s*\n?([\s\S]*?)\n?```\s*---FIM_CHECKLIST---/,
      /CHECKLIST_VALIDACAO_JSON[\s\-]*\n?([\s\S]*?)\n?[\s\-]*FIM_CHECKLIST/,
      /```json\s*\n?(\{[\s\S]*?"pode_prosseguir"[\s\S]*?\})\n?```/,
      /(\{[\s\S]*?"items"[\s\S]*?"pode_prosseguir"[\s\S]*?\})/,
    ];

    let jsonStr = null;
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        jsonStr = match[1].trim();
        console.log(`[WorkflowEngine] Checklist encontrada com padrão: ${pattern.source.substring(0, 40)}...`);
        break;
      }
    }

    if (!jsonStr) {
      console.warn('[WorkflowEngine] Nenhum bloco de checklist encontrado no output do A2.');
      console.warn('[WorkflowEngine] Primeiros 500 chars do output:', text.substring(0, 500));
      return null;
    }

    try {
      // Limpar possíveis artefatos de markdown
      jsonStr = jsonStr.replace(/^```json\s*\n?/, '').replace(/\n?```$/, '').trim();
      
      // Tentar parsear
      const parsed = JSON.parse(jsonStr);
      
      // Normalizar pode_prosseguir (o LLM pode retornar string "true"/"false")
      if (typeof parsed.pode_prosseguir === 'string') {
        parsed.pode_prosseguir = parsed.pode_prosseguir.toLowerCase() === 'true';
      }
      
      console.log(`[WorkflowEngine] Checklist parseada com sucesso. pode_prosseguir=${parsed.pode_prosseguir}`);
      return parsed;
    } catch (e) {
      console.error('[WorkflowEngine] Erro ao parsear JSON da checklist:', e.message);
      console.error('[WorkflowEngine] JSON tentado:', jsonStr.substring(0, 300));
      return null;
    }
  }

  /**
   * Retorna termos de busca para verificar se um item da checklist foi encontrado na base de conhecimento
   * @param {string} itemName - Nome do item em lowercase
   * @returns {string[]} Lista de termos para buscar no output da Fase 3
   */
  getSearchTermsForItem(itemName) {
    const termMap = {
      'número do processo': ['processo', 'autos n', 'autos:', 'nº'],
      'partes (autor/réu)': ['autor', 'réu', 'requerente', 'requerido', 'apelante', 'apelado', 'embargante', 'embargado', 'impetrante', 'impetrado', 'agravante', 'agravado'],
      'tipo de peça': ['petição', 'peça', 'embargos', 'recurso', 'apelação', 'contestação', 'manifestação', 'agravo'],
      'matéria jurídica': ['direito civil', 'direito penal', 'direito trabalhista', 'direito tributário', 'direito administrativo', 'consumerista', 'contratual', 'bancário', 'obrigacional', 'responsabilidade civil'],
      'prazo fatal': ['prazo', 'intimação', 'publicação', 'dias úteis', 'dies a quo'],
      'foro/vara': ['vara', 'foro', 'comarca', 'juízo', 'tribunal', 'seção', 'turma'],
      'documentos de suporte': ['documento', 'prova', 'anexo', 'certidão', 'contrato', 'comprovante'],
    };
    return termMap[itemName] || [itemName];
  }

  /**
   * Retoma um workflow que está aguardando input do usuário
   * @param {string} workflowId - ID do workflow a ser retomado
   * @param {object} userResponses - Respostas do usuário para o checkpoint
   */
  resumeWorkflow(workflowId, userResponses) {
    const wf = this.activeWorkflows.get(workflowId);
    if (!wf || wf.status !== 'awaiting_input') {
      throw new Error('Workflow não encontrado ou não está aguardando input.');
    }
    // Injetar respostas do usuário no contexto acumulado do workflow
    if (userResponses) {
      wf.phaseResults['user_checkpoint_response'] = JSON.stringify(userResponses);
    }
    // Liberar a Promise que está bloqueando a execução do workflow
    if (wf.resumeResolve) {
      wf.resumeResolve();
      wf.resumeResolve = null;
    }
  }

  /**
   * Retorna workflows filtrados por status
   * @param {string} status - Status a filtrar ('running', 'awaiting_input', 'completed', 'error', 'cancelled')
   * @returns {Array<object>} Lista de workflows com o status especificado
   */
  getWorkflowsByStatus(status) {
    const results = [];
    for (const [id, wf] of this.activeWorkflows) {
      if (wf.status === status) results.push({ id, ...wf });
    }
    return results;
  }

  /**
   * Retorna todos os workflows ativos com dados resumidos
   * @returns {Array<object>} Lista de todos os workflows
   */
  getAllWorkflows() {
    const results = [];
    for (const [id, wf] of this.activeWorkflows) {
      results.push({
        id,
        status: wf.status,
        prazoData: wf.prazoData,
        currentPhase: wf.currentPhase,
        completedPhases: wf.completedPhases,
        checkpointData: wf.checkpointData,
        docxUrl: wf.docxUrl,
        createdAt: wf.createdAt,
      });
    }
    return results;
  }
}
