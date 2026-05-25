/**
 * _pdfExtractWorker.js — Worker isolado para extração de texto de PDF
 * 
 * Executado como processo filho para garantir liberação total de memória.
 * Uso: node _pdfExtractWorker.js <caminho_do_pdf>
 * Saída: JSON no stdout com {text, pages, error}
 */
import fs from 'fs';
import { createRequire } from 'module';
import { PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

const filePath = process.argv[2];
if (!filePath) {
  console.log(JSON.stringify({ error: 'Caminho do PDF não fornecido', text: '', pages: 0 }));
  process.exit(1);
}

// Tamanho dinâmico do chunk
function getChunkSize(totalPages) {
  if (totalPages <= 5) return totalPages;
  if (totalPages <= 20) return 5;
  if (totalPages <= 50) return 10;
  if (totalPages <= 100) return 15;
  return 20;
}

async function extractChunk(pdfBuffer) {
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

async function main() {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    
    let srcDoc;
    try {
      srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    } catch (e) {
      console.log(JSON.stringify({ error: `Erro ao carregar PDF: ${e.message}`, text: '', pages: 0 }));
      process.exit(0);
    }

    const totalPages = srcDoc.getPageCount();
    const chunkSize = getChunkSize(totalPages);
    const allTexts = [];

    for (let startPage = 0; startPage < totalPages; startPage += chunkSize) {
      const endPage = Math.min(startPage + chunkSize, totalPages);
      
      try {
        const chunkDoc = await PDFDocument.create();
        const pageIndices = Array.from({ length: endPage - startPage }, (_, i) => startPage + i);
        const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices);
        copiedPages.forEach(page => chunkDoc.addPage(page));
        const chunkBuffer = await chunkDoc.save();

        const chunkText = await extractChunk(Buffer.from(chunkBuffer));
        if (chunkText.trim()) allTexts.push(chunkText);
      } catch (chunkErr) {
        process.stderr.write(`[Worker] Chunk págs ${startPage + 1}-${endPage} erro: ${chunkErr.message}\n`);
      }
    }

    const text = allTexts.join('\n\n');
    console.log(JSON.stringify({ text, pages: totalPages, error: null }));
  } catch (err) {
    console.log(JSON.stringify({ error: err.message, text: '', pages: 0 }));
  }
}

main().then(() => process.exit(0));
