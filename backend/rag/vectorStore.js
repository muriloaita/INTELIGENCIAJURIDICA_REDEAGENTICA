/**
 * VectorStore - Interface com o Supabase para armazenamento e busca vetorial
 * Gerencia chunks de documentos e busca por similaridade
 */

export class VectorStore {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase
   */
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Insere chunks com seus embeddings no knowledge_base
   * @param {object[]} chunks - Array de objetos chunk (titulo, conteudo, etc.)
   * @param {number[][]} embeddings - Array de vetores de embedding correspondentes
   * @returns {Promise<{inserted: number, errors: string[]}>}
   */
  async insertChunks(chunks, embeddings) {
    const errors = [];
    let inserted = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      const record = {
        titulo: chunk.titulo,
        conteudo: chunk.conteudo,
        chunk_index: chunk.chunk_index,
        total_chunks: chunk.total_chunks,
        documento_origem: chunk.documento_origem,
        categoria: chunk.categoria,
        fonte: chunk.fonte,
        metadata: chunk.metadata || {},
        embedding,
      };

      const { error } = await this.supabase
        .from('knowledge_base')
        .insert(record);

      if (error) {
        errors.push(
          `Erro ao inserir chunk ${i} de "${chunk.documento_origem}": ${error.message}`
        );
      } else {
        inserted++;
      }
    }

    return { inserted, errors };
  }

  /**
   * Busca documentos similares usando a função match_documents do Supabase
   * @param {number[]} queryEmbedding - Vetor de embedding da query
   * @param {object} options - Opções de busca
   * @returns {Promise<object[]>} - Documentos similares ordenados por similaridade
   */
  async searchSimilar(queryEmbedding, options = {}) {
    const {
      topK = 5,
      threshold = 0.7,
      categoria = null,
    } = options;

    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: topK,
      filter_categoria: categoria,
    });

    if (error) {
      throw new Error(`[VectorStore] Erro na busca: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Remove todos os chunks de um documento específico
   * @param {string} documentoOrigem - Nome do documento de origem
   * @returns {Promise<{deleted: number}>}
   */
  async deleteByDocumento(documentoOrigem) {
    const { data, error } = await this.supabase
      .from('knowledge_base')
      .delete()
      .eq('documento_origem', documentoOrigem)
      .select('id');

    if (error) {
      throw new Error(`[VectorStore] Erro ao deletar: ${error.message}`);
    }

    return { deleted: data?.length || 0 };
  }

  /**
   * Retorna estatísticas gerais da base de conhecimento
   * @returns {Promise<{totalDocumentos: number, totalChunks: number, porCategoria: object}>}
   */
  async getStats() {
    // Total de chunks
    const { count: totalChunks, error: countError } = await this.supabase
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`[VectorStore] Erro ao contar chunks: ${countError.message}`);
    }

    // Documentos distintos — buscar paginado para evitar o limit de 1000
    let allDocOrigens = [];
    let page = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await this.supabase
        .from('knowledge_base')
        .select('documento_origem')
        .range(page * batchSize, (page + 1) * batchSize - 1);

      if (error) throw new Error(`[VectorStore] Erro ao listar documentos: ${error.message}`);
      if (!data || data.length === 0) break;
      allDocOrigens.push(...data);
      if (data.length < batchSize) break;
      page++;
    }

    const documentosUnicos = new Set(allDocOrigens.map((d) => d.documento_origem));

    // Contagem por categoria — buscar paginado
    let allCats = [];
    page = 0;
    while (true) {
      const { data, error } = await this.supabase
        .from('knowledge_base')
        .select('categoria')
        .range(page * batchSize, (page + 1) * batchSize - 1);

      if (error) throw new Error(`[VectorStore] Erro ao contar categorias: ${error.message}`);
      if (!data || data.length === 0) break;
      allCats.push(...data);
      if (data.length < batchSize) break;
      page++;
    }

    const porCategoria = {};
    allCats.forEach((row) => {
      const cat = row.categoria || 'sem_categoria';
      porCategoria[cat] = (porCategoria[cat] || 0) + 1;
    });

    return {
      totalDocumentos: documentosUnicos.size,
      totalChunks: totalChunks || 0,
      porCategoria,
    };
  }

  /**
   * Lista chunks com paginação
   * @param {number} page - Número da página (1-indexed)
   * @param {number} pageSize - Tamanho da página
   * @param {string|null} categoria - Filtro opcional de categoria
   * @returns {Promise<{data: object[], total: number, page: number, pageSize: number}>}
   */
  async listDocuments(page = 1, pageSize = 20, categoria = null) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from('knowledge_base')
      .select('id, titulo, documento_origem, categoria, fonte, chunk_index, total_chunks, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (categoria) {
      query = query.eq('categoria', categoria);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`[VectorStore] Erro ao listar: ${error.message}`);
    }

    return {
      data: data || [],
      total: count || 0,
      page,
      pageSize,
    };
  }
}
