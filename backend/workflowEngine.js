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
   * @returns {Promise<string>} - workflowId
   */
  async startWorkflow(prazoData, agentConfigs, onEvent) {
    const workflowId = uuidv4();
    this.activeWorkflows.set(workflowId, { status: 'running', cancel: false });

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
        // Verificar cancelamento
        if (this.activeWorkflows.get(workflowId)?.cancel) {
          onEvent({ type: 'workflow_cancelled', workflowId });
          break;
        }

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

            // Filtrar por categoria da base de conhecimento se o tipo selecionado é uma categoria indexada
            const categoria = prazoData.tipoPeticao || null;
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

        // Acumular resultado
        accumulatedContext.phaseResults[phase.id] = result.result;

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
      }

      // Workflow concluído
      this.activeWorkflows.set(workflowId, {
        status: 'completed',
        cancel: false,
      });
      onEvent({ type: 'workflow_complete', workflowId });
    } catch (error) {
      console.error('[WorkflowEngine] Erro no workflow:', error);
      this.activeWorkflows.set(workflowId, {
        status: 'error',
        cancel: false,
      });
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
}
