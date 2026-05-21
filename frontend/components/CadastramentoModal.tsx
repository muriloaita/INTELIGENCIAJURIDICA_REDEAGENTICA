import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icons';
import { PrazoFormData } from '../types';

interface CadastramentoModalProps {
  onClose: () => void;
  onSubmit: (data: PrazoFormData) => void;
}

// Fallback estático caso a API não retorne categorias
const TIPOS_PETICAO_FALLBACK = [
  "MANIFESTAÇÃO DA PARTE",
  "ESPECIFICAÇÃO DE PROVAS",
  "IMPUGNAÇÃO À CONTESTAÇÃO",
  "QUESITOS",
  "CUMPRIMENTO DE INTIMAÇÃO",
  "AGRAVO DE INSTRUMENTO",
  "EMBARGOS DE DECLARAÇÃO",
  "RECURSO DE APELAÇÃO",
  "RECURSO INOMINADO",
  "OUTRAS"
];

// Mapeamento: categoria indexada → nome legível
const CATEGORIA_LABELS: Record<string, string> = {
  'agravo_instrumento': 'AGRAVO DE INSTRUMENTO',
  'alegacoes_finais': 'ALEGAÇÕES FINAIS',
  'apelacao': 'APELAÇÃO',
  'contestacao': 'CONTESTAÇÃO',
  'contrarrazoes': 'CONTRARRAZÕES',
  'cumprimento_sentenca': 'CUMPRIMENTO DE SENTENÇA',
  'embargos_declaracao': 'EMBARGOS DE DECLARAÇÃO',
  'embargos': 'EMBARGOS',
  'execucao': 'EXECUÇÃO',
  'geral': 'GERAL',
  'impugnacao': 'IMPUGNAÇÃO',
  'manifestacao': 'MANIFESTAÇÃO DA PARTE',
  'peticao_inicial': 'PETIÇÃO INICIAL',
  'quesitos': 'QUESITOS',
  'recurso_apelacao': 'RECURSO DE APELAÇÃO',
  'recurso_especial': 'RECURSO ESPECIAL',
  'recurso_extraordinario': 'RECURSO EXTRAORDINÁRIO',
  'acao_rescisoria': 'AÇÃO RESCISÓRIA',
  'mandado_seguranca': 'MANDADO DE SEGURANÇA',
  'habeas_corpus': 'HABEAS CORPUS',
  'replica': 'RÉPLICA',
  'parecer': 'PARECER',
  'memorial': 'MEMORIAL',
  'agravo': 'AGRAVO',
  'modelo': 'MODELO',
};

export const CadastramentoModal: React.FC<CadastramentoModalProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState<PrazoFormData>({
    demanda: '',
    autos: '',
    tipoPeticao: '',
    observacao: '',
    arquivos: []
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Carregar categorias dinâmicas da base de conhecimento ──
  const [categoriasDB, setCategoriasDB] = useState<{ key: string; label: string; count: number }[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const res = await fetch('/api/knowledge/stats');
        if (res.ok) {
          const stats = await res.json();
          const cats = Object.entries(stats.porCategoria || {})
            .map(([key, count]) => ({
              key,
              label: CATEGORIA_LABELS[key] || key.toUpperCase().replace(/_/g, ' '),
              count: count as number,
            }))
            .sort((a, b) => b.count - a.count); // Ordenar por quantidade de docs
          setCategoriasDB(cats);
        }
      } catch (err) {
        console.error('[Cadastro] Erro ao carregar categorias:', err);
      } finally {
        setLoadingCategorias(false);
      }
    };
    fetchCategorias();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFormData(prev => ({ ...prev, arquivos: [...prev.arquivos, ...newFiles] }));
    }
  };

  const removeFile = (index: number) => {
    setFormData(prev => {
      const newArquivos = [...prev.arquivos];
      newArquivos.splice(index, 1);
      return { ...prev, arquivos: newArquivos };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-50 text-brand-600 border border-brand-100">
              <Icon name="FilePlus" size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Cadastramento de Prazo</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <Icon name="X" size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número da Demanda / Link</label>
              <input 
                type="text" 
                name="demanda"
                required
                value={formData.demanda}
                onChange={handleChange}
                placeholder="Ex: DEM-2023-001 ou https://..."
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número dos Autos</label>
              <input 
                type="text" 
                name="autos"
                required
                value={formData.autos}
                onChange={handleChange}
                placeholder="Ex: 1000123-45.2023.8.26.0100"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Petição / Template</label>
            <select 
              name="tipoPeticao"
              required
              value={formData.tipoPeticao}
              onChange={handleChange}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
            >
              <option value="">Selecione o tipo de petição...</option>
              {categoriasDB.length > 0 ? (
                <>
                  <optgroup label="📚 Da Base de Conhecimento">
                    {categoriasDB.map(cat => (
                      <option key={cat.key} value={cat.key}>
                        {cat.label} ({cat.count} docs)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="📝 Tipos Adicionais">
                    {TIPOS_PETICAO_FALLBACK.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </optgroup>
                </>
              ) : (
                TIPOS_PETICAO_FALLBACK.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea 
              name="observacao"
              value={formData.observacao}
              onChange={handleChange}
              rows={3}
              placeholder="Instruções específicas, teses a serem priorizadas..."
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload de Arquivos (Intimação / Autos)</label>
            <div 
              className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-brand-400 hover:bg-brand-50 transition-colors cursor-pointer bg-gray-50"
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="UploadCloud" size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">Clique para selecionar arquivos ou arraste e solte</p>
              <p className="text-xs text-gray-500 mt-1">PDF, DOCX, JPG (Max 50MB)</p>
              <input 
                type="file" 
                multiple 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
            
            {formData.arquivos.length > 0 && (
              <div className="mt-3 space-y-2">
                {formData.arquivos.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Icon name="FileText" size={16} className="text-brand-600 shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => removeFile(idx)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Icon name="Trash2" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors font-medium shadow-sm"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!formData.demanda || !formData.autos || !formData.tipoPeticao}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            <Icon name="Play" size={18} />
            Iniciar Processamento
          </button>
        </div>
      </div>
    </div>
  );
};
