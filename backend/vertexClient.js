/**
 * VertexClient - Cliente unificado para Gemini AI
 * Usa API Key (Google AI Studio) para generateContent e embeddings
 * Mantém fallback para GoogleAuth (ADC) para o proxy Vertex AI
 */
import fetch from 'node-fetch';

export class VertexClient {
  /**
   * @param {import('google-auth-library').GoogleAuth} auth - Instância do GoogleAuth (para proxy)
   * @param {string} project - Google Cloud Project ID
   * @param {string} location - Google Cloud Location
   */
  constructor(auth, project, location) {
    this.auth = auth;
    this.project = project;
    this.region = location === 'global' ? 'us-central1' : location;
    this.apiKey = process?.env?.GEMINI_API_KEY || null;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Constrói URL para a API Gemini (com API Key)
   */
  _buildGeminiUrl(model, method) {
    return `${this.baseUrl}/models/${model}:${method}?key=${this.apiKey}`;
  }

  /**
   * Gera conteúdo usando Gemini API
   * @param {string} model - Nome do modelo (ex: 'gemini-2.5-flash')
   * @param {string} systemPrompt - System instruction
   * @param {string} userPrompt - Prompt do usuário
   * @param {object} config - Configurações do agente
   * @returns {Promise<{text: string, usageMetadata: object, groundingMetadata: any[]}>}
   */
  async generateContent(model, systemPrompt, userPrompt, config = {}) {
    const url = this._buildGeminiUrl(model, 'generateContent');

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxOutputTokens ?? 4096,
      },
    };

    // Configurar thinking budget se especificado
    if (config.thinkingBudget !== null && config.thinkingBudget !== undefined) {
      requestBody.generationConfig.thinkingConfig = {
        thinkingBudget: config.thinkingBudget,
      };
    }

    // Adicionar Google Search Grounding se habilitado
    if (config.useGrounding) {
      requestBody.tools = [
        {
          googleSearch: {},
        },
      ];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `[VertexClient] Erro na API (${response.status}): ${errorBody}`
      );
    }

    const data = await response.json();

    // Extrair texto da resposta
    const candidate = data.candidates?.[0];
    let text = '';
    if (candidate?.content?.parts) {
      // Filtrar partes de thinking (thoughts) e pegar apenas o texto final
      text = candidate.content.parts
        .filter((p) => p.text && !p.thought)
        .map((p) => p.text)
        .join('');
    }

    // Extrair grounding metadata se disponível
    const groundingMetadata = candidate?.groundingMetadata?.groundingChunks || [];

    return {
      text,
      usageMetadata: data.usageMetadata || {},
      groundingMetadata,
    };
  }

  /**
   * Gera embedding para um texto usando text-embedding-004
   * @param {string} text - Texto para gerar embedding
   * @returns {Promise<number[]>} - Vetor de embedding (768 dimensões)
   */
  async embedText(text) {
    const url = this._buildGeminiUrl('gemini-embedding-001', 'embedContent');

    const requestBody = {
      content: {
        parts: [{ text }],
      },
      outputDimensionality: 768,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `[VertexClient] Erro no embedding (${response.status}): ${errorBody}`
      );
    }

    const data = await response.json();
    return data.embedding?.values || [];
  }
}
