import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from './Icons';
import { KnowledgeDocument, KnowledgeStats, SearchResult } from '../types';

// ── Categoria badges colors ─────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  'Trabalhista': 'bg-blue-50 text-blue-700 border-blue-200',
  'Cível': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Criminal': 'bg-red-50 text-red-700 border-red-200',
  'Tributário': 'bg-amber-50 text-amber-700 border-amber-200',
  'Administrativo': 'bg-purple-50 text-purple-700 border-purple-200',
  'Constitucional': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Empresarial': 'bg-pink-50 text-pink-700 border-pink-200',
  'Previdenciário': 'bg-teal-50 text-teal-700 border-teal-200',
};

const getCategoryColor = (categoria: string) =>
  CATEGORY_COLORS[categoria] || 'bg-gray-50 text-gray-700 border-gray-200';

export const KnowledgeBaseView: React.FC = () => {
  // ── Estado ─────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<KnowledgeStats>({ totalDocumentos: 0, totalChunks: 0, porCategoria: {} });
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategoria, setSearchCategoria] = useState('');
  const [topK, setTopK] = useState(5);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ingestPath, setIngestPath] = useState('');
  const [showIngestInput, setShowIngestInput] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestProgress, setIngestProgress] = useState(0);
  const [page, setPage] = useState(1);
  const [filterCategoria, setFilterCategoria] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [editingCategory, setEditingCategory] = useState<{ docOrigem: string; current: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categorias disponíveis
  const CATEGORIAS = [
    'geral', 'embargos_declaracao', 'recurso_apelacao', 'agravo_instrumento',
    'impugnacao', 'contrarrazoes', 'manifestacao', 'quesitos', 'peticao_inicial',
    'modelo', 'recurso_especial', 'recurso_extraordinario', 'acao_rescisoria',
    'mandado_seguranca', 'habeas_corpus', 'execucao', 'cumprimento_sentenca',
    'contestacao', 'replica', 'alegacoes_finais', 'parecer', 'memorial',
    'embargos', 'apelacao', 'agravo',
  ];
  const PAGE_SIZE = 20;

  // ── Carregar dados ────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('[Knowledge] Erro ao carregar stats:', err);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (filterCategoria) params.set('categoria', filterCategoria);
      const res = await fetch(`/api/knowledge/list?${params}`);
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json) ? json : (json.data || json.items || []);
        setDocuments(items);
        if (json.totalPages) setTotalPages(json.totalPages);
        else if (json.total) setTotalPages(Math.ceil(json.total / PAGE_SIZE));
      }
    } catch (err) {
      console.error('[Knowledge] Erro ao carregar documentos:', err);
    }
  }, [page, filterCategoria]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // ── Upload de Arquivos ────────────────────────────────────────────────
  const handleUpload = useCallback(async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));

    try {
      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          loadStats();
          loadDocuments();
        }, 1000);
      } else {
        console.error('[Knowledge] Erro no upload:', await res.text());
        setIsUploading(false);
      }
    } catch (err) {
      console.error('[Knowledge] Erro no upload:', err);
      setIsUploading(false);
    }
  }, [loadStats, loadDocuments]);

  // ── Ingestão de Pasta Local ───────────────────────────────────────────
  const handleIngestLocal = useCallback(async () => {
    if (!ingestPath.trim()) return;
    setIsIngesting(true);
    setIngestProgress(0);

    try {
      const res = await fetch('/api/knowledge/ingest-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directoryPath: ingestPath, recursive: true }),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.substring(6));
                // Calcular progresso a partir de current/total
                if (event.current && event.total) {
                  setIngestProgress(Math.round((event.current / event.total) * 100));
                }
                if (event.type === 'scan_complete') {
                  console.log(`[Ingestão] ${event.totalFiles} arquivos encontrados`);
                }
                if (event.type === 'file_error') {
                  console.warn(`[Ingestão] Erro: ${event.file}: ${event.error}`);
                }
                if (event.type === 'ingest_complete') {
                  console.log(`[Ingestão] Completo: ${event.totalProcessados} processados, ${event.totalChunks} chunks, ${event.totalErros} erros`);
                }
              } catch { /* ignore parse errors */ }
            }
          }
        }

        setIngestProgress(100);
        setTimeout(() => {
          setIsIngesting(false);
          setIngestProgress(0);
          setShowIngestInput(false);
          setIngestPath('');
          loadStats();
          loadDocuments();
        }, 1000);
      } else {
        setIsIngesting(false);
      }
    } catch (err) {
      console.error('[Knowledge] Erro na ingestão:', err);
      setIsIngesting(false);
    }
  }, [ingestPath, loadStats, loadDocuments]);

  // ── Busca Semântica ───────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          topK,
          categoria: searchCategoria || undefined,
          threshold: 0.3,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || data);
      }
    } catch (err) {
      console.error('[Knowledge] Erro na busca:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, topK, searchCategoria]);

  // ── Deletar Documento ─────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este documento e todos os seus chunks?')) return;
    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadStats();
        loadDocuments();
      }
    } catch (err) {
      console.error('[Knowledge] Erro ao excluir:', err);
    }
  }, [loadStats, loadDocuments]);

  // ── Download ──────────────────────────────────────────────────────────
  const handleDownload = useCallback((docOrigem: string) => {
    const link = document.createElement('a');
    link.href = `/api/knowledge/${encodeURIComponent(docOrigem)}/download`;
    link.download = docOrigem.replace(/\.[^.]+$/, '') + '.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // ── Atualizar Categoria ───────────────────────────────────────────────
  const handleUpdateCategoria = useCallback(async (docOrigem: string, novaCategoria: string) => {
    try {
      const res = await fetch(`/api/knowledge/${encodeURIComponent(docOrigem)}/categoria`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: novaCategoria }),
      });
      if (res.ok) {
        setEditingCategory(null);
        loadStats();
        loadDocuments();
      }
    } catch (err) {
      console.error('[Knowledge] Erro ao atualizar categoria:', err);
    }
  }, [loadStats, loadDocuments]);

  // ── Drag & Drop ───────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload]);

  const categorias = Object.keys(stats.porCategoria);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10">

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center shrink-0">
                <Icon name="Brain" size={22} className="text-brand-600" />
              </div>
              Base de Conhecimento
            </h2>
            <p className="text-sm text-gray-500 mt-1 md:ml-14">Gerencie documentos, faça buscas semânticas e alimente a inteligência dos agentes</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowIngestInput(!showIngestInput)}
              className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all shadow-sm"
            >
              <Icon name="FolderInput" size={18} />
              Ingerir Pasta Local
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg transition-all shadow-sm"
            >
              <Icon name="Upload" size={18} />
              Enviar Arquivos
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Icon name="Database" size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total de Documentos</p>
              <p className="text-3xl font-black text-gray-900">{stats.totalDocumentos}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Icon name="Layers" size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total de Chunks</p>
              <p className="text-3xl font-black text-gray-900">{stats.totalChunks}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
              <Icon name="FolderTree" size={24} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Categorias</p>
              <p className="text-3xl font-black text-gray-900">{categorias.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ingest Local Input */}
      {showIngestInput && (
        <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6 shadow-sm animate-in">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Icon name="FolderInput" size={20} className="text-gray-600" />
            Ingerir Pasta Local
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={ingestPath}
              onChange={(e) => setIngestPath(e.target.value)}
              placeholder="Ex: C:\Documentos\Jurisprudencia"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              disabled={isIngesting}
            />
            <button
              onClick={handleIngestLocal}
              disabled={isIngesting || !ingestPath.trim()}
              className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white font-bold rounded-lg transition-all shadow-sm flex items-center gap-2"
            >
              {isIngesting ? (
                <><Icon name="Loader2" size={18} className="animate-spin" /> Processando...</>
              ) : (
                <><Icon name="Play" size={18} /> Iniciar</>
              )}
            </button>
          </div>
          {isIngesting && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-600">Progresso da ingestão</span>
                <span className="text-sm font-bold text-brand-600">{ingestProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-brand-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${ingestProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Drag & Drop Area */}
      <div className="mb-8">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300
            ${isDragOver
              ? 'border-brand-400 bg-brand-50 scale-[1.01]'
              : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-gray-50'
            }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragOver ? 'bg-brand-100' : 'bg-gray-50'}`}>
              <Icon name="CloudUpload" size={32} className={isDragOver ? 'text-brand-600' : 'text-gray-400'} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-700">
                {isDragOver ? 'Solte os arquivos aqui' : 'Arraste e solte arquivos aqui'}
              </p>
              <p className="text-sm text-gray-400 mt-1">ou clique para selecionar • PDF, DOCX, DOC, TXT</p>
            </div>
          </div>
          {isUploading && (
            <div className="mt-6 max-w-md mx-auto">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-600">Enviando...</span>
                <span className="text-sm font-bold text-brand-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-brand-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Busca Semântica */}
      <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Icon name="Sparkles" size={20} className="text-brand-600" />
          Busca Semântica
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-sm font-medium text-gray-600 mb-1">Consulta</label>
            <div className="relative">
              <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="O que você está procurando?"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              />
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-600 mb-1">Categoria</label>
            <select
              value={searchCategoria}
              onChange={(e) => setSearchCategoria(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 bg-white"
            >
              <option value="">Todas</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-600 mb-1">Top-K ({topK})</label>
            <input
              type="range"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-full h-3 accent-brand-600 cursor-pointer"
            />
          </div>
          <div className="md:col-span-2">
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="w-full px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white font-bold rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {isSearching ? (
                <><Icon name="Loader2" size={18} className="animate-spin" /> Buscando</>
              ) : (
                <><Icon name="Search" size={18} /> Buscar</>
              )}
            </button>
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-6 space-y-4">
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}
            </h4>
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="border border-gray-100 rounded-xl p-5 hover:border-brand-200 hover:shadow-sm transition-all bg-gray-50/50"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <h5 className="font-bold text-gray-900 text-lg">{result.titulo}</h5>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getCategoryColor(result.categoria)}`}>
                        {result.categoria}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Icon name="FileText" size={12} />
                        {result.documento_origem}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <div className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${
                      result.similarity >= 0.8
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : result.similarity >= 0.6
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {(result.similarity * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{result.conteudo}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabela de Documentos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Icon name="Table" size={20} className="text-gray-600" />
            Documentos Indexados
          </h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={filterCategoria}
              onChange={(e) => { setFilterCategoria(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-700 bg-white w-full sm:w-auto"
            >
              <option value="">Todas as categorias</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Título</th>
                <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Fonte</th>
                <th className="text-left px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="text-right px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <Icon name="FileX" size={32} className="text-gray-300" />
                      </div>
                      <p className="text-gray-400 font-medium">Nenhum documento encontrado</p>
                      <p className="text-gray-300 text-sm">Faça upload de arquivos para começar</p>
                    </div>
                  </td>
                </tr>
              ) : (
                (documents || []).map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{doc.titulo}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Chunk {doc.chunk_index + 1}/{doc.total_chunks}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {editingCategory?.docOrigem === doc.documento_origem ? (
                        <select
                          autoFocus
                          className="text-xs font-semibold px-2 py-1 rounded-lg border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                          value={editingCategory.current}
                          onChange={(e) => {
                            handleUpdateCategoria(doc.documento_origem, e.target.value);
                          }}
                          onBlur={() => setEditingCategory(null)}
                        >
                          {CATEGORIAS.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${getCategoryColor(doc.categoria)}`}
                          onClick={() => setEditingCategory({ docOrigem: doc.documento_origem, current: doc.categoria })}
                          title="Clique para editar categoria"
                        >
                          {doc.categoria}
                          <span className="ml-1 opacity-50">✎</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{doc.fonte || doc.documento_origem}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownload(doc.documento_origem)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Download do documento"
                        >
                          <Icon name="Download" size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.documento_origem)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir documento"
                        >
                          <Icon name="Trash2" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Icon name="ChevronLeft" size={16} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const pageNum = start + i;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      pageNum === page
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Icon name="ChevronRight" size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
