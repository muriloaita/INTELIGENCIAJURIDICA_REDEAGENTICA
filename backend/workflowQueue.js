/**
 * WorkflowQueue — Gerenciador de fila de workflows da Rede Agêntica Jurídica
 * Controla a execução sequencial de múltiplos workflows com limites de concorrência
 */
import { v4 as uuidv4 } from 'uuid';

export class WorkflowQueue {
  /**
   * @param {import('./workflowEngine.js').WorkflowEngine} workflowEngine - Motor de execução de workflows
   * @param {function|null} createEventHandler - Factory: (workflowId, prazoData) => eventHandler
   */
  constructor(workflowEngine, createEventHandler) {
    this.workflowEngine = workflowEngine;
    this.createEventHandler = createEventHandler; // factory de handlers unificados
    this.queue = [];        // { id, prazoData, agentConfigs, createdAt }
    this.processing = null; // workflowId atualmente em execução
  }

  // Limites máximos do sistema
  static MAX_AWAITING_INPUT = 3;
  static MAX_READY_FOR_REVIEW = 15;
  static MAX_QUEUE = 20;

  /**
   * Enfileira um novo workflow para processamento
   * @param {object} prazoData - Dados da demanda/prazo
   * @param {object} agentConfigs - Configurações customizadas dos agentes
   * @returns {object} Item da fila criado
   */
  enqueue(prazoData, agentConfigs) {
    if (this.queue.length >= WorkflowQueue.MAX_QUEUE) {
      throw new Error(`Fila cheia. Máximo de ${WorkflowQueue.MAX_QUEUE} petições na fila.`);
    }
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const item = { id, prazoData, agentConfigs, createdAt: new Date().toISOString() };
    this.queue.push(item);
    this.tryProcessNext();
    return item;
  }

  /**
   * Remove um item da fila pelo ID
   * @param {string} queueId - ID do item na fila
   */
  dequeue(queueId) {
    this.queue = this.queue.filter(q => q.id !== queueId);
  }

  /**
   * Tenta processar o próximo item da fila
   * Respeita limites de concorrência e workflows pausados
   */
  tryProcessNext() {
    // Só inicia se não há nenhum workflow em execução
    if (this.processing) return;

    // Verificar se há workflows pausados demais (aguardando input do usuário)
    const awaitingCount = this.workflowEngine.getWorkflowsByStatus('awaiting_input').length;
    if (awaitingCount >= WorkflowQueue.MAX_AWAITING_INPUT) return;

    if (this.queue.length === 0) return;
    const next = this.queue.shift();
    this.startFromQueue(next);
  }

  /**
   * Inicia a execução de um item da fila
   * @param {object} item - Item da fila a ser processado
   */
  async startFromQueue(item) {
    // Gerar um workflowId estável para este item
    const workflowId = uuidv4();
    this.processing = workflowId;

    // Criar event handler unificado (DOCX + Supabase + SSE) usando a factory
    const externalHandler = this.createEventHandler
      ? this.createEventHandler(workflowId, item.prazoData)
      : null;

    try {
      await this.workflowEngine.startWorkflow(
        item.prazoData,
        item.agentConfigs,
        (event) => {
          // Delegar para o handler unificado (DOCX + persistence + SSE)
          if (externalHandler) externalHandler(event);

          // Gerenciamento da fila: liberar quando terminar
          if (['workflow_complete', 'error', 'workflow_cancelled'].includes(event.type)) {
            this.processing = null;
            // Auto-iniciar próximo após um pequeno delay
            setTimeout(() => this.tryProcessNext(), 2000);
          }
        },
        workflowId // Passar o ID para sincronismo
      );
    } catch (err) {
      console.error('[Queue] Erro ao processar:', err);
      this.processing = null;
      this.tryProcessNext();
    }
  }

  /**
   * Retorna o status atual da fila
   * @returns {object} Status completo da fila
   */
  getStatus() {
    return {
      queue: this.queue,
      queueLength: this.queue.length,
      maxQueue: WorkflowQueue.MAX_QUEUE,
      processing: this.processing,
      canEnqueue: this.queue.length < WorkflowQueue.MAX_QUEUE,
    };
  }
}
