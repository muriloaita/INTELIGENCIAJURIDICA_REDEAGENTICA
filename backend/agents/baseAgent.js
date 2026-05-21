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

    const startTime = Date.now();
    const result = await vertexClient.generateContent(
      this.model,
      systemPrompt,
      userPrompt,
      config
    );
    const executionTime = Date.now() - startTime;

    return {
      result: result.text,
      tokensInput: result.usageMetadata?.promptTokenCount || 0,
      tokensOutput: result.usageMetadata?.candidatesTokenCount || 0,
      executionTime,
      groundingSources: result.groundingMetadata || [],
    };
  }
}
