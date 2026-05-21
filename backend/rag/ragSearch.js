/**
 * RagSearch - Busca RAG combinada (Embedding + VectorStore)
 * Combina geração de embeddings com busca por similaridade
 */

export class RagSearch {
  /**
   * @param {import('./embeddingService.js').EmbeddingService} embeddingService
   * @param {import('./vectorStore.js').VectorStore} vectorStore
   */
  constructor(embeddingService, vectorStore) {
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
  }

  /**
   * Busca documentos relevantes para uma query
   * @param {string} query - Texto de busca
   * @param {object} options - Opções de busca (topK, threshold, categoria)
   * @returns {Promise<object[]>} - Documentos similares com scores
   */
  async search(query, options = {}) {
    const queryEmbedding = await this.embeddingService.embedText(query);
    const results = await this.vectorStore.searchSimilar(queryEmbedding, options);
    return results;
  }

  /**
   * Formata os resultados da busca como contexto textual para o prompt do agente
   * @param {object[]} results - Resultados da busca
   * @returns {string} - Texto formatado para inclusão no prompt
   */
  formatContextForPrompt(results) {
    if (!results || results.length === 0) {
      return 'Nenhum documento relevante encontrado na base de conhecimento.';
    }

    const formatted = results
      .map((doc, index) => {
        const similaridade = doc.similarity
          ? Math.round(doc.similarity * 100)
          : '?';

        return [
          `[DOCUMENTO ${index + 1} — Similaridade: ${similaridade}%]`,
          `Título: ${doc.titulo || 'Sem título'}`,
          `Categoria: ${doc.categoria || 'N/A'}`,
          `Fonte: ${doc.documento_origem || 'N/A'}`,
          `Conteúdo:`,
          doc.conteudo || '',
          '---',
        ].join('\n');
      })
      .join('\n\n');

    return `=== BASE DE CONHECIMENTO (${results.length} documentos encontrados) ===\n\n${formatted}`;
  }
}
