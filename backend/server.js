
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import 'dotenv/config';
import express from 'express';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { VertexClient } from './vertexClient.js';
import { WorkflowEngine } from './workflowEngine.js';
import { EmbeddingService } from './rag/embeddingService.js';
import { VectorStore } from './rag/vectorStore.js';
import { RagSearch } from './rag/ragSearch.js';
import { processDocument, inferCategoria } from './rag/documentProcessor.js';
import { generateDocx } from './docxGenerator.js';
import { WorkflowQueue } from './workflowQueue.js';

const app = express();
app.use(express.json({limit: process?.env?.API_PAYLOAD_MAX_SIZE || "7mb"}));

const PORT = process?.env?.API_BACKEND_PORT || 5000;
const API_BACKEND_HOST = process?.env?.API_BACKEND_HOST || "127.0.0.1";

const GOOGLE_CLOUD_LOCATION = process?.env?.GOOGLE_CLOUD_LOCATION;
const GOOGLE_CLOUD_PROJECT = process?.env?.GOOGLE_CLOUD_PROJECT;
if (!GOOGLE_CLOUD_PROJECT || !GOOGLE_CLOUD_LOCATION) {
  console.error("Error: Environment variables GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION must be set.");
  process.exit(1);
}
const PROXY_HEADER = process?.env?.PROXY_HEADER;
if (!PROXY_HEADER) {
  console.error("Error: Environment variables PROXY_HEADER must be set.");
  process.exit(1);
}

app.set('trust proxy', 1 /* number of proxies between user and server */);

// IMPORTANT: Vertex AI Studio Rate Limiting
// This rate limiting configuration protects your backend APIs from abuse.
// Removing it exposes your service to DoS attacks and unexpected costs.
const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Set ratelimit window at 15min (in ms)
    max: 100, // Limit each IP to 100 requests per window 
    standardHeaders: true, // Return rate limit info in the "RateLimit-*" headers
    legacyHeaders: false, // no "X-RateLimit-*" headers
    message: {
      error: 'Too many requests',
      message: 'You have exceed the request limit, please try again later.'
    },
});
// Apply the rate limiter to the /api-proxy route before the main proxy logic
app.use('/api-proxy', proxyLimiter);



const upload = multer({ dest: path.join(process.cwd(), 'uploads') });

// Map de listeners SSE para workflows ativos
const workflowListeners = new Map(); // workflowId -> Set<res>

const API_CLIENT_MAP = [
 {
    name: "VertexGenAi:generateContent",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:generateContent",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:generateContent`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "VertexGenAi:predict",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:predict",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:predict`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "VertexGenAi:streamGenerateContent",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:streamGenerateContent",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:streamGenerateContent`;
    },
    isStreaming: true,
    transformFn: (response) => {
        let normalizedResponse = response.trim();
        while (normalizedResponse.startsWith(',') || normalizedResponse.startsWith('[')) {
          normalizedResponse = normalizedResponse.substring(1).trim();
        }
        while (normalizedResponse.endsWith(',') || normalizedResponse.endsWith(']')) {
          normalizedResponse = normalizedResponse.substring(0, normalizedResponse.length - 1).trim();
        }

        if (!normalizedResponse.length) {
          return {result: null, inProgress: false};
        }

        if (!normalizedResponse.endsWith('}')) {
          return {result: normalizedResponse, inProgress: true};
        }

        try {
          const parsedResponse = JSON.parse(`${normalizedResponse}`);
          const transformedResponse = `data: ${JSON.stringify(parsedResponse)}\n\n`;
          return {result: transformedResponse, inProgress: false};
        } catch (error) {
          throw new Error(`Failed to parse response: ${error}.`);
        }
    },
  },
 {
    name: "ReasoningEngine:query",
    patternForProxy: "https://{{endpoint_location}}-aiplatform.googleapis.com/{{version}}/projects/{{project_id}}/locations/{{location_id}}/reasoningEngines/{{engine_id}}:query",
    getApiEndpoint: (context, params) => {
      return `https://${params['endpoint_location']}-aiplatform.clients6.google.com/v1beta1/projects/${params['project_id']}/locations/${params['location_id']}/reasoningEngines/${params['engine_id']}:query`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "ReasoningEngine:streamQuery",
    patternForProxy: "https://{{endpoint_location}}-aiplatform.googleapis.com/{{version}}/projects/{{project_id}}/locations/{{location_id}}/reasoningEngines/{{engine_id}}:streamQuery",
    getApiEndpoint: (context, params) => {
      return `https://${params['endpoint_location']}-aiplatform.clients6.google.com/v1beta1/projects/${params['project_id']}/locations/${params['location_id']}/reasoningEngines/${params['engine_id']}:streamQuery`;
    },
    isStreaming: true,
    transformFn: null,
  },
].map((client) => ({ ...client, patternInfo: parsePattern(client.patternForProxy) }));

// Uses Google Application Default Credentials (ADC).
// Users need to run "gcloud auth application-default login" in order to use the proxy.
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

// --- Inicialização dos Serviços de IA e RAG ---
const SUPABASE_URL = process?.env?.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process?.env?.SUPABASE_SERVICE_KEY;

