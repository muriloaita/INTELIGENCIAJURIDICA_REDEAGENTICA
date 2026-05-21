import React, { useState } from 'react';
import { Icon } from './Icons';
import { Template, TemplateFormData } from '../types';
import { NovoTemplateModal } from './NovoTemplateModal';

const INITIAL_TEMPLATES: Template[] = [
  { id: '1', name: 'Contestação Trabalhista Padrão', description: 'Estrutura base para defesas em rito ordinário com foco em descaracterização de vínculo.', instructions: 'Usar em casos de vínculo empregatício.', category: 'Trabalhista', lastUpdated: '10/10/2023' },
  { id: '2', name: 'Recurso Ordinário - Horas Extras', description: 'Foco em nulidade de cartões de ponto e inversão do ônus da prova.', instructions: 'Focar na Súmula 338 do TST.', category: 'Trabalhista', lastUpdated: '15/10/2023' },
  { id: '3', name: 'Embargos de Declaração - Omissão', description: 'Template enxuto para apontar omissões em sentenças de 1º grau.', instructions: 'Não inovar no mérito, apenas apontar a omissão.', category: 'Geral', lastUpdated: '01/11/2023' },
  { id: '4', name: 'Contestação Cível - Danos Morais', description: 'Defesa padrão para negativa de prestação de serviços e inexistência de dano.', instructions: 'Focar na culpa exclusiva de terceiros.', category: 'Cível', lastUpdated: '20/10/2023' },
];

export const TemplatesView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddTemplate = (data: TemplateFormData) => {
    const newTemplate: Template = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.name,
      description: data.description,
      instructions: data.instructions,
      category: data.category,
      lastUpdated: new Date().toLocaleDateString('pt-BR')
    };
    setTemplates([newTemplate, ...templates]);
    setIsModalOpen(false);
  };

  return (
    <div className="p-8 h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Biblioteca de Templates</h2>
          <p className="text-gray-500 text-sm">Gerencie as estruturas documentais utilizadas pelo Agente A2.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm font-medium"
        >
          <Icon name="Plus" size={18} />
          Novo Template
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex items-center gap-3 shadow-sm">
        <Icon name="Search" size={20} className="text-gray-400" />
        <input 
          type="text" 
          placeholder="Buscar templates por nome ou categoria..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent border-none outline-none text-gray-900 w-full placeholder:text-gray-400"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pb-20">
        {filteredTemplates.map(template => (
          <div key={template.id} className="bg-white border border-gray-200 hover:border-brand-300 hover:shadow-md rounded-xl p-5 transition-all group cursor-pointer flex flex-col">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                <Icon name="FileText" size={20} />
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-gray-100 border border-gray-200 rounded-md text-gray-600">
                {template.category}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-brand-600 transition-colors">{template.name}</h3>
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{template.description}</p>
            
            <div className="mt-auto pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>Atualizado em {template.lastUpdated}</span>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900"><Icon name="Edit2" size={14} /></button>
                  <button className="p-1.5 hover:bg-red-50 rounded text-gray-600 hover:text-red-600"><Icon name="Trash2" size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <NovoTemplateModal 
          onClose={() => setIsModalOpen(false)} 
          onSubmit={handleAddTemplate} 
        />
      )}
    </div>
  );
};
