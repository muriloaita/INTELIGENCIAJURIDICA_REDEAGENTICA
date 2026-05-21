import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { AgentConfig } from '../types';
import { AGENT_COLORS } from '../constants';

interface ConfigViewProps {
  configs: Record<string, AgentConfig>;
  onSaveConfig: (agentId: string, config: AgentConfig) => void;
}

const AGENTS_LIST = [
  { id: 'A1', name: 'Coletor de Prazos', role: 'Extração de dados e monitoramento' },
  { id: 'A2', name: 'Input & Pipeline', role: 'Metadados e roteamento' },
  { id: 'A3', name: 'Gestão de Conhecimento', role: 'Busca de legados e jurisprudência' },
  { id: 'A4', name: 'Síntese (R.O.P.A.)', role: 'Resumo e organização fática' },
  { id: 'A5', name: 'Gestão de Risco', role: 'Protocolo Steel Man e defesas' },
  { id: 'A6', name: 'Redação Estratégica', role: 'Geração de peças e RAG' },
  { id: 'A7', name: 'Revisor (CoT)', role: 'Validação de coerência e crítica' },
];

export const ConfigView: React.FC<ConfigViewProps> = ({ configs, onSaveConfig }) => {
  const [selectedAgent, setSelectedAgent] = useState(AGENTS_LIST[0].id);
  const [formData, setFormData] = useState<AgentConfig>({
    mcpConfig: '',
    ragConfig: '',
    customInstructions: '',
    cotConfig: '',
    driveLink: ''
  });
  const [isSaved, setIsSaved] = useState(false);

  // Load config when selected agent changes
  useEffect(() => {
    if (configs[selectedAgent]) {
      setFormData({
        mcpConfig: configs[selectedAgent].mcpConfig || '',
        ragConfig: configs[selectedAgent].ragConfig || '',
        customInstructions: configs[selectedAgent].customInstructions || '',
        cotConfig: configs[selectedAgent].cotConfig || '',
        driveLink: configs[selectedAgent].driveLink || ''
      });
    } else {
      setFormData({
        mcpConfig: '',
        ragConfig: '',
        customInstructions: '',
        cotConfig: '',
        driveLink: ''
      });
    }
    setIsSaved(false);
  }, [selectedAgent, configs]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setIsSaved(false);
  };

  const handleSave = () => {
    onSaveConfig(selectedAgent, formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const activeAgentDetails = AGENTS_LIST.find(a => a.id === selectedAgent);

  return (
    <div className="p-8 h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Configuração de Agentes</h2>
          <p className="text-gray-500 text-sm">Ajuste os parâmetros de MCP, RAG e instruções base para cada agente da rede.</p>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Sidebar - Agent List */}
        <div className="w-1/3 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2">
          {AGENTS_LIST.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              className={`flex flex-col items-start p-4 rounded-xl border transition-all text-left
                ${selectedAgent === agent.id 
                  ? 'bg-white border-brand-500 shadow-md ring-1 ring-brand-500' 
                  : 'bg-white border-gray-200 hover:border-brand-300 hover:shadow-sm'
                }`}
            >
              <div className="flex items-center gap-3 mb-2 w-full">
                <span className={`font-mono text-xs font-bold px-2 py-1 rounded border ${AGENT_COLORS[agent.id]}`}>
                  {agent.id}
                </span>
                <span className={`font-bold ${selectedAgent === agent.id ? 'text-brand-700' : 'text-gray-900'}`}>
                  {agent.name}
                </span>
              </div>
              <span className="text-xs text-gray-500">{agent.role}</span>
            </button>
          ))}
        </div>

        {/* Main Content - Configuration Form */}
        <div className="w-2/3 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-50 text-brand-600 rounded-lg border border-brand-100">
                <Icon name="Settings2" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Parâmetros: {activeAgentDetails?.name}</h3>
                <p className="text-xs text-gray-500 font-mono">ID: {selectedAgent} | {activeAgentDetails?.role}</p>
              </div>
            </div>
            <button 
              onClick={handleSave}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm
                ${isSaved 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-brand-600 hover:bg-brand-700 text-white'
                }`}
            >
              <Icon name={isSaved ? "Check" : "Save"} size={18} />
              {isSaved ? "Salvo!" : "Salvar Configuração"}
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
            
            {/* Drive Link Config - Only for A3 */}
            {selectedAgent === 'A3' && (
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
                <label className="flex items-center gap-2 text-sm font-bold text-brand-800 mb-2">
                  <Icon name="HardDrive" size={16} className="text-brand-600" />
                  Conexão com Drive (Bancos Internos)
                </label>
                <p className="text-xs text-brand-700/80 mb-3">
                  Insira o link compartilhável ou autorize o acesso ao diretório para busca de jurisprudência e peças legadas.
                </p>
                <input 
                  type="text"
                  name="driveLink"
                  value={formData.driveLink || ''}
                  onChange={handleChange}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full bg-white border border-brand-300 rounded-lg px-4 py-3 text-gray-800 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>
            )}

            {/* MCP Config */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                <Icon name="Network" size={16} className="text-brand-600" />
                (MCP) Model Context Protocol
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Defina os endpoints, ferramentas (tools) e o formato de contexto estendido que este agente deve utilizar para se comunicar com o Hub de Memória.
              </p>
              <textarea 
                name="mcpConfig"
                value={formData.mcpConfig}
                onChange={handleChange}
                rows={4}
                placeholder='Ex: { "endpoints": ["https://api.internal/memory"], "tools": ["read_context", "write_context"], "format": "markdown" }'
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-800 font-mono text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-y"
              />
            </div>

            {/* RAG Config */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                <Icon name="Database" size={16} className="text-brand-600" />
                RAG (Retrieval Augmented Generation)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Configure as fontes de dados vetoriais, parâmetros de similaridade (Top-K) e diretórios de jurisprudência para a geração aumentada.
              </p>
              <textarea 
                name="ragConfig"
                value={formData.ragConfig}
                onChange={handleChange}
                rows={4}
                placeholder='Ex: { "vector_db": "pinecone-legal-v1", "top_k": 5, "similarity_threshold": 0.85, "sources": ["tst_jurisprudencia", "drive_interno"] }'
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-800 font-mono text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-y"
              />
            </div>

            {/* CoT Config - Only for A7 */}
            {selectedAgent === 'A7' && (
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
                <label className="flex items-center gap-2 text-sm font-bold text-brand-800 mb-2">
                  <Icon name="BrainCircuit" size={16} className="text-brand-600" />
                  Chain of Thought (CoT) - Raciocínio em Cadeia
                </label>
                <p className="text-xs text-brand-700/80 mb-3">
                  Especifique as etapas lógicas que o Agente Revisor deve seguir para validar a coerência entre a fundamentação jurídica e as conclusões da peça.
                </p>
                <textarea 
                  name="cotConfig"
                  value={formData.cotConfig || ''}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Ex: 1. Identificar a premissa maior (norma/jurisprudência).&#10;2. Identificar a premissa menor (fatos do caso).&#10;3. Validar se a conclusão decorre logicamente das premissas.&#10;4. Checar se os pedidos finais refletem a fundamentação."
                  className="w-full bg-white border border-brand-300 rounded-lg px-4 py-3 text-gray-800 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-y"
                />
              </div>
            )}

            {/* Custom Instructions */}
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                <Icon name="TerminalSquare" size={16} className="text-brand-600" />
                Instruções Base (System Prompt)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Diretrizes comportamentais específicas para este agente durante a execução do fluxo.
              </p>
              <textarea 
                name="customInstructions"
                value={formData.customInstructions}
                onChange={handleChange}
                rows={4}
                placeholder="Ex: Você é um especialista em identificar falhas lógicas. Sempre aplique o Protocolo Steel Man antes de redigir a defesa..."
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-800 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-y"
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
