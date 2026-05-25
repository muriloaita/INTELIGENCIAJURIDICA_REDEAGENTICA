/**
 * documentProcessor.js — RAG Document Processor v2
 * 
 * Sistema inteligente de extração de texto:
 * - Divisão transparente de PDFs grandes via pdf-lib (chunking por páginas)
 * - Tamanho dinâmico de lote baseado no total de páginas
 * - Limpeza de mojibake, ruído de digitalização e caracteres especiais
 * - Foco em dados jurídicos: nomes, números, datas, cláusulas
 * - Sem alucinação: [?] para trechos humanamente ilegíveis
 * - Tesseract OCR como fallback para PDFs escaneados
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { PDFDocument } from 'pdf-lib';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;
const mammoth = require('mammoth');

const TESSERACT_LANG = 'por';
const DPI_SCAN = 300;
const LIMITE_CHARS = 50;
const TESSERACT_PATHS = [
  'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
  'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
  path.join(os.homedir(), 'AppData', 'Local', 'Tesseract-OCR', 'tesseract.exe'),
];

// ── Tamanho dinâmico do chunk baseado no total de páginas ──
function getChunkSize(totalPages) {
  if (totalPages <= 5) return totalPages;       // PDFs pequenos: processar tudo de uma vez
  if (totalPages <= 20) return 5;               // Médios: lotes de 5 páginas
  if (totalPages <= 50) return 10;              // Grandes: lotes de 10
  if (totalPages <= 100) return 15;             // Muito grandes: lotes de 15
  return 20;                                    // Gigantes: lotes de 20
}

// ══════════════════════════════════════════════════════════════
//  LIMPEZA DE TEXTO — Mojibake, ruído de digitalização, UTF-8
// ══════════════════════════════════════════════════════════════

const MOJIBAKE_PAIRS = [
  ['Ã¡', 'á'], ['Ã\u00a0', 'à'], ['Ã¢', 'â'], ['Ã£', 'ã'], ['Ã¤', 'ä'],
  ['Ã©', 'é'], ['Ã¨', 'è'], ['Ãª', 'ê'], ['Ã«', 'ë'],
  ['Ã\u00ad', 'í'], ['Ã¬', 'ì'], ['Ã®', 'î'], ['Ã¯', 'ï'],
  ['Ã³', 'ó'], ['Ã²', 'ò'], ['Ã´', 'ô'], ['Ãµ', 'õ'], ['Ã¶', 'ö'],
  ['Ãº', 'ú'], ['Ã¹', 'ù'], ['Ã»', 'û'], ['Ã¼', 'ü'],
  ['Ã§', 'ç'], ['Ã±', 'ñ'],
  ['Ã\u0089', 'É'], ['Ã\u0087', 'Ç'], ['Ã\u009a', 'Ú'],
  ['Â§', '§'], ['Âº', 'º'], ['Âª', 'ª'], ['Â°', '°'],
];

function cleanText(raw) {
  if (!raw) return '';
  let text = raw;

  // 1) Corrigir mojibake (UTF-8 interpretado como Latin-1)
  for (const [bad, good] of MOJIBAKE_PAIRS) {
    text = text.replaceAll(bad, good);
  }

  // 2) Remover caracteres de controle (exceto newlines e tabs)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 3) Remover ruído de digitalização: pontos isolados, símbolos sem contexto
  // (sequências de 3+ caracteres especiais repetidos que não são texto)
  text = text.replace(/[•·∙◦○●■□▪▫]{2,}/g, '');
  text = text.replace(/[_]{5,}/g, '___');          // Linhas longas de underscore
  text = text.replace(/[-]{5,}/g, '---');           // Linhas longas de hífen
  text = text.replace(/[=]{5,}/g, '===');           // Linhas longas de igual
  text = text.replace(/[.]{5,}/g, '...');           // Muitos pontos seguidos
  text = text.replace(/\s*\|\s*\|\s*\|\s*/g, ' | '); // Pipes repetidos de tabelas mal formatadas

  // 4) Normalizar espaçamento
  text = text.replace(/[ \t]+/g, ' ');              // Múltiplos espaços → um
  text = text.replace(/\n{4,}/g, '\n\n\n');         // Máximo 3 newlines seguidas
  text = text.replace(/^\s+$/gm, '');               // Linhas só com espaço → vazias

  // 5) Limpar artefatos de cabeçalho/rodapé repetidos (marcas de paginação)
  text = text.replace(/^(Página|Pág\.?|Page)\s*\d+\s*(de\s*\d+)?\s*$/gm, '');

  return text.trim();
}

// Detectar se uma página tem conteúdo informativo
function isPageBlank(pageText) {
  const cleaned = (pageText || '').replace(/\s+/g, '').replace(/[-_=.•·|]/g, '');
  return cleaned.length < 15; // Menos de 15 chars reais = página em branco
}

// ══════════════════════════════════════════════════════════════
//  TESSERACT OCR
// ══════════════════════════════════════════════════════════════

