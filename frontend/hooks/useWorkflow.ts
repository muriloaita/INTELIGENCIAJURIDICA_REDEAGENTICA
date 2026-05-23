import { useState, useCallback, useRef, useEffect } from 'react';
import { SimulationStatus, PhaseResults, PrazoFormData, WorkflowEvent, WorkflowInstance, QueueItem, WorkflowStatusResponse } from '../types';

export function useWorkflow() {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [activePhaseId, setActivePhaseId] = useState<number | null>(null);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [phaseResults, setPhaseResults] = useState<PhaseResults>({});
  const [simStatus, setSimStatus] = useState<SimulationStatus>('idle');
  const [docxDownloadUrl, setDocxDownloadUrl] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // ── Novos estados para multi-workflow ──────────────────────────
  const [allWorkflows, setAllWorkflows] = useState<WorkflowInstance[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLength, setQueueLength] = useState(0);
  const [maxQueue, setMaxQueue] = useState(20);
  const [canEnqueue, setCanEnqueue] = useState(true);

  // ── Polling de status multi-workflow a cada 5 segundos ─────────
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/workflow/status');
        if (res.ok) {
          const data: WorkflowStatusResponse = await res.json();
          setAllWorkflows(data.workflows);
          setQueue(data.queue);
          setQueueLength(data.queueLength);
          setMaxQueue(data.maxQueue);
          setCanEnqueue(data.canEnqueue);
        }
      } catch (e) { /* silent */ }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

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
    setDocxDownloadUrl(null);

    try {
      let response: Response;

      if (data.arquivos && data.arquivos.length > 0) {
        // Enviar como FormData com arquivos
        const formData = new FormData();
        formData.append('demanda', data.demanda);
        formData.append('autos', data.autos);
        formData.append('tipoPeticao', data.tipoPeticao);
        formData.append('observacao', data.observacao || '');
        data.arquivos.forEach(file => formData.append('files', file));
        response = await fetch('/api/workflow/start', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Sem arquivos, enviar como JSON
        response = await fetch('/api/workflow/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            demanda: data.demanda,
            autos: data.autos,
            tipoPeticao: data.tipoPeticao,
            observacao: data.observacao,
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`Erro ao iniciar workflow: ${response.statusText}`);
      }

      const responseData = await response.json();

      // Se foi enfileirado (já há outro workflow rodando), não abrir SSE
      if (responseData.queued) {
        setSimStatus('idle');
        setActivePhaseId(null);
        console.log(`[Workflow] Enfileirado na posição ${responseData.position}: ${responseData.message}`);
        return;
      }

      // Workflow iniciado diretamente
      const wfId = responseData.workflowId;
      setWorkflowId(wfId);
      setSimStatus('running');
      setActivePhaseId(1);

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

            case 'docx_ready':
              if (data.downloadUrl) {
                setDocxDownloadUrl(data.downloadUrl);
                console.log('[Workflow] DOCX pronto para download:', data.downloadUrl);
              }
              break;

            case 'checkpoint_required':
              setSimStatus('awaiting_input');
              break;

            case 'checkpoint_resolved':
              setSimStatus('running');
              break;

            case 'error':
              console.error('[Workflow SSE] Erro:', data.error);
              alert(`❌ Erro no workflow: ${data.error || 'Erro desconhecido. Verifique os logs do backend.'}`);
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
    setDocxDownloadUrl(null);
  }, [workflowId, closeEventSource]);

  // ── Responder a checkpoint humano ──────────────────────────────
  const respondToCheckpoint = useCallback(async (workflowId: string, responses: Record<string, string>) => {
    await fetch(`/api/workflow/${workflowId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responses }),
    });
  }, []);

  // ── Remover item da fila ───────────────────────────────────────
  const removeFromQueue = useCallback(async (queueId: string) => {
    await fetch(`/api/workflow/queue/${queueId}`, { method: 'DELETE' });
  }, []);

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
    docxDownloadUrl,
    // Multi-workflow
    allWorkflows,
    queue,
    queueLength,
    maxQueue,
    canEnqueue,
    respondToCheckpoint,
    removeFromQueue,
  };
}