let supabase, vertexClient, embeddingService, vectorStore, ragSearchService, workflowEngine;

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  vertexClient = new VertexClient(auth, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION);
  embeddingService = new EmbeddingService(vertexClient);
  vectorStore = new VectorStore(supabase);
  ragSearchService = new RagSearch(embeddingService, vectorStore);
  workflowEngine = new WorkflowEngine(vertexClient, supabase, ragSearchService);
  console.log('[Server] Serviços de IA e RAG inicializados com sucesso.');
} else {
  console.warn('[Server] SUPABASE_URL/SERVICE_KEY não configurados. Serviços de IA desativados.');
}

// ── Diretório para salvar DOCX em disco (sobrevive restart) ──
const DOCX_OUTPUT_DIR = path.join(process.cwd(), 'output', 'docx');
if (!fs.existsSync(DOCX_OUTPUT_DIR)) fs.mkdirSync(DOCX_OUTPUT_DIR, { recursive: true });

// ── Helper: Broadcast SSE para listeners de um workflow ──
function broadcastSSE(workflowId, eventPayload) {
  const listeners = workflowListeners.get(workflowId);
  if (!listeners || listeners.size === 0) return;
  const eventData = `data: ${JSON.stringify({ ...eventPayload, workflowId })}\n\n`;
  for (const listener of listeners) {
    try { listener.write(eventData); } catch (e) { listeners.delete(listener); }
  }
}

// ── Helper: Limpar SSE listeners após workflow terminar ──
function cleanupSSE(workflowId) {
  setTimeout(() => {
    const ls = workflowListeners.get(workflowId);
    if (ls) {
      for (const l of ls) { try { l.end(); } catch (e) { /* ignore */ } }
      workflowListeners.delete(workflowId);
    }
  }, 2000);
}

// ── Helper: Salvar petição pronta no Supabase ──
async function savePetitionToSupabase(workflowId, prazoData, docxUrl) {
  if (!supabase) return;
  try {
    const record = {
      id: workflowId,  // UUID completo — compatível com a coluna uuid do Supabase
      demanda: prazoData.demanda || '',
      autos: prazoData.autos || '',
      tipo_peticao: prazoData.tipoPeticao || '',
      tipo_peca: prazoData.tipoPeticao || '',
      observacao: prazoData.observacao || '',
      status: 'Aguardando Revisão',
      data_conclusao: new Date().toISOString(),
    };
    // Tentar com docx_url; se a coluna não existir, tenta sem
    let { error } = await supabase.from('peticoes_prontas').upsert({ ...record, docx_url: docxUrl || null });
    if (error && error.message?.includes('docx_url')) {
      ({ error } = await supabase.from('peticoes_prontas').upsert(record));
    }
    if (error) throw error;
    console.log(`[Server] Petição ${workflowId} salva no Supabase.`);
  } catch (err) {
    console.error('[Server] Erro ao salvar petição no Supabase:', err.message);
  }
}

// ── Helper: Registrar no histórico de fluxos ──
async function saveHistoryToSupabase(workflowId, prazoData, status) {
  if (!supabase) return;
  try {
    await supabase.from('historico_fluxos').insert({
      fluxo_codigo: `FLX-${workflowId.substring(0, 8)}`,
      data: new Date().toISOString(),
      demanda: prazoData.demanda || '',
      autos: prazoData.autos || '',
      tipo_peticao: prazoData.tipoPeticao || '',
      status,
    });
    console.log(`[Server] Histórico FLX-${workflowId.substring(0, 8)} registrado (${status}).`);
  } catch (err) {
    console.error('[Server] Erro ao registrar histórico:', err.message);
  }
}

// ── Mapa de tipos de petição para categorias da base de conhecimento ──
const TIPO_TO_CATEGORIA = {
  'MANIFESTAÇÃO DA PARTE': 'manifestacao',
  'ESPECIFICAÇÃO DE PROVAS': 'geral',
  'IMPUGNAÇÃO À CONTESTAÇÃO': 'impugnacao',
  'QUESITOS': 'quesitos',
  'CUMPRIMENTO DE INTIMAÇÃO': 'cumprimento_sentenca',
  'AGRAVO DE INSTRUMENTO': 'agravo_instrumento',
  'EMBARGOS DE DECLARAÇÃO': 'embargos_declaracao',
  'RECURSO DE APELAÇÃO': 'recurso_apelacao',
  'RECURSO INOMINADO': 'recurso_apelacao',
};

/**
 * Indexa a petição gerada na base de conhecimento (RAG).
 * Cada petição pronta retroalimenta o sistema para melhorar peças futuras.
 */
