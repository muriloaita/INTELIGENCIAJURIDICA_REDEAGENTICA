import { useState, useCallback, useRef } from 'react';
import { SimulationStatus, PhaseResults, PrazoFormData, WorkflowEvent } from '../types';

export function useWorkflow() {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [activePhaseId, setActivePhaseId] = useState<number | null>(null);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [phaseResults, setPhaseResults] = useState<PhaseResults>({});
  const [simStatus, setSimStatus] = useState<SimulationStatus>('idle');
  const eventSourceRef = useRef<EventSource | null>(null);

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const startWorkflow = useCallback(async (data: PrazoFormData) => {
    // Resetar estados
    setCompletedPhases([]);
    setPhaseResults({});
    setSimStatus('running');
    setActivePhaseId(1);

    try {
      const response = await fetch('/api/workflow/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demanda: data.demanda,
          autos: data.autos,
          tipoPeticao: data.tipoPeticao,
          observacao: data.observacao,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao iniciar workflow: ${response.statusText}`);
      }

      const { workflowId: wfId } = await response.json();
      setWorkflowId(wfId);

      // Abrir SSE para receber eventos de progresso
      closeEventSource();
      const es = new EventSource(`/api/workflow/${wfId}/events`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data: WorkflowEvent = JSON.parse(event.data);

          switch (data.type) {
            case 'phase_start':
              if (data.phaseId) {
                setActivePhaseId(data.phaseId);
              }
              break;

            case 'phase_complete':
              if (data.phaseId) {
                setCompletedPhases(prev => [...prev, data.phaseId!]);
                if (data.result) {
                  setPhaseResults(prev => ({
                    ...prev,
                    [data.phaseId!]: data.result!,
                  }));
                }
                // Avançar para a próxima fase visualmente
                setActivePhaseId(data.phaseId + 1);
              }
              break;

            case 'workflow_complete':
              setSimStatus('completed');
              setActivePhaseId(null);
              closeEventSource();
              break;

            case 'error':
              console.error('[Workflow SSE] Erro:', data.error);
              setSimStatus('idle');
              setActivePhaseId(null);
              closeEventSource();
              break;
          }
        } catch (parseError) {
          console.error('[Workflow SSE] Erro ao parsear evento:', parseError);
        }
      };

      es.onerror = (err) => {
        console.error('[Workflow SSE] Erro na conexão:', err);
        // Se o status ainda for running, pode ter sido uma desconexão inesperada
        closeEventSource();
      };

    } catch (error) {
      console.error('[Workflow] Erro ao iniciar:', error);
      setSimStatus('idle');
      setActivePhaseId(null);
    }
  }, [closeEventSource]);

  const stopWorkflow = useCallback(async () => {
    closeEventSource();

    if (workflowId) {
      try {
        await fetch(`/api/workflow/${workflowId}/stop`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('[Workflow] Erro ao parar:', error);
      }
    }

    setSimStatus('idle');
    setActivePhaseId(null);
    setCompletedPhases([]);
    setPhaseResults({});
    setWorkflowId(null);
  }, [workflowId, closeEventSource]);

  return {
    startWorkflow,
    stopWorkflow,
    workflowId,
    activePhaseId,
    completedPhases,
    phaseResults,
    simStatus,
    setSimStatus,
    setActivePhaseId,
    setCompletedPhases,
    setPhaseResults,
  };
}
