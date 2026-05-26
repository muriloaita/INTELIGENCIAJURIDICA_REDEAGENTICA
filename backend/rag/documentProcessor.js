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
import { fromPath } from 'pdf2pic';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument } from 'pdf-lib';
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const mammoth = require('mammoth');

const TESSERACT_LANG = 'por+eng'; // Fallback to english if portuguese characters aren't sufficient
const DPI_SCAN = 300;
const LIMITE_CHARS = 50;
const TESSERACT_PATHS = [
  'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
  'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
  path.join(os.homedir(), 'AppData', 'Local', 'Tesseract-OCR', 'tesseract.exe'),
  '/usr/bin/tesseract',
  '/usr/local/bin/tesseract',
];



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

async function performOcrOnPdf(filePath) {
  const tess = await findTesseract();
  if (!tess) return '';

  let directOcrText = '';
  let directOcrSuccess = false;

  try {
    // Attempt direct PDF reading first (works if compiled with poppler/leptonica)
    const { stdout: ocrOut } = await execFileAsync(tess, [filePath, 'stdout', '-l', TESSERACT_LANG, '--psm', '6', '--dpi', String(DPI_SCAN)], { timeout: 120000, maxBuffer: 20*1024*1024 });
    directOcrText = cleanText(ocrOut);
    if (directOcrText.length > LIMITE_CHARS) {
        directOcrSuccess = true;
    }
  } catch (err) {
      console.warn(`[OCR] Tesseract direct PDF read failed: ${err.message}. Triggering Ghostscript fallback.`);
  }

  if (directOcrSuccess) return directOcrText;

  // Fallback: convert PDF to image and OCR
  try {
    const fileId = uuidv4();
    const options = {
      density: DPI_SCAN,
      saveFilename: `ocr_temp_${fileId}`,
      savePath: os.tmpdir(),
      format: "png",
      width: 2480,
      height: 3508
    };
    const storeAsImage = fromPath(filePath, options);
    let combinedText = '';

    // Determine actual page count via pdf-lib if possible
    let totalPages = 10; // Default limit if we can't determine
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const doc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
        totalPages = doc.getPageCount();
    } catch (e) {
        console.warn(`[OCR] Could not determine PDF page count for OCR, defaulting to ${totalPages} max.`);
    }

    // Convert ALL pages for complete extraction (required for legal documents)
    for (let i = 1; i <= totalPages; i++) {
      try {
        const result = await storeAsImage(i);
        const imgPath = result.path;
        const { stdout: pageOcr } = await execFileAsync(tess, [imgPath, 'stdout', '-l', TESSERACT_LANG, '--psm', '6'], { timeout: 60000, maxBuffer: 10*1024*1024 });
        combinedText += pageOcr + '\n';
        fs.unlinkSync(imgPath); // Cleanup
      } catch (e) {
        // Stop if page doesn't exist
        break;
      }
    }

    // Fallback to what we got if image conversion is worse
    const finalConvertedText = cleanText(combinedText);
    return finalConvertedText.length > directOcrText.length ? finalConvertedText : directOcrText;
  } catch (pdf2picErr) {
    console.error(`[OCR] PDF to Image fallback failed completely: ${pdf2picErr.message}`);
  }

  return directOcrText; // Return whatever we have
}

// ══════════════════════════════════════════════════════════════
//  EXTRAÇÃO DE TEXTO — PDF (via processo filho isolado)
//  Cada PDF roda em subprocess separado → memória 100% liberada
// ══════════════════════════════════════════════════════════════

const PDF_WORKER_PATH = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '_pdfExtractWorker.js');

/**
 * Extrai texto de um PDF em processo filho isolado.
 * Previne acúmulo de memória do pdfjs-dist entre múltiplos PDFs.
 */
export async function extractTextFromPDF(filePath) {
  const fileName = path.basename(filePath);
  try {
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`[PDF] ${fileName}: ${fileSizeMB.toFixed(1)}MB → processando em worker isolado...`);

    // Executar worker em processo filho com memória limitada a 1GB
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['--max-old-space-size=1024', PDF_WORKER_PATH, filePath],
      { timeout: 180000, maxBuffer: 50 * 1024 * 1024 }
    );

    if (stderr) console.warn(`[PDF]   Worker stderr: ${stderr.trim()}`);

    // Parsear resultado JSON do worker
    let result;
    try {
      result = JSON.parse(stdout.trim());
    } catch {
      console.error(`[PDF]   Worker output inválido para ${fileName}`);
      return '';
    }

    if (result.error) {
      console.warn(`[PDF]   Worker erro: ${result.error}`);
      // Fallback: tentar OCR direto
      return await performOcrOnPdf(filePath);
    }

    let finalText = cleanText(result.text || '');

    // Limitar texto a 100K caracteres para evitar OOM no processamento posterior
    const MAX_TEXT_LENGTH = 100000;
    if (finalText.length > MAX_TEXT_LENGTH) {
      console.log(`[PDF]   Texto truncado: ${finalText.length} → ${MAX_TEXT_LENGTH} caracteres (limite de segurança)`);
      finalText = finalText.substring(0, MAX_TEXT_LENGTH);
    }

    console.log(`[PDF] ${fileName}: ${result.pages} páginas → ${finalText.length} caracteres extraídos ✓`);

    // Se pouco texto digital → OCR fallback
    if (finalText.length < LIMITE_CHARS) {
      console.log(`[PDF]   Pouco texto (${finalText.length} chars). Tentando OCR...`);
      const ocrText = await performOcrOnPdf(filePath);
      if (ocrText.length > finalText.length) finalText = ocrText;
    }

    return finalText;
  } catch (err) {
    console.error(`[PDF] Erro em ${fileName}: ${err.message}`);
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