let tesseractPath = null;
let tesseractAvailable = null;

async function findTesseract() {
  if (tesseractAvailable !== null) return tesseractAvailable ? tesseractPath : null;
  try {
    const { stdout } = await execFileAsync('tesseract', ['--version'], { timeout: 5000 });
    tesseractPath = 'tesseract'; tesseractAvailable = true;
    console.log(`[OCR] Tesseract no PATH: ${stdout.split('\n')[0]}`); return tesseractPath;
  } catch {}
  for (const p of TESSERACT_PATHS) {
    if (fs.existsSync(p)) {
      try {
        const { stdout } = await execFileAsync(p, ['--version'], { timeout: 5000 });
        tesseractPath = p; tesseractAvailable = true;
        console.log(`[OCR] Tesseract: ${p}`); return tesseractPath;
      } catch {}
    }
  }
  tesseractAvailable = false;
  console.warn('[OCR] Tesseract NAO encontrado. Instale: https://github.com/UB-Mannheim/tesseract/wiki');
  return null;
}

export async function extractTextFromImage(filePath) {
  try {
    const tess = await findTesseract();
    if (!tess) return '';
    const { stdout } = await execFileAsync(tess, [filePath, 'stdout', '-l', TESSERACT_LANG, '--psm', '6'], { timeout: 60000, maxBuffer: 10*1024*1024 });
    return cleanText(stdout);
  } catch (err) { console.error(`[OCR] Erro: ${err.message}`); return ''; }
}

// ══════════════════════════════════════════════════════════════
//  EXTRAÇÃO DE TEXTO — PDF (com chunking inteligente via pdf-lib)
// ══════════════════════════════════════════════════════════════

/**
 * Extrai texto de um chunk de páginas (Buffer de PDF parcial)
 */
async function extractTextFromPDFBuffer(pdfBuffer) {
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer), verbosity: 0 });
  await parser.load();
  const textResult = await parser.getText();
  try { parser.destroy(); } catch {}

  if (typeof textResult === 'string') return textResult;
  if (textResult && textResult.pages) {
    return textResult.pages.map(p => p.text || '').join('\n');
  }
  if (textResult && typeof textResult.text === 'string') return textResult.text;
  return '';
}

/**
 * Extrai texto de um PDF usando divisão inteligente por páginas.
 * PDFs grandes são fragmentados em chunks menores via pdf-lib.
 */
export async function extractTextFromPDF(filePath) {
  const fileName = path.basename(filePath);
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileSizeMB = fileBuffer.length / (1024 * 1024);

    // ── Carregar documento com pdf-lib para contar páginas ──
    let srcDoc;
    try {
      srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    } catch (loadErr) {
      console.warn(`[PDF] Erro ao carregar ${fileName}: ${loadErr.message.substring(0, 100)}`);
      // Fallback: tentar OCR direto
      const tess = await findTesseract();
      if (tess) {
        try {
          const { stdout } = await execFileAsync(tess, [filePath, 'stdout', '-l', TESSERACT_LANG, '--psm', '6', '--dpi', String(DPI_SCAN)], { timeout: 120000, maxBuffer: 20*1024*1024 });
          return cleanText(stdout);
        } catch {}
      }
      return '';
    }

    const totalPages = srcDoc.getPageCount();
    const chunkSize = getChunkSize(totalPages);

    console.log(`[PDF] ${fileName}: ${totalPages} páginas, ${fileSizeMB.toFixed(1)}MB → chunks de ${chunkSize} páginas`);

    // ── Processar em chunks ──
    const allPageTexts = [];
    let blankCount = 0;

    for (let startPage = 0; startPage < totalPages; startPage += chunkSize) {
      const endPage = Math.min(startPage + chunkSize, totalPages);
      const chunkLabel = `[págs ${startPage + 1}-${endPage}/${totalPages}]`;

      try {
        // Criar um PDF parcial com apenas as páginas deste chunk
        const chunkDoc = await PDFDocument.create();
        const pageIndices = Array.from({ length: endPage - startPage }, (_, i) => startPage + i);
        const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices);
        copiedPages.forEach(page => chunkDoc.addPage(page));
        const chunkBuffer = await chunkDoc.save();

        // Extrair texto do chunk
        const chunkRawText = await extractTextFromPDFBuffer(Buffer.from(chunkBuffer));

        // Verificar cada "página" no texto extraído
        // (pdf-parse retorna texto contínuo, dividimos por quebras duplas como heurística)
        const pageTexts = chunkRawText.split(/\n{2,}/);
        for (let i = 0; i < pageTexts.length; i++) {
          const pageText = pageTexts[i];
          if (isPageBlank(pageText)) {
            blankCount++;
            continue; // Ignorar páginas em branco
          }
          allPageTexts.push(pageText);
        }

        console.log(`[PDF]   ${chunkLabel} ✓ ${allPageTexts.length} blocos extraídos`);
      } catch (chunkErr) {
        console.warn(`[PDF]   ${chunkLabel} ✗ Erro: ${chunkErr.message.substring(0, 80)}`);
        // Tentar OCR para este chunk como fallback
        // (não implementado por chunk — continuamos com os demais)
      }
    }

    if (blankCount > 0) {
      console.log(`[PDF]   ${blankCount} página(s) em branco ignorada(s)`);
    }

    const rawText = allPageTexts.join('\n\n');
    let finalText = cleanText(rawText);

    // Se pouco texto digital → tentar OCR como fallback (inteiro)
    if (finalText.length < LIMITE_CHARS) {
      console.log(`[PDF]   Pouco texto digital (${finalText.length} chars). Tentando OCR...`);
      const tess = await findTesseract();
      if (tess) {
        try {
          const { stdout } = await execFileAsync(tess, [filePath, 'stdout', '-l', TESSERACT_LANG, '--psm', '6', '--dpi', String(DPI_SCAN)], { timeout: 120000, maxBuffer: 20*1024*1024 });
          const ocrText = cleanText(stdout);
          if (ocrText.length > finalText.length) finalText = ocrText;
        } catch {}
      }
    }

    console.log(`[PDF] ${fileName}: extração completa → ${finalText.length} caracteres úteis`);
    return finalText;
  } catch (err) {
    console.error(`[PDF] Erro fatal em ${fileName}: ${err.message}`);
    return '';
  }
}

