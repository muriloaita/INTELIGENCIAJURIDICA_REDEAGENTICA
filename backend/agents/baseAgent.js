/**
 * BaseAgent - Classe base para todos os agentes da Rede Agêntica Jurídica
 * Define interface padrão e lógica de execução comum
 */

export class BaseAgent {
  /**
   * @param {string} id - Identificador único do agente (ex: 'a1', 'a2')
   * @param {string} name - Nome descritivo do agente
   * @param {string} model - Modelo Vertex AI a ser usado
   * @param {object} config - Configurações do agente
   */
  constructor(id, name, model, config = {}) {
    this.id = id;
    this.name = name;
    this.model = model;
    this.config = {
      temperature: 0.7,
      maxOutputTokens: 4096,
      thinkingBudget: null,
      useGrounding: false,
      ...config,
    };
  }

  /**
   * Retorna o system prompt do agente (deve ser implementado pela subclasse)
   * @returns {string}
   */
  getSystemPrompt() {
    throw new Error('Implementar getSystemPrompt() na subclasse');
  }

  /**
   * Constrói o prompt do usuário com base no contexto (deve ser implementado pela subclasse)
   * @param {object} context - Contexto acumulado do workflow
   * @returns {string}
   */
  buildUserPrompt(context) {
    throw new Error('Implementar buildUserPrompt() na subclasse');
  }

  /**
   * Executa o agente: monta prompt, chama Vertex AI, retorna resultado estruturado
   * @param {import('../vertexClient.js').VertexClient} vertexClient - Cliente Vertex AI
   * @param {object} context - Contexto acumulado do workflow
   * @param {object|null} agentConfig - Configurações adicionais do usuário para este agente
   * @returns {Promise<{result: string, tokensInput: number, tokensOutput: number, executionTime: number, groundingSources: any[]}>}
   */
  async execute(vertexClient, context, agentConfig = null) {
    let systemPrompt = this.getSystemPrompt();

    // Adicionar instruções customizadas do usuário se fornecidas
    if (agentConfig?.customInstructions) {
      systemPrompt +=
        '\n\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n' +
        agentConfig.customInstructions;
    }

    const userPrompt = this.buildUserPrompt(context);

    const config = { ...this.config };
    if (this.config.useGrounding) {
      config.useGrounding = true;
    }

    // ── Retry automático para erros transientes (503, 429) ──
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [5000, 15000, 30000]; // 5s, 15s, 30s

    let lastError = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const startTime = Date.now();
        const result = await vertexClient.generateContent(
          this.model,
          systemPrompt,
          userPrompt,
          config
        );
        const executionTime = Date.now() - startTime;

        if (attempt > 0) {
          console.log(`[${this.name}] ✅ Sucesso na tentativa ${attempt + 1} após retry.`);
        }

        return {
          result: result.text,
          tokensInput: result.usageMetadata?.promptTokenCount || 0,
          tokensOutput: result.usageMetadata?.candidatesTokenCount || 0,
          executionTime,
          groundingSources: result.groundingMetadata || [],
        };
      } catch (error) {
        lastError = error;
        const isRetryable = error.message &&
          (error.message.includes('503') ||
           error.message.includes('429') ||
           error.message.includes('UNAVAILABLE') ||
           error.message.includes('high demand') ||
           error.message.includes('overloaded') ||
           error.message.includes('RESOURCE_EXHAUSTED'));

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt];
          console.warn(`[${this.name}] ⚠️ Erro transiente (tentativa ${attempt + 1}/${MAX_RETRIES + 1}): ${error.message.substring(0, 100)}`);
          console.warn(`[${this.name}] ⏳ Aguardando ${delay / 1000}s antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error; // Erro não recuperável ou esgotou tentativas
        }
      }
    }
    throw lastError;
  }
}
