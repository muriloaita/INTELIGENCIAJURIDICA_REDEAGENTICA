# AGENTS.md — Instruções para o Jules (Google AI Coding Agent)

## Visão Geral do Projeto

Rede Agêntica Jurídica — sistema de automação jurídica com IA que utiliza uma rede de 7 agentes sequenciais para gerar petições jurídicas completas. Escritório de advocacia com foco em direito bancário/civil.

## Arquitetura

```
rede-agentica-juridica/
├── backend/                    # Node.js (ESM) — API + Workflow Engine
│   ├── server.js               # Express server, rotas REST, SSE, file upload
│   ├── workflowEngine.js       # Orquestrador das 7 fases sequenciais
│   ├── vertexClient.js         # Cliente Gemini API (generateContent + embeddings)
│   ├── workflowQueue.js        # Fila de workflows (processamento sequencial)
│   ├── agents/                 # 7 agentes especializados (A1-A7)
│   │   ├── a1_coletor.js       # Coleta e organização de dados processuais
│   │   ├── a2_pipeline.js      # Classificação de intenção e conhecimento
│   │   ├── a3_conhecimento.js  # Gestão de conhecimento (RAG)
│   │   ├── a4_sintese.js       # Síntese R.O.P.A.
│   │   ├── a5_steelman.js      # Gestão de risco (Steel Man)
│   │   ├── a6_redacao.js       # Redação estratégica da petição
│   │   └── a7_revisor.js       # Revisão e validação final
│   ├── rag/                    # Sistema RAG (Retrieval-Augmented Generation)
│   │   ├── documentProcessor.js # Extração de texto (PDF worker, DOCX, OCR)
│   │   ├── _pdfExtractWorker.js # Worker isolado para PDFs (evita OOM)
│   │   ├── embeddingService.js  # Embeddings via Gemini API
│   │   ├── vectorStore.js       # Supabase pgvector
│   │   └── ragSearch.js         # Busca semântica
│   └── output/docx/            # Petições geradas em .docx
├── frontend/                   # React + TypeScript + Vite
│   ├── components/             # Componentes UI
│   ├── hooks/                  # Custom hooks (useWorkflow, useSupabase)
│   ├── types.ts                # TypeScript interfaces
│   └── constants.ts            # Constantes (WORKFLOW_STAGES, etc.)
└── package.json                # Monorepo config
```

## Stack Técnica

- **Backend**: Node.js v24+ (ESM, `"type": "module"`), Express, multer
- **Frontend**: React 18, TypeScript, Vite
- **IA**: Google Gemini API (gemini-2.5-flash para agentes, gemini-2.5-pro para redação)
- **Banco de Dados**: Supabase (PostgreSQL + pgvector para RAG)
- **PDF**: Worker isolado com pdf-parse/pdfjs-dist (evita OOM)
- **Monorepo**: Backend em `/backend`, Frontend em `/frontend`

## Como Rodar

```bash
# Backend
cd backend
node --max-old-space-size=4096 --env-file=.env.local server.js

# Frontend (terminal separado)
cd frontend
npx vite --host
```

## Variáveis de Ambiente Necessárias

| Variável | Descrição |
|----------|-----------|
| `GEMINI_API_KEY` | API Key do Google AI Studio |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Service Role Key do Supabase |
| `GOOGLE_CLOUD_PROJECT` | ID do projeto Google Cloud |
| `GOOGLE_CLOUD_LOCATION` | Região (default: `global`) |
| `API_BACKEND_PORT` | Porta do backend (default: `5000`) |

## Regras Críticas

1. **NUNCA use `--input-type=module`** em `execFileAsync` — o `package.json` já tem `"type": "module"`
2. **PDFs são processados em worker isolado** (`_pdfExtractWorker.js`) via `child_process` — NUNCA processar PDFs no processo principal
3. **Texto extraído limitado a 100K chars** e contexto IA a 30K chars
4. **Sem alucinação**: A IA deve usar APENAS dados extraídos dos documentos. Se um dado não está disponível, usar `[?]`
5. **Assinaturas fixas**: Toda petição deve ter assinatura de Ademir Olegário Marques (OAB/PR 95.461) e Pedro Eduardo Cortez Gameiro (OAB/PR 73.853)
6. **IDs sequenciais**: Petições usam padrão `ID00001`, `ID00002`, etc.
7. **NÃO fazer embedding/indexação KB durante workflow** — apenas extrair texto e injetar no contexto

## Problemas Conhecidos e Resolvidos

- **OOM em PDFs**: Resolvido com worker isolado + truncamento
- **Nomes inventados**: Causado por falha na extração de PDF (corrigido)
- **Monitoramento fake**: `StageDetailModal` tinha dados mockados (corrigido — agora usa dados reais do SSE)
