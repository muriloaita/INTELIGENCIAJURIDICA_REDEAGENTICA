/**
 * documentProcessor.js — RAG Document Processor
 * Tesseract OCR nativo via child_process + pdf-parse + mammoth
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';

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
    return stdout.trim();
  } catch (err) { console.error(`[OCR] Erro: ${err.message}`); return ''; }
}

export async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    // pdf-parse v2: usar new PDFParse({data, verbosity}) + load() + getText()
    const parser = new PDFParse({ data: new Uint8Array(dataBuffer), verbosity: 0 });
    await parser.load();
    const digitalText = (await parser.getText() || '').trim();
    if (digitalText.length >= LIMITE_CHARS) return digitalText;
    // Pouco texto digital → tentar OCR como fallback
    const tess = await findTesseract();
    if (!tess) return digitalText;
    try {
      const { stdout } = await execFileAsync(tess, [filePath, 'stdout', '-l', TESSERACT_LANG, '--psm', '6', '--dpi', String(DPI_SCAN)], { timeout: 120000, maxBuffer: 20*1024*1024 });
      const ocrText = stdout.trim();
      if (ocrText.length > digitalText.length) return ocrText;
    } catch {}
    return digitalText;
  } catch (err) { console.error(`[PDF] Erro: ${err.message}`); return ''; }
}

export async function extractTextFromDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return (result.value || '').trim();
  } catch (err) { console.error(`[DOCX] Erro: ${err.message}`); return ''; }
}

export async function extractTextFromTxt(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8').trim(); }
  catch (err) { console.error(`[TXT] Erro: ${err.message}`); return ''; }
}

export function inferCategoria(fileName, textContent = '') {
  const name = (fileName || '').toLowerCase();
  const text = (textContent || '').toLowerCase().substring(0, 2000);
  if (name.includes('peticao') || name.includes('petição') || text.includes('excelentíssimo')) return 'peticao';
  if (name.includes('contrato') || text.includes('contratante')) return 'contrato';
  if (name.includes('sentenca') || name.includes('sentença') || text.includes('julgo')) return 'sentenca';
  if (name.includes('despacho') || text.includes('despacho')) return 'despacho';
  if (name.includes('acordao') || name.includes('acórdão')) return 'acordao';
  if (name.includes('recurso') || text.includes('apelação') || text.includes('agravo')) return 'recurso';
  if (name.includes('procuracao') || name.includes('procuração')) return 'procuracao';
  if (name.includes('extrato') || text.includes('extrato')) return 'extrato';
  return 'documento_juridico';
}

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
