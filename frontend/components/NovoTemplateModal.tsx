import React, { useState, useRef } from 'react';
import { Icon } from './Icons';
import { TemplateFormData } from '../types';

interface NovoTemplateModalProps {
  onClose: () => void;
  onSubmit: (data: TemplateFormData) => void;
}

export const NovoTemplateModal: React.FC<NovoTemplateModalProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    category: '',
    description: '',
    instructions: '',
    file: null
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFormData(prev => ({ ...prev, file: e.target.files![0] }));
    }
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
            <h2 className="text-xl font-bold text-gray-900">Novo Template</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <Icon name="X" size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Template</label>
              <input 
                type="text" 
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Ex: Contestação Trabalhista Padrão"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select 
                name="category"
                required
                value={formData.category}
                onChange={handleChange}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
              >
                <option value="">Selecione uma categoria...</option>
                <option value="Trabalhista">Trabalhista</option>
                <option value="Cível">Cível</option>
                <option value="Tributário">Tributário</option>
                <option value="Geral">Geral</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Breve</label>
            <textarea 
              name="description"
              required
              value={formData.description}
              onChange={handleChange}
              rows={2}
              placeholder="Descreva o propósito geral deste template..."
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Detalhes e Instruções de Uso</label>
            <p className="text-xs text-gray-500 mb-2">Oriente a IA sobre quando e como utilizar este template específico.</p>
            <textarea 
              name="instructions"
              required
              value={formData.instructions}
              onChange={handleChange}
              rows={4}
              placeholder="Ex: Utilizar este template apenas quando houver pedido de danos morais cumulado com rescisão indireta. Focar na tese de ausência de prova robusta..."
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload do Arquivo Base (DOCX/PDF)</label>
            <div 
              className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-brand-400 hover:bg-brand-50 transition-colors cursor-pointer bg-gray-50"
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="UploadCloud" size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">Clique para selecionar o arquivo do template</p>
              <input 
                type="file" 
                accept=".docx,.pdf,.doc"
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
            
            {formData.file && (
              <div className="mt-3 flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Icon name="FileText" size={16} className="text-brand-600 shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{formData.file.name}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setFormData(prev => ({ ...prev, file: null }))}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Icon name="Trash2" size={16} />
                </button>
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
            disabled={!formData.name || !formData.category || !formData.file}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            <Icon name="Save" size={18} />
            Salvar Template
          </button>
        </div>
      </div>
    </div>
  );
};
