/**
 * DocumentProcessor - Processamento de documentos jurídicos
 * Extração de texto (PDF, DOCX), chunking e inferência de categoria
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse || pdfParseModule.default || pdfParseModule;
const mammoth = require('mammoth');

/**
 * Extrai texto de um arquivo PDF
 * @param {string} filePath - Caminho do arquivo PDF
 * @returns {Promise<string>} - Texto extraído
 */
export async function extractTextFromPDF(filePath) {
  const buffer = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  try {
    const parser = new PDFParse(uint8);
    await parser.load();
    const result = await parser.getText();
    // result pode ser string ou objeto com .text
    const text = typeof result === 'string' ? result : (result?.text || '');
    return text;
  } catch (err) {
    console.error('[DocumentProcessor] Erro ao extrair PDF:', err.message);
    return '';
  }
}

/**
 * Extrai texto de um arquivo DOCX
 * @param {string} filePath - Caminho do arquivo DOCX
 * @returns {Promise<string>} - Texto extraído
 */
export async function extractTextFromDOCX(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
}

/**
 * Extrai texto de um arquivo com base na extensão
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<string|null>} - Texto extraído ou null se formato não suportado
 */
export async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return extractTextFromPDF(filePath);
    case '.docx':
      return extractTextFromDOCX(filePath);
    case '.txt':
      return fs.readFileSync(filePath, 'utf-8');
    case '.xlsx':
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.mp4':
    case '.zip':
    case '.rar':
      return null;
    default:
      return null;
  }
}

/**
 * Divide texto em chunks por palavras com overlap
 * @param {string} text - Texto para dividir
 * @param {number} chunkSize - Número de palavras por chunk (padrão: 800)
 * @param {number} overlap - Número de palavras de sobreposição (padrão: 200)
 * @returns {string[]} - Array de chunks
 */
export function chunkText(text, chunkSize = 800, overlap = 200) {
  if (!text || text.trim().length === 0) return [];

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(' ');
    chunks.push(chunk);

    if (end >= words.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Infere a categoria jurídica a partir do caminho do arquivo
 * @param {string} filePath - Caminho do arquivo
 * @returns {string} - Categoria inferida
 */
export function inferCategoria(filePath) {
  const normalizado = filePath.toLowerCase();

  const categorias = [
    { pattern: 'embargos de declara', categoria: 'embargos_declaracao' },
    { pattern: 'recurso de apela', categoria: 'recurso_apelacao' },
    { pattern: 'agravo de instrumento', categoria: 'agravo_instrumento' },
    { pattern: 'impugna', categoria: 'impugnacao' },
    { pattern: 'contrarraz', categoria: 'contrarrazoes' },
    { pattern: 'manifesta', categoria: 'manifestacao' },
    { pattern: 'quesitos', categoria: 'quesitos' },
    { pattern: 'peti\u00e7\u00e3o inicial', categoria: 'peticao_inicial' },
    { pattern: 'peticao inicial', categoria: 'peticao_inicial' },
    { pattern: 'inicial', categoria: 'peticao_inicial' },
    { pattern: 'modelo', categoria: 'modelo' },
    { pattern: 'recurso especial', categoria: 'recurso_especial' },
    { pattern: 'recurso extraordin', categoria: 'recurso_extraordinario' },
    { pattern: 'a\u00e7\u00e3o rescis', categoria: 'acao_rescisoria' },
    { pattern: 'mandado de seguran', categoria: 'mandado_seguranca' },
    { pattern: 'habeas corpus', categoria: 'habeas_corpus' },
    { pattern: 'execu\u00e7\u00e3o', categoria: 'execucao' },
    { pattern: 'cumprimento de senten', categoria: 'cumprimento_sentenca' },
    { pattern: 'contesta\u00e7\u00e3o', categoria: 'contestacao' },
    { pattern: 'r\u00e9plica', categoria: 'replica' },
    { pattern: 'alega\u00e7\u00f5es finais', categoria: 'alegacoes_finais' },
    { pattern: 'parecer', categoria: 'parecer' },
    { pattern: 'memorial', categoria: 'memorial' },
    { pattern: 'embargo', categoria: 'embargos' },
    { pattern: 'apela\u00e7\u00e3o', categoria: 'apelacao' },
    { pattern: 'agravo', categoria: 'agravo' },
  ];

  for (const { pattern, categoria } of categorias) {
    if (normalizado.includes(pattern)) {
      return categoria;
    }
  }

  return 'geral';
}

/**
 * Processa um documento completo: extrai texto, divide em chunks e retorna metadados
 * @param {string} filePath - Caminho do arquivo
 * @param {string|null} categoria - Categoria (se null, infere automaticamente)
 * @param {string} fonte - Fonte do documento
 * @returns {Promise<object[]|null>} - Array de objetos chunk ou null se não processável
 */
export async function processDocument(filePath, categoria = null, fonte = 'upload') {
  const text = await extractTextFromFile(filePath);
  if (!text || text.trim().length === 0) return null;

  const cat = categoria || inferCategoria(filePath);
  const fileName = path.basename(filePath);
  const chunks = chunkText(text);

  return chunks.map((conteudo, index) => ({
    titulo: `${fileName} — Parte ${index + 1}/${chunks.length}`,
    conteudo,
    chunk_index: index,
    total_chunks: chunks.length,
    documento_origem: fileName,
    categoria: cat,
    fonte,
    metadata: {
      file_path: filePath,
      file_size: fs.statSync(filePath).size,
      extracted_at: new Date().toISOString(),
    },
  }));
}
