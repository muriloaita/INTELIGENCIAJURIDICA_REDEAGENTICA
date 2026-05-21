import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const mod = require('pdf-parse');
const PDFParse = mod.PDFParse;

const base = 'C:\\Users\\Cliente\\Documents\\Minhas fontes de dados\\DB MG';
function findPdf(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { const r = findPdf(full); if (r) return r; }
    else if (entry.name.endsWith('.pdf')) return full;
  }
  return null;
}

const pdfPath = findPdf(base);
console.log('PDF:', pdfPath);
const buffer = fs.readFileSync(pdfPath);
const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

const parser = new PDFParse(uint8);
await parser.load();
const result = await parser.getText();
const text = typeof result === 'string' ? result : (result?.text || '');
console.log('SUCCESS! Text length:', text.length);
console.log('Preview:', text.substring(0, 500));