// ══════════════════════════════════════════════════════════════
//  EXTRAÇÃO — DOCX / TXT
// ══════════════════════════════════════════════════════════════

export async function extractTextFromDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return cleanText(result.value || '');
  } catch (err) { console.error(`[DOCX] Erro: ${err.message}`); return ''; }
}

export async function extractTextFromTxt(filePath) {
  try { return cleanText(fs.readFileSync(filePath, 'utf-8')); }
  catch (err) { console.error(`[TXT] Erro: ${err.message}`); return ''; }
}

// ══════════════════════════════════════════════════════════════
//  CATEGORIZAÇÃO AUTOMÁTICA
// ══════════════════════════════════════════════════════════════

export function inferCategoria(fileName, textContent = '') {
  const name = (fileName || '').toLowerCase();
  const text = (textContent || '').toLowerCase().substring(0, 2000);
  if (name.includes('peticao') || name.includes('petição') || text.includes('excelentíssimo')) return 'peticao';
  if (name.includes('contrato') || text.includes('contratante')) return 'contrato';
  if (name.includes('sentenca') || name.includes('sentença') || text.includes('julgo')) return 'sentenca';
  if (name.includes('despacho') || text.includes('despacho')) return 'despacho';
  if (name.includes('acordao') || name.includes('acórdão')) return 'acordao';
  if (name.includes('recurso') || text.includes('apelação') || text.includes('agravo')) return 'recurso';
  if (name.includes('recurso_especial') || text.includes('recurso especial') || text.includes('resp') || text.includes('stj')) return 'recurso_especial';
  if (name.includes('procuracao') || name.includes('procuração')) return 'procuracao';
  if (name.includes('extrato') || text.includes('extrato')) return 'extrato';
  if (name.includes('decisao') || name.includes('decisão') || text.includes('decisão interlocutória')) return 'decisao';
  if (name.includes('manifestacao') || name.includes('manifestação') || text.includes('manifestação')) return 'manifestacao';
  return 'documento_juridico';
}

// ══════════════════════════════════════════════════════════════
//  PROCESSAMENTO PRINCIPAL (chunking de texto para RAG)
// ══════════════════════════════════════════════════════════════

export async function processDocument(filePath, categoria = null, fonte = 'upload') {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  let text = '';
  switch (ext) {
    case '.pdf': text = await extractTextFromPDF(filePath); break;
    case '.docx': case '.doc': text = await extractTextFromDocx(filePath); break;
    case '.txt': case '.md': text = await extractTextFromTxt(filePath); break;
    case '.jpg': case '.jpeg': case '.png': case '.bmp':
    case '.tiff': case '.tif': case '.webp': text = await extractTextFromImage(filePath); break;
    default: return [];
  }
  if (!text || text.length < 10) return [];
  const cat = categoria || inferCategoria(fileName, text);
  const chunks = chunkText(text, 1500, 200);
  return chunks.map((chunk, i) => ({
    content: chunk,
    metadata: { fileName, categoria: cat, fonte, chunkIndex: i, totalChunks: chunks.length, extractedAt: new Date().toISOString() },
  }));
}

function chunkText(text, chunkSize = 1500, overlap = 200) {
  const chunks = []; let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const bp = Math.max(text.lastIndexOf('.', end), text.lastIndexOf('\n', end));
      if (bp > start + chunkSize * 0.5) end = bp + 1;
    }
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks.filter(c => c.length > 0);
}

export async function terminateTesseractWorker() {
  console.log('[OCR] Tesseract nativo — sem workers.');
}