async function indexPetitionInKnowledgeBase(petitionText, prazoData, workflowId) {
  if (!embeddingService || !vectorStore) {
    console.warn('[RAG] Serviços RAG indisponíveis — petição não indexada.');
    return;
  }

  try {
    const tipoPeticao = prazoData.tipoPeticao || '';
    const autos = prazoData.autos || 'sem_autos';
    const categoria = TIPO_TO_CATEGORIA[tipoPeticao] || 'geral';
    const documentoOrigem = `Peticao_Gerada_${autos.replace(/[^a-zA-Z0-9.-]/g, '_')}_${workflowId.substring(0, 8)}`;

    // Dividir petição em chunks de ~1500 caracteres (respeitando parágrafos)
    const paragraphs = petitionText.split(/\n{2,}/);
    const chunks = [];
    let currentChunk = '';
    const CHUNK_SIZE = 1500;

    for (const paragraph of paragraphs) {
      if ((currentChunk + '\n\n' + paragraph).length > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    // Montar objetos de chunk com metadados
    const chunkObjects = chunks.map((text, index) => ({
      titulo: `${tipoPeticao} — Autos ${autos} (Chunk ${index + 1}/${chunks.length})`,
      conteudo: text,
      chunk_index: index,
      total_chunks: chunks.length,
      documento_origem: documentoOrigem,
      categoria,
      fonte: 'peticao_gerada',
      metadata: {
        tipo_peticao: tipoPeticao,
        autos,
        demanda: prazoData.demanda || '',
        workflow_id: workflowId,
        gerado_em: new Date().toISOString(),
      },
    }));

    // Gerar embeddings
    const texts = chunkObjects.map(c => c.conteudo);
    const embeddings = await embeddingService.embedBatch(texts);

    // Inserir no vector store
    const result = await vectorStore.insertChunks(chunkObjects, embeddings);
    console.log(`[RAG] Petição indexada: ${documentoOrigem} — ${result.inserted}/${chunks.length} chunks inseridos.`);

    if (result.errors.length > 0) {
      console.warn('[RAG] Erros na indexação:', result.errors);
    }
  } catch (err) {
    console.error('[RAG] Erro ao indexar petição na base de conhecimento:', err.message);
  }
}

/**
 * Factory: cria event handler unificado para qualquer workflow (direto ou enfileirado).
 * Lida com: DOCX generation, Supabase persistence, SSE broadcast, RAG indexing.
 */
function createWorkflowEventHandler(workflowId, prazoData) {
  // Garantir que temos SSE listeners para este workflow
  if (!workflowListeners.has(workflowId)) {
    workflowListeners.set(workflowId, new Set());
  }

  return (event) => {
    // 1) Quando Fase 6 (Redação) completa → gerar DOCX + indexar na base de conhecimento
    if (event.type === 'phase_complete' && event.phaseId === 6 && event.result) {
      // 1a) Gerar DOCX
      generateDocx(event.result, {
        autos: prazoData.autos,
        tipoPeticao: prazoData.tipoPeticao,
        demanda: prazoData.demanda,
      }).then((buffer) => {
        const safeAutos = (prazoData.autos || 'sem_autos').replace(/[^a-zA-Z0-9.\-]/g, '_');
        const filename = `Peticao_${safeAutos}.docx`;

        // Salvar em disco (sobrevive restart)
        const diskPath = path.join(DOCX_OUTPUT_DIR, `${workflowId}.docx`);
        fs.writeFileSync(diskPath, buffer);

        // Salvar em memória (acesso rápido)
        generatedDocxFiles.set(workflowId, { buffer, filename });

        // Atualizar estado do workflow
        const wfState = workflowEngine.getWorkflowStatus(workflowId);
        if (wfState) wfState.docxUrl = `/api/workflow/${workflowId}/docx`;

        console.log(`[Server] DOCX gerado: ${filename} (${buffer.length} bytes) → disco + memória`);

        // Broadcast SSE: DOCX pronto
        broadcastSSE(workflowId, {
          type: 'docx_ready',
          filename,
          downloadUrl: `/api/workflow/${workflowId}/docx`,
        });
      }).catch((err) => {
        console.error('[Server] Erro ao gerar DOCX:', err.message);
      });

      // 1b) Indexar petição na base de conhecimento (em paralelo, não bloqueia)
      indexPetitionInKnowledgeBase(event.result, prazoData, workflowId);
    }

    // 2) Broadcast do evento para SSE listeners
    broadcastSSE(workflowId, event);

    // 3) Quando workflow termina → salvar no Supabase + cleanup
    if (event.type === 'workflow_complete') {
      const docxUrl = `/api/workflow/${workflowId}/docx`;
      savePetitionToSupabase(workflowId, prazoData, docxUrl);
      saveHistoryToSupabase(workflowId, prazoData, 'Concluído');
    }

    if (event.type === 'error') {
      saveHistoryToSupabase(workflowId, prazoData, 'Erro');
    }

    if (event.type === 'workflow_cancelled') {
      saveHistoryToSupabase(workflowId, prazoData, 'Cancelado');
    }

    // 4) Cleanup SSE + liberar fila nos eventos terminais
    if (['workflow_complete', 'workflow_cancelled', 'error'].includes(event.type)) {
      cleanupSSE(workflowId);
    }
  };
}

// Instância do gerenciador de fila de workflows (com factory de handlers)
const workflowQueue = workflowEngine ? new WorkflowQueue(workflowEngine, createWorkflowEventHandler) : null;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePattern(pattern) {
  const paramRegex = /\{\{(.*?)\}\}/g;
  const params = [];
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = paramRegex.exec(pattern)) !== null) {
    params.push(match[1]);
    const literalPart = pattern.substring(lastIndex, match.index);
    parts.push(escapeRegex(literalPart));
    parts.push(`(?<${match[1]}>[^/]+)`);
    lastIndex = paramRegex.lastIndex;
  }
  parts.push(escapeRegex(pattern.substring(lastIndex)));
  const regexString = parts.join('');

  return {regex: new RegExp(`^${regexString}$`), params};
}

