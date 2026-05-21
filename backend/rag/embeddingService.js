/**
 * EmbeddingService - Serviço de geração de embeddings via Vertex AI
 * Suporta embedding individual e em lote com rate limiting
 */

export class EmbeddingService {
  /**
   * @param {import('../vertexClient.js').VertexClient} vertexClient
   */
  constructor(vertexClient) {
    this.vertexClient = vertexClient;
  }

  /**
   * Gera embedding para um único texto
   * @param {string} text - Texto para gerar embedding
   * @returns {Promise<number[]>} - Vetor de embedding (768 dimensões)
   */
  async embedText(text) {
    return this.vertexClient.embedText(text);
  }

  /**
   * Gera embeddings em lote com rate limiting
   * @param {string[]} texts - Array de textos
   * @param {number} batchSize - Tamanho do lote (padrão: 5)
   * @returns {Promise<number[][]>} - Array de vetores de embedding
   */
  async embedBatch(texts, batchSize = 5) {
    const embeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map((text) => this.vertexClient.embedText(text))
      );

      embeddings.push(...batchResults);

      // Delay de 200ms entre lotes para respeitar rate limit
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return embeddings;
  }
}
