import React, { useState, useEffect, useCallback } from 'react';
import { WORKFLOW_STAGES } from '../constants';
import { WorkflowStage, SimulationStatus, PrazoFormData, PhaseResults, AppView, PeticaoPronta, AgentConfig, WorkflowHistoryItem } from '../types';
import { StageCard } from './StageCard';
import { StageDetailModal } from './StageDetailModal';
import { CadastramentoModal } from './CadastramentoModal';
import { TemplatesView } from './TemplatesView';
import { PrazosView } from './PrazosView';
import { ProntasView } from './ProntasView';
import { AguardandoProtocoloView } from './AguardandoProtocoloView';
import { ConfigView } from './ConfigView';
import { HistoricoView } from './HistoricoView';
import { KnowledgeBaseView } from './KnowledgeBaseView';
import { WorkflowPanel } from './WorkflowPanel';
import { Icon } from './Icons';
import { usePeticoesProntas, useHistorico, useAgentConfigs } from '../hooks/useSupabase';
import { useWorkflow } from '../hooks/useWorkflow';



export const Dashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('overview');
  const [selectedStage, setSelectedStage] = useState<WorkflowStage | null>(null);
  const [showCadastramento, setShowCadastramento] = useState(false);
  const [prazoData, setPrazoData] = useState<PrazoFormData | null>(null);

  // Hook real de workflow (substitui a simulação mock)
  const {
    startWorkflow,
    stopWorkflow,
    activePhaseId: activeStageId,
    completedPhases: completedStages,
    phaseResults,
    simStatus,
    setSimStatus,
    setActivePhaseId: setActiveStageId,
    setCompletedPhases: setCompletedStages,
    setPhaseResults,
    docxDownloadUrl,
    allWorkflows,
    queue,
    queueLength,
    maxQueue,
    canEnqueue,
    respondToCheckpoint,
    removeFromQueue,
  } = useWorkflow();

  const [peticoesProntas, setPeticoesProntas] = useState<PeticaoPronta[]>([]);
  const [peticoesAguardando, setPeticoesAguardando] = useState<PeticaoPronta[]>([]);
  const [historico, setHistorico] = useState<WorkflowHistoryItem[]>([]);
  const [agentConfigs, setAgentConfigs] = useState<Record<string, AgentConfig>>({});

  // ── Hooks Supabase ─────────────────────────────────────────────
  const db_peticoes  = usePeticoesProntas();
  const db_historico = useHistorico();
  const db_agentes   = useAgentConfigs();

  // Carrega dados do Supabase na inicialização
  useEffect(() => {
    (async () => {
      const [prontas, hist, configs] = await Promise.all([
        db_peticoes.listar(),
        db_historico.listar(),
        db_agentes.listar(),
      ]);
      const aguardando = prontas.filter(p =>
        p.status === 'Aguardando Protocolo' || p.status === 'Protocolada'
      );
      const efetivamenteProntas = prontas.filter(p =>
        p.status === 'Aguardando Revisão' || p.status === 'Aprovada'
      );
      setPeticoesProntas(efetivamenteProntas);
      setPeticoesAguardando(aguardando);
      setHistorico(hist);
      setAgentConfigs(configs);
    })();
  }, []);

  const handleStartClick = () => {
    setShowCadastramento(true);
  };

  const startSimulation = useCallback((data: PrazoFormData) => {
    setPrazoData(data);
    setShowCadastramento(false);
    setCurrentView('overview');
    startWorkflow(data);
  }, [startWorkflow]);

  const stopSimulation = useCallback(async () => {
    if ((simStatus === 'running' || simStatus === 'pendente') && prazoData) {
      const item: WorkflowHistoryItem = {
        id: `FLX-${Math.floor(Math.random() * 10000)}`,
        data: new Date().toISOString(),
        demanda: prazoData.demanda,
        autos: prazoData.autos,
        tipoPeticao: prazoData.tipoPeticao,
        status: 'Cancelado',
      };
      setHistorico(prev => [item, ...prev]);
      await db_historico.registrar(item);
    }
    await stopWorkflow();
    setPrazoData(null);
  }, [simStatus, prazoData, stopWorkflow]);

  const handleSaveAgentConfig = async (agentId: string, config: AgentConfig) => {
    setAgentConfigs(prev => ({ ...prev, [agentId]: config }));
    await db_agentes.salvar(agentId, config);
  };

  // ── Handlers de Petições ───────────────────────────────────────
  const handleRevisar = async (id: string) => {
    setPeticoesProntas(prev => prev.map(p => p.id === id ? { ...p, status: 'Aprovada' } : p));
    await db_peticoes.atualizarStatus(id, 'Aprovada');
    alert('Petição revisada e aprovada com sucesso! Agora você pode enviá-la para protocolo.');
  };

  const handleBaixar = (id: string) => {
    // Tentar encontrar o docxUrl de um workflow concluído
    const peticao = peticoesProntas.find(p => p.id === id) || peticoesAguardando.find(p => p.id === id);
    if (peticao?.docxUrl) {
      window.open(peticao.docxUrl, '_blank');
      return;
    }
    // Tentar encontrar pelo workflow ativo
    const wf = allWorkflows.find(w => w.docxUrl && (w.prazoData.autos === peticao?.autos));
    if (wf?.docxUrl) {
      window.open(wf.docxUrl, '_blank');
      return;
    }
    // Fallback: endpoint direto com o id
    window.open(`/api/workflow/${id}/docx`, '_blank');
  };

  const handleProtocolar = async (id: string) => {
    const peticao = peticoesProntas.find(p => p.id === id);
    if (peticao) {
      const atualizada = { ...peticao, status: 'Aguardando Protocolo' as const };
      setPeticoesProntas(prev => prev.filter(p => p.id !== id));
      setPeticoesAguardando(prev => [atualizada, ...prev]);
      await db_peticoes.atualizarStatus(id, 'Aguardando Protocolo');
      setCurrentView('protocolo');
    }
  };

  const handleFinalizarProtocolo = async (id: string) => {
    setPeticoesAguardando(prev => prev.filter(p => p.id !== id));
    await db_peticoes.atualizarStatus(id, 'Protocolada');
    alert('Protocolo confirmado com sucesso no sistema do tribunal!');
  };

  // Quando o workflow completa via SSE, recarregar dados do Supabase
  // (a persistência agora é feita server-side para todos os workflows, incluindo enfileirados)
  useEffect(() => {
    if (simStatus === 'completed') {
      // Dar um pequeno delay para o server salvar no Supabase antes de recarregar
      const timer = setTimeout(async () => {
        const [prontas, hist] = await Promise.all([
          db_peticoes.listar(),
          db_historico.listar(),
        ]);
        const aguardando = prontas.filter(p =>
          p.status === 'Aguardando Protocolo' || p.status === 'Protocolada'
        );
        const efetivamenteProntas = prontas.filter(p =>
          p.status === 'Aguardando Revisão' || p.status === 'Aprovada'
        );
        setPeticoesProntas(efetivamenteProntas);
        setPeticoesAguardando(aguardando);
        setHistorico(hist);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [simStatus]);

  const navItems: { id: AppView; label: string; icon: string }[] = [
    { id: 'overview', label: 'Visão Geral', icon: 'LayoutDashboard' },
    { id: 'templates', label: 'Templates', icon: 'FileCode2' },
    { id: 'prazos', label: 'Controle de Prazos', icon: 'CalendarClock' },
    { id: 'prontas', label: 'Petições Prontas', icon: 'FolderCheck' },
    { id: 'protocolo', label: 'Aguardando Protocolo', icon: 'Send' },
    { id: 'historico', label: 'Histórico de Fluxos', icon: 'History' },
    { id: 'knowledge' as AppView, label: 'Base de Conhecimento', icon: 'Brain' },
    { id: 'config', label: 'Configuração de Agentes', icon: 'Settings' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white hidden md:flex flex-col z-20 shadow-sm">
        <div className="p-6 border-b border-gray-200 flex flex-col items-center justify-center gap-3">
          
          {/* Logo Section with SVG Fallback */}
          <div className="w-full flex justify-center mb-2">
            <img 
              src="./logo.png" 
              alt="Marques & Gameiro" 
              className="h-28 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            {/* SVG Fallback that perfectly mimics the provided logo if the image file is not found */}
            <svg viewBox="0 0 200 220" className="h-28 w-auto hidden" xmlns="http://www.w3.org/2000/svg">
              <g stroke="#1a1a1a" strokeWidth="2">
                {Array.from({ length: 24 }).map((_, i) => (
                  <line key={i} x1="45" y1={20 + i * 5.5} x2="155" y2={20 + i * 5.5} />
                ))}
              </g>
              <text x="45" y="110" fontFamily="Georgia, serif" fontSize="100" fill="#dc2626" fontWeight="bold">M</text>
              <text x="85" y="145" fontFamily="Georgia, serif" fontSize="110" fill="#dc2626" fontWeight="bold">G</text>
              <text x="100" y="175" fontFamily="Georgia, serif" fontSize="16" fill="#1a1a1a" fontWeight="900" textAnchor="middle">MARQUES &amp;</text>
              <text x="100" y="195" fontFamily="Georgia, serif" fontSize="16" fill="#1a1a1a" fontWeight="900" textAnchor="middle">GAMEIRO</text>
              <text x="100" y="210" fontFamily="Arial, sans-serif" fontSize="5" fill="#1a1a1a" letterSpacing="2" textAnchor="middle">SOCIEDADE DE ADVOGADOS</text>
            </svg>
          </div>

          <h1 className="font-black text-xl leading-tight text-center text-gray-900 tracking-tight">
            INTELIGÊNCIA<br/><span className="text-brand-600">JURÍDICA</span>
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left font-medium
                ${currentView === item.id 
                  ? 'bg-brand-50 text-brand-700 border border-brand-200' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-transparent'
                }`}
            >
              <Icon name={item.icon} size={20} className={currentView === item.id ? 'text-brand-600' : ''} />
              <span>{item.label}</span>
              {item.id === 'prontas' && peticoesProntas.length > 0 && (
                <span className="ml-auto bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {peticoesProntas.length}
                </span>
              )}
              {item.id === 'protocolo' && peticoesAguardando.length > 0 && (
                <span className="ml-auto bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {peticoesAguardando.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm font-bold text-gray-700">Status do Sistema</span>
            </div>
            <p className="text-xs text-gray-500">Todos os agentes operacionais.</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Global Header */}
        <header className="h-20 border-b border-gray-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {navItems.find(i => i.id === currentView)?.label || 'Dashboard'}
            </h2>
            <p className="text-sm text-gray-500">Ecossistema de Automação e Inteligência</p>
          </div>
          
          {currentView === 'overview' && (
            <div className="flex items-center gap-4">
              {/* Botão Iniciar Fluxo — sempre visível para permitir cadastrar novos processos */}
              <button 
                onClick={handleStartClick}
                disabled={!canEnqueue}
                className={`flex items-center gap-2 px-5 py-2.5 font-bold rounded-lg transition-all shadow-sm ${
                  canEnqueue
                    ? 'bg-brand-600 hover:bg-brand-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Icon name="Plus" size={18} />
                {canEnqueue ? 'Novo Processo' : `Fila Cheia (${queueLength}/${maxQueue})`}
              </button>

              {/* Botão Parar — só aparece quando há um workflow em execução */}
              {(simStatus === 'running' || simStatus === 'awaiting_input') && (
                <button 
                  onClick={stopSimulation}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-red-600 border border-red-200 font-bold rounded-lg transition-all shadow-sm"
                >
                  <Icon name="Square" size={18} />
                  Parar Fluxo
                </button>
              )}
            </div>
          )}
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-hidden relative">
          {/* Background decorative elements */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-100/50 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-100/50 rounded-full blur-3xl pointer-events-none"></div>

          {currentView === 'overview' && (
            <div className="h-full overflow-y-auto p-8 custom-scrollbar relative z-10">
              
              {/* Pendente Banner */}
              {simStatus === 'pendente' && (
                <div className="mb-6 flex items-center justify-between bg-amber-50 border border-amber-200 p-4 rounded-xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <Icon name="AlertTriangle" className="text-amber-600" size={24} />
                    <div>
                      <span className="text-amber-800 font-bold block">FLUXO PENDENTE</span>
                      <span className="text-amber-700 text-sm">Faltam informações ou arquivos do processo. O Agente A1 interrompeu a coleta.</span>
                    </div>
                  </div>
                  <button 
                    onClick={stopSimulation} 
                    className="px-4 py-2 bg-white border border-amber-200 text-amber-700 rounded-lg text-sm font-bold hover:bg-amber-100 transition-colors"
                  >
                    Cancelar Fluxo
                  </button>
                </div>
              )}

              {/* Active Status Banners */}
              {simStatus === 'running' && (
                <div className="mb-6 flex items-center gap-3 bg-white border border-brand-200 p-4 rounded-xl shadow-sm inline-flex">
                  <Icon name="Loader2" className="animate-spin text-brand-600" size={20} />
                  <span className="text-brand-700 font-bold">
                    Processando: Fase {activeStageId} - {WORKFLOW_STAGES.find(s => s.id === activeStageId)?.shortTitle}
                  </span>
                  {prazoData && (
                    <span className="ml-4 pl-4 border-l border-gray-200 text-gray-500 text-sm font-medium">
                      Autos: {prazoData.autos}
                    </span>
                  )}
                </div>
              )}

              {simStatus === 'completed' && (
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-green-50 border border-green-200 p-4 rounded-xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <Icon name="CheckCircle2" className="text-green-600" size={20} />
                    <span className="text-green-700 font-bold">
                      Fluxo concluído com sucesso. Peça disponível no módulo Petições Prontas.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-0 sm:ml-auto">
                    {docxDownloadUrl && (
                      <a
                        href={docxDownloadUrl}
                        download
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                      >
                        <Icon name="FileDown" size={16} />
                        Download Word (.docx)
                      </a>
                    )}
                    <button 
                      onClick={() => setCurrentView('prontas')}
                      className="px-3 py-2 bg-white border border-green-200 hover:bg-green-100 text-green-700 rounded-lg text-sm font-bold transition-colors shadow-sm"
                    >
                      Ver Peça
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {WORKFLOW_STAGES.map((stage) => (
                  <StageCard 
                    key={stage.id}
                    stage={stage}
                    isActive={activeStageId === stage.id}
                    isCompleted={completedStages.includes(stage.id)}
                    hasResult={!!phaseResults[stage.id]}
                    onClick={() => setSelectedStage(stage)}
                  />
                ))}
              </div>

              {/* Painel de Processamento Multi-Workflow */}
              <div className="mt-8">
                <WorkflowPanel
                  workflows={allWorkflows}
                  queue={queue}
                  queueLength={queueLength}
                  maxQueue={maxQueue}
                  onRespondCheckpoint={respondToCheckpoint}
                  onRemoveFromQueue={removeFromQueue}
                  onDownloadDocx={(wfId) => {
                    window.open(`/api/workflow/${wfId}/docx`, '_blank');
                  }}
                  onViewPeticao={() => {
                    // Forçar recarregamento do Supabase antes de navegar
                    db_peticoes.listar().then(prontas => {
                      const aguardando = prontas.filter(p =>
                        p.status === 'Aguardando Protocolo' || p.status === 'Protocolada'
                      );
                      const efetivamenteProntas = prontas.filter(p =>
                        p.status === 'Aguardando Revisão' || p.status === 'Aprovada'
                      );
                      setPeticoesProntas(efetivamenteProntas);
                      setPeticoesAguardando(aguardando);
                    });
                    setCurrentView('prontas');
                  }}
                />
              </div>
            </div>
          )}

          {currentView === 'templates' && <TemplatesView />}
          
          {currentView === 'prazos' && (
            <PrazosView 
              onNovoPrazo={handleStartClick} 
              activePrazo={simStatus === 'running' ? prazoData : null} 
            />
          )}
          
          {currentView === 'prontas' && (
            <ProntasView 
              peticoes={peticoesProntas} 
              onRevisar={handleRevisar}
              onBaixar={handleBaixar}
              onProtocolar={handleProtocolar}
            />
          )}

          {currentView === 'protocolo' && (
            <AguardandoProtocoloView 
              peticoes={peticoesAguardando} 
              onFinalizarProtocolo={handleFinalizarProtocolo}
              onBaixar={handleBaixar}
            />
          )}

          {currentView === 'historico' && (
            <HistoricoView historico={historico} />
          )}

          {currentView === 'knowledge' && <KnowledgeBaseView />}

          {currentView === 'config' && (
            <ConfigView 
              configs={agentConfigs} 
              onSaveConfig={handleSaveAgentConfig} 
            />
          )}

        </div>
      </main>

      {/* Modals */}
      {showCadastramento && (
        <CadastramentoModal 
          onClose={() => setShowCadastramento(false)}
          onSubmit={startSimulation}
        />
      )}

      {selectedStage && (
        <StageDetailModal 
          stage={selectedStage} 
          result={phaseResults[selectedStage.id]}
          agentConfigs={agentConfigs}
          onClose={() => setSelectedStage(null)} 
        />
      )}

      {/* Global Styles for Scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f9fafb;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}} />
    </div>
  );
};