function extractParams(patternInfo, url) {
  const match = url.match(patternInfo.regex);
  if (!match) return null;
  const params = {};
  patternInfo.params.forEach((paramName, index) => {
    params[paramName] = match[index + 1];
  });
  return params;
}

async function getAccessToken(res) {
  try {
    const authClient = await auth.getClient();
    const token = await authClient.getAccessToken();
    return token.token;
  } catch (error) {
    console.error('[Node Proxy] Authentication error:', error);
    if (!res) return null;
    if (error.code === 'ERR_GCLOUD_NOT_LOGGED_IN' || (error.message && error.message.includes('Could not load the default credentials'))) {
      res.status(401).json({
        error: 'Authentication Required',
        message: 'Google Cloud Application Default Credentials not found or invalid. Please run "gcloud auth application-default login" and try again.',
      });
    } else {
      res.status(500).json({ error: `Authentication failed: ${error.message}` });
    }
    return null;
  }
}

function getRequestHeaders(accessToken) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'X-Goog-User-Project': GOOGLE_CLOUD_PROJECT,
    'Content-Type': 'application/json',
  };
}

// --- Proxy Endpoint ---
app.post('/api-proxy', async (req, res) => {

  // Check for the custom header added by the shim
  if (req.headers['x-app-proxy'] !== PROXY_HEADER) {
    return res.status(403).send('Forbidden: Request must originate from the Vertex App shim.');
  }

  const { originalUrl, method, headers, body } = req.body;
  if (!originalUrl) {
    return res.status(400).send('Bad Request: originalUrl is required.');
  }

  // 1. Find the matching API client
  const apiClient = API_CLIENT_MAP.find(p => {
    // We store extractedParams on req for use later if needed, though getVertexUrl takes it as arg.
    req.extractedParams = extractParams(p.patternInfo, originalUrl);
    return req.extractedParams !== null;
  });

  if (!apiClient) {
    console.error(`[Node Proxy] No API client handler found for URL: ${originalUrl}`);
    return res.status(404).json({ error: `No proxy handler found for URL: ${originalUrl}` });
  }

  const extractedParams = req.extractedParams;
  console.log(`[Node Proxy] Matched API client: ${apiClient.name}`);
  try {
    // 2. Get authenticated access token
    const accessToken = await getAccessToken(res);
    if (!accessToken) return;

    // 3. Construct the full API URL using env-set GOOGLE_CLOUD_PROJECT/LOCATION and extracted params
    const context = {projectId: GOOGLE_CLOUD_PROJECT, region: GOOGLE_CLOUD_LOCATION};
    const apiUrl = apiClient.getApiEndpoint(context, extractedParams);
    console.log(`[Node Proxy] Forwarding to Vertex API: ${apiUrl}`);

    // 4. Prepare headers for the API call
    const apiHeaders = getRequestHeaders(accessToken);

    const apiFetchOptions = {
      method: method || 'POST',
      headers: {...apiHeaders, ...headers},
      body: body ? body : undefined,
    };

    // 5. Make the call to the API
    const apiResponse = await fetch(apiUrl, apiFetchOptions);

    // 6. Respond to the client based on stream type
    if (apiClient.isStreaming) {
      console.log(`[Node Proxy] Sending STREAMING response for ${apiClient.name}`);
      // Set headers for a streaming JSON response
      res.writeHead(apiResponse.status, {
        'Content-Type': 'text/event-stream',
        'Transfer-Encoding': 'chunked',
        'Connection': 'keep-alive',
      });
      // Immediately send headers
      res.flushHeaders();

      if (!apiResponse.body) {
        console.error('[Node Proxy] Streaming response has no body.');
        return res.end(JSON.stringify({ error: 'Streaming response body is null' }));
      }

      const decoder = new TextDecoder();
      let deltaChunk = '';
      apiResponse.body.on('data', (encodedChunk) => {
        if (res.writableEnded) return; // Prevent writing after res.end()

        try {
          if (!apiClient.transformFn) {
            res.write(encodedChunk);
          } else {
            const decodedChunk = decoder.decode(encodedChunk, { stream: true });
            deltaChunk = deltaChunk + decodedChunk;

            const {result, inProgress} = apiClient.transformFn(deltaChunk);
            if (result && !inProgress) {
              deltaChunk = '';
              res.write(new TextEncoder().encode(result));
            }
          }
        } catch (error) {
          console.error(`[Node Proxy] Error processing streaming response for ${apiClient.name}`);
          console.error(error);
        }
      });

      apiResponse.body.on('end', () => {
        deltaChunk = '';
        console.log(`[Node Proxy] Vertex stream finished and all data processed for ${apiClient.name}`);
        res.end();
      });

      apiResponse.body.on('error', (streamError) => {
        console.error('[Node Proxy] Error from Vertex stream:', streamError);
        if (!res.writableEnded) {
          res.end(JSON.stringify({ proxyError: 'Stream error from Vertex AI', details: streamError.message }));
        }
      });

      res.on('error', (resError) => {
        console.error('[Node Proxy] Error writing to client response:', resError);
        // The source stream might need to be destroyed if an error occurs here.
        if (apiResponse.body && typeof apiResponse.body.destroy === 'function') {
             apiResponse.body.destroy(resError);
        }
      });
    } else {
      // Non-streaming response handling
      console.log(`[Node Proxy] Sending JSON response for ${apiClient.name}`);
      const data = await apiResponse.json();
      res.status(apiResponse.status).json(data);
    }
  } catch (error) {
    console.error(`[Node Proxy] Error proxying request for ${apiClient.name}`);
    console.error(error)
    res.status(500).json({ error: error });
  }
});

// Mapa de arquivos DOCX gerados (workflowId → { buffer, filename })
const generatedDocxFiles = new Map();

// ========================================
// ROTAS DE WORKFLOW (Agentes de IA)
// ========================================

// POST /api/workflow/start — Inicia workflow em background (com suporte a fila e upload de arquivos)
app.post('/api/workflow/start', upload.array('files', 20), async (req, res) => {
  if (!workflowEngine) {
    return res.status(503).json({ error: 'Serviços de IA não inicializados. Verifique as variáveis SUPABASE.' });
  }

  try {
    const { demanda, autos, tipoPeticao, observacao } = req.body;

    if (!demanda && !tipoPeticao) {
      return res.status(400).json({ error: 'Campos "demanda" ou "tipoPeticao" são obrigatórios.' });
    }

    // ── Processar arquivos anexados (extrair texto + indexar na KB) ──
    let documentosAnexos = '';
    const files = req.files || [];
    if (files.length > 0) {
      console.log(`[Server] Processando ${files.length} arquivo(s) anexado(s) ao workflow...`);
      const extractedTexts = [];

      for (const file of files) {
        const ext = path.extname(file.originalname).toLowerCase();
        const renamedPath = file.path + ext;
        fs.renameSync(file.path, renamedPath);

        try {
          const chunks = await processDocument(renamedPath, null, 'workflow_upload');
          if (chunks && chunks.length > 0) {
            // Acumular texto extraído para injetar no contexto do workflow
            const fileText = chunks.map(c => c.content).join('\n');
            extractedTexts.push(`── Arquivo: ${file.originalname} ──\n${fileText}`);

            // Indexar na base de conhecimento (em paralelo, não bloqueia)
            if (embeddingService && vectorStore) {
              try {
                const texts = chunks.map(c => c.content);
                const embeddings = await embeddingService.embedBatch(texts);

                const chunkObjects = chunks.map((c, i) => ({
                  titulo: `${file.originalname} (Chunk ${i + 1}/${chunks.length})`,
                  conteudo: c.content,
                  chunk_index: i,
                  total_chunks: chunks.length,
                  documento_origem: file.originalname,
                  categoria: c.metadata?.categoria || inferCategoria(file.originalname, fileText),
                  fonte: 'workflow_upload',
                  metadata: {
                    ...c.metadata,
                    autos: autos || '',
                    demanda: demanda || '',
                  },
                }));

                await vectorStore.insertChunks(chunkObjects, embeddings);
                console.log(`[Server] Arquivo "${file.originalname}" indexado: ${chunks.length} chunks.`);
              } catch (indexErr) {
                console.error(`[Server] Erro ao indexar ${file.originalname}:`, indexErr.message);
              }
            }
          } else {
            console.warn(`[Server] Sem texto extraído de ${file.originalname}`);
          }
        } catch (fileErr) {
          console.error(`[Server] Erro ao processar ${file.originalname}:`, fileErr.message);
        }

        // Limpar arquivo temporário
        try { fs.unlinkSync(renamedPath); } catch {}
      }

      documentosAnexos = extractedTexts.join('\n\n');
      if (documentosAnexos) {
        console.log(`[Server] Texto total extraído dos anexos: ${documentosAnexos.length} caracteres.`);
      }
    }

    // Carregar agentConfigs do Supabase (se existir tabela agent_configs)
    let agentConfigs = {};
    try {
      const { data: configsData } = await supabase.from('agent_configs').select('*');
      (configsData || []).forEach((r) => {
        agentConfigs[r.agent_id] = {
          customInstructions: r.custom_instructions || null,
          temperature: r.temperature || null,
          maxOutputTokens: r.max_output_tokens || null,
        };
      });
    } catch (configErr) {
      console.warn('[Server] Tabela agent_configs não encontrada, usando defaults.');
    }

    // Verificar se já há um workflow em execução — se sim, enfileirar
    const runningWorkflows = workflowEngine.getWorkflowsByStatus('running');
    if (runningWorkflows.length > 0 && workflowQueue) {
      try {
        const queueItem = workflowQueue.enqueue(
          { demanda, autos, tipoPeticao, observacao, documentosAnexos },
          agentConfigs
        );
        return res.json({
          queued: true,
          queueId: queueItem.id,
          position: workflowQueue.queue.length,
          message: `Workflow enfileirado na posição ${workflowQueue.queue.length}. Será iniciado automaticamente.`,
        });
      } catch (queueErr) {
        return res.status(429).json({ error: queueErr.message });
      }
    }

    const workflowId = uuidv4();
    const prazoData = { demanda, autos, tipoPeticao, observacao, documentosAnexos };

    // Usar handler centralizado (DOCX + Supabase + SSE)
    const eventHandler = createWorkflowEventHandler(workflowId, prazoData);

    // Iniciar workflow em background
    workflowEngine.startWorkflow(prazoData, agentConfigs, eventHandler, workflowId);

    res.json({ workflowId, status: 'started' });
  } catch (error) {
    console.error('[Server] Erro ao iniciar workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/workflow/status — Dashboard: lista todos os workflows e status da fila
// IMPORTANTE: esta rota DEVE vir ANTES das rotas com :id para não ser capturada como parâmetro
app.get('/api/workflow/status', (req, res) => {
  if (!workflowEngine) {
    return res.status(503).json({ error: 'Serviços não inicializados' });
  }
  const workflows = workflowEngine.getAllWorkflows();
  const queueStatus = workflowQueue ? workflowQueue.getStatus() : { queue: [], queueLength: 0 };
  res.json({ workflows, ...queueStatus });
});

// GET /api/workflow/:id/events — SSE para acompanhar progresso do workflow
app.get('/api/workflow/:id/events', (req, res) => {
  const workflowId = req.params.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Enviar heartbeat inicial
  res.write(`data: ${JSON.stringify({ type: 'connected', workflowId })}\n\n`);

  // Registrar este listener
  if (!workflowListeners.has(workflowId)) {
    workflowListeners.set(workflowId, new Set());
  }
  workflowListeners.get(workflowId).add(res);

  // Limpar ao desconectar
  req.on('close', () => {
    const listeners = workflowListeners.get(workflowId);
    if (listeners) {
      listeners.delete(res);
    }
  });
});

// POST /api/workflow/:id/stop — Para um workflow em execução
app.post('/api/workflow/:id/stop', (req, res) => {
  if (!workflowEngine) {
    return res.status(503).json({ error: 'Serviços de IA não inicializados.' });
  }

  const workflowId = req.params.id;
  workflowEngine.stopWorkflow(workflowId);
  res.json({ message: `Workflow ${workflowId} marcado para cancelamento.` });
});

// POST /api/workflow/:id/respond — Retoma workflow pausado em checkpoint humano
app.post('/api/workflow/:id/respond', (req, res) => {
  if (!workflowEngine) {
    return res.status(503).json({ error: 'Serviços não inicializados.' });
  }

  try {
    const { responses } = req.body;
    workflowEngine.resumeWorkflow(req.params.id, responses);
    res.json({ message: 'Workflow retomado com sucesso.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/workflow/queue/:id — Remove item da fila de workflows
app.delete('/api/workflow/queue/:id', (req, res) => {
  if (!workflowQueue) {
    return res.status(503).json({ error: 'Fila não inicializada.' });
  }
  workflowQueue.dequeue(req.params.id);
  res.json({ message: 'Removido da fila.' });
});

// GET /api/workflow/:id/docx — Download da petição em Word (.docx)
app.get('/api/workflow/:id/docx', (req, res) => {
  const workflowId = req.params.id;

  // 1) Tentar memória (rápido)
  const docxData = generatedDocxFiles.get(workflowId);
  if (docxData) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${docxData.filename}"`);
    res.setHeader('Content-Length', docxData.buffer.length);
    return res.send(docxData.buffer);
  }

  // 2) Tentar disco (sobrevive restart)
  const diskPath = path.join(DOCX_OUTPUT_DIR, `${workflowId}.docx`);
  if (fs.existsSync(diskPath)) {
    const wf = workflowEngine?.getWorkflowStatus(workflowId);
    const safeAutos = (wf?.prazoData?.autos || 'peticao').replace(/[^a-zA-Z0-9.\-]/g, '_');
    const filename = `Peticao_${safeAutos}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.sendFile(diskPath);
  }

  return res.status(404).json({ error: 'DOCX ainda não gerado ou workflow não encontrado.' });
});

// ========================================
// ROTAS DE KNOWLEDGE BASE (RAG)
// ========================================

// POST /api/knowledge/upload — Upload e indexação de documento
app.post('/api/knowledge/upload', upload.array('files', 20), async (req, res) => {
  if (!embeddingService || !vectorStore) {
    return res.status(503).json({ error: 'Serviços RAG não inicializados.' });
  }

  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const categoria = req.body.categoria || null;
    const fonte = req.body.fonte || 'upload';
    let totalChunksProcessados = 0;
    let totalChunksInseridos = 0;
    const allErrors = [];

    for (const file of files) {
      // Renomear para manter a extensão original (multer salva sem extensão)
      const ext = path.extname(file.originalname).toLowerCase();
      const renamedPath = file.path + ext;
      fs.renameSync(file.path, renamedPath);

      try {
        // Processar documento
        const chunks = await processDocument(renamedPath, categoria, fonte);
        if (!chunks || chunks.length === 0) {
          fs.unlinkSync(renamedPath);
          allErrors.push(`${file.originalname}: Sem texto extraído`);
          continue;
        }

        // Gerar embeddings
        const texts = chunks.map((c) => c.conteudo);
        const embeddings = await embeddingService.embedBatch(texts);

        // Inserir no vector store
        const result = await vectorStore.insertChunks(chunks, embeddings);
        totalChunksProcessados += chunks.length;
        totalChunksInseridos += result.inserted;
        if (result.errors.length > 0) allErrors.push(...result.errors);

        // Limpar arquivo temporário
        fs.unlinkSync(renamedPath);
      } catch (fileErr) {
        allErrors.push(`${file.originalname}: ${fileErr.message}`);
        try { fs.unlinkSync(renamedPath); } catch (e) { /* ignore */ }
      }
    }

    res.json({
      message: `${files.length} arquivo(s) processado(s).`,
      arquivos: files.length,
      chunksProcessados: totalChunksProcessados,
      chunksInseridos: totalChunksInseridos,
      erros: allErrors,
    });
  } catch (error) {
    console.error('[Server] Erro no upload:', error);
    // Limpar arquivos temporários
    if (req.files) {
      for (const f of req.files) {
        try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
      }
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/knowledge/ingest-local — Ingestão de diretório local via SSE
app.post('/api/knowledge/ingest-local', async (req, res) => {
  if (!embeddingService || !vectorStore) {
    return res.status(503).json({ error: 'Serviços RAG não inicializados.' });
  }

  // SSE para progresso
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const sendEvent = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) { /* ignore */ }
  };

  try {
    const { directoryPath } = req.body;
    if (!directoryPath || !fs.existsSync(directoryPath)) {
      sendEvent({ type: 'error', error: 'Diretório não encontrado: ' + directoryPath });
      res.end();
      return;
    }

    // Varrer recursivamente
    const allFiles = [];
    const walkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.pdf', '.docx', '.txt'].includes(ext)) {
            allFiles.push(fullPath);
          }
        }
      }
    };
    walkDir(directoryPath);

    sendEvent({ type: 'scan_complete', totalFiles: allFiles.length });

    let processados = 0;
    let erros = 0;
    let totalChunks = 0;

    for (const filePath of allFiles) {
      try {
        sendEvent({
          type: 'processing',
          file: path.basename(filePath),
          current: processados + 1,
          total: allFiles.length,
        });

        const chunks = await processDocument(filePath, null, 'local');
        if (!chunks || chunks.length === 0) {
          erros++;
          sendEvent({ type: 'skipped', file: path.basename(filePath), reason: 'Sem texto extraído' });
          continue;
        }

        const texts = chunks.map((c) => c.conteudo);
        const embeddings = await embeddingService.embedBatch(texts);
        const result = await vectorStore.insertChunks(chunks, embeddings);

        processados++;
        totalChunks += result.inserted;

        sendEvent({
          type: 'file_complete',
          file: path.basename(filePath),
          chunks: result.inserted,
          current: processados,
          total: allFiles.length,
        });
      } catch (fileErr) {
        erros++;
        sendEvent({
          type: 'file_error',
          file: path.basename(filePath),
          error: fileErr.message,
        });
      }
    }

    sendEvent({
      type: 'ingest_complete',
      totalProcessados: processados,
      totalErros: erros,
      totalChunks,
    });
  } catch (error) {
    sendEvent({ type: 'error', error: error.message });
  }

  res.end();
});

// POST /api/knowledge/search — Busca semântica na base de conhecimento
app.post('/api/knowledge/search', async (req, res) => {
  if (!ragSearchService) {
    return res.status(503).json({ error: 'Serviço RAG não inicializado.' });
  }

  try {
    const { query, topK, threshold, categoria } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Campo "query" é obrigatório.' });
    }

    const results = await ragSearchService.search(query, {
      topK: topK || 5,
      threshold: threshold || 0.7,
      categoria: categoria || null,
    });

    res.json({
      query,
      results,
      total: results.length,
    });
  } catch (error) {
    console.error('[Server] Erro na busca RAG:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/knowledge/list — Lista documentos na base
app.get('/api/knowledge/list', async (req, res) => {
  if (!vectorStore) {
    return res.status(503).json({ error: 'VectorStore não inicializado.' });
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const categoria = req.query.categoria || null;

    const result = await vectorStore.listDocuments(page, pageSize, categoria);
    res.json(result);
  } catch (error) {
    console.error('[Server] Erro ao listar documentos:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/knowledge/stats — Estatísticas da base de conhecimento
app.get('/api/knowledge/stats', async (req, res) => {
  if (!vectorStore) {
    return res.status(503).json({ error: 'VectorStore não inicializado.' });
  }

  try {
    const stats = await vectorStore.getStats();
    res.json(stats);
  } catch (error) {
    console.error('[Server] Erro ao obter estatísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/knowledge/:id — Remove documento por nome
app.delete('/api/knowledge/:id', async (req, res) => {
  if (!vectorStore) {
    return res.status(503).json({ error: 'VectorStore não inicializado.' });
  }

  try {
    const documentoOrigem = req.params.id;
    const result = await vectorStore.deleteByDocumento(documentoOrigem);
    res.json({
      message: `Documento "${documentoOrigem}" removido.`,
      chunksRemovidos: result.deleted,
    });
  } catch (error) {
    console.error('[Server] Erro ao deletar documento:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/knowledge/:id/categoria — Atualiza categoria do documento
app.patch('/api/knowledge/:id/categoria', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase não inicializado.' });
  }

  try {
    const documentoOrigem = req.params.id;
    const { categoria } = req.body;
    if (!categoria) {
      return res.status(400).json({ error: 'Campo "categoria" é obrigatório.' });
    }

    // Atualiza todos os chunks do mesmo documento
    const { data, error } = await supabase
      .from('knowledge_base')
      .update({ categoria })
      .eq('documento_origem', documentoOrigem);

    if (error) throw error;

    res.json({
      message: `Categoria de "${documentoOrigem}" atualizada para "${categoria}".`,
    });
  } catch (error) {
    console.error('[Server] Erro ao atualizar categoria:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/knowledge/:id/download — Download do conteúdo do documento
app.get('/api/knowledge/:id/download', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase não inicializado.' });
  }

  try {
    const documentoOrigem = req.params.id;

    // Buscar todos os chunks do documento, ordenados pelo index
    const { data: chunks, error } = await supabase
      .from('knowledge_base')
      .select('conteudo, chunk_index, titulo')
      .eq('documento_origem', documentoOrigem)
      .order('chunk_index', { ascending: true });

    if (error) throw error;
    if (!chunks || chunks.length === 0) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    // Concatenar todos os chunks
    const fullText = chunks.map((c) => c.conteudo).join('\n\n--- Chunk ---\n\n');
    const filename = documentoOrigem.replace(/\.[^.]+$/, '') + '.txt';

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(fullText);
  } catch (error) {
    console.error('[Server] Erro ao baixar documento:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// SERVIDOR
// ========================================

const server = app.listen(PORT, API_BACKEND_HOST, () => {
  console.log(`Vertex AI Backend listening at http://localhost:${PORT}`);
});


const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === '/ws-proxy') {
    
    let targetUrl = url.searchParams.get('target');
    if (!targetUrl) {
      console.log('[Node Proxy] Missing target URL');
      socket.destroy();
      return;
    }

    if (targetUrl === 'wss://aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent') {
      const location = GOOGLE_CLOUD_LOCATION === 'global' ? 'us-central1' : GOOGLE_CLOUD_LOCATION;
      targetUrl = `wss://${location}-aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
    } else {
      console.log('[Node Proxy] Invalid target URL');
      socket.destroy();
      return;
    }

    let accessToken;

    try {
      accessToken = await getAccessToken();
      if (!accessToken) throw new Error('No token');
    } catch (err) {
      console.log('[Node Proxy] Authentication failed');
      socket.destroy();
      return;
    }

    console.log(`[Node Proxy] Initiating upstream connection to: ${targetUrl}`);

    let upstreamWs;

    try {
      upstreamWs = new WebSocket(targetUrl, {
        headers: getRequestHeaders(accessToken)
      });
    } catch (e) {
      console.error('[Node Proxy] Invalid Upstream URL');
      socket.destroy();
      return;
    }

    const initialErrorHandler = (error) => {
      console.error('[Node Proxy] Upstream connection failed:', error);
      upstreamWs.removeEventListener('open', onUpstreamOpen);

      if (socket.writable) {
        socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        socket.destroy();
      }
    };

    upstreamWs.once('error', initialErrorHandler);

    // 5. Handle Successful Upstream Connection
    const onUpstreamOpen = () => {
      // Remove the "bootstrapping" error handler
      upstreamWs.removeListener('error', initialErrorHandler);

      // Perform the HTTP -> WebSocket upgrade for the Client
      wss.handleUpgrade(request, socket, head, (ws) => {

        upstreamWs.on('message', (data, isBinary) => {
          const logMsg = isBinary ? '<Binary Data>' : data.toString();
          console.log(`[Upstream -> Client] [${new Date().toISOString()}]: ${logMsg}`);

          if (ws.readyState === WebSocket.OPEN) {
            if (data === undefined || data === null) {
              console.warn('[Node Proxy] Attempted to send undefined/null data to client');
              return;
            }
            ws.send(data, { binary: isBinary });
          }
        });

        ws.on('message', (data, isBinary) => {
          const logMsg = isBinary ? '<Binary Data>' : data.toString();

          let dataJson = {};
          try {
            dataJson = JSON.parse(data.toString());
          } catch (error) {
            console.error('[Node Proxy] Failed to parse message from client:', error);
            ws.close(1011, 'Failed to parse message');
          }

          if (dataJson['setup']) {
            dataJson['setup']['model'] = `projects/${GOOGLE_CLOUD_PROJECT}/locations/${GOOGLE_CLOUD_LOCATION}/${dataJson['setup']['model']}`;
          }

          if (upstreamWs.readyState === WebSocket.OPEN) {
            upstreamWs.send(JSON.stringify(dataJson), { binary: false });
          }
        });

        upstreamWs.on('error', (error) => {
          console.error('[Node Proxy] Upstream error:', error);
          ws.close(1011, error.message);
        });

        upstreamWs.on('close', (code, reason) => {
          console.log(`[Node Proxy] Upstream closed: ${code} ${reason}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(code, reason);
          }
        });

        ws.on('error', (error) => {
          console.error('[Node Proxy] Client error:', error);
          upstreamWs.close(1011, error.message);
        });

        ws.on('close', (code, reason) => {
          console.log(`[Node Proxy] Client closed: ${code} ${reason}`);
          if (upstreamWs.readyState === WebSocket.OPEN) {
            upstreamWs.close(1000, reason);
          }
        });

        wss.emit('connection', ws, request);
      });
    };

    upstreamWs.once('open', onUpstreamOpen);

  } else {
    // Path did not match
    socket.destroy();
  }
});


