/**
 * DocxGenerator — Converte o texto da petição em um arquivo .docx formatado
 * Segue o padrão de formatação jurídica do escritório Marques & Gameiro
 *
 * Padrão: A4, Arial 12, justificado, espaçamento 1.5, recuo 2.5cm
 */
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  convertMillimetersToTwip, LineRuleType,
} from 'docx';

// Constantes de formatação
const FONT = 'Arial';
const FONT_SIZE = 24; // docx usa half-points (24 = 12pt)
const FONT_SIZE_SMALL = 20; // 10pt para citações e rodapé
const FONT_SIZE_SIGNATURE = 48; // 24pt para nome cursivo
const LINE_SPACING = 360; // 1.5 lines (240 * 1.5)
const FIRST_LINE_INDENT = convertMillimetersToTwip(25); // 2.5cm
const CITATION_INDENT = convertMillimetersToTwip(40); // 4.0cm

/**
 * Converte o texto plano/markdown da petição em um Document docx
 * @param {string} text - Texto da petição gerado pelo A6
 * @param {object} metadata - { autos, tipoPeticao, demanda }
 * @returns {Promise<Buffer>} - Buffer do arquivo .docx pronto
 */
export async function generateDocx(text, metadata = {}) {
  const lines = text.split('\n');
  const paragraphs = [];

  let isCitation = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Pular linhas completamente vazias — adicionar espaço
    if (line === '') {
      paragraphs.push(createEmptyParagraph());
      continue;
    }

    // Detectar cabeçalhos de seção (tudo em CAIXA ALTA ou com ## markdown)
    if (isSectionHeading(line)) {
      const cleanText = line.replace(/^#+\s*/, '').replace(/\*\*/g, '');
      paragraphs.push(createSectionHeading(cleanText));
      continue;
    }

    // Detectar início/fim de bloco de citação (> ou recuo 4cm)
    if (line.startsWith('>') || line.startsWith('    >')) {
      const citationText = line.replace(/^>\s*/, '').replace(/^\s*>\s*/, '');
      paragraphs.push(createCitationParagraph(citationText));
      continue;
    }

    // Detectar endereçamento (primeiras linhas, CAIXA ALTA, sem recuo)
    if (i < 10 && isUpperCase(line) && !line.startsWith('**')) {
      paragraphs.push(createAddressingParagraph(line));
      continue;
    }

    // Detectar "AUTOS Nº" ou "Processo nº"
    if (line.match(/^(AUTOS|PROCESSO|Autos|Processo)\s*(N[ºo°]|nº)/i)) {
      paragraphs.push(createAutosParagraph(line));
      continue;
    }

    // Detectar fechamento ("Termos em que," / "Pede deferimento.")
    if (line.match(/^(Termos em que|Pede deferimento|Nestes termos)/i)) {
      paragraphs.push(createClosingParagraph(line));
      continue;
    }

    // Detectar linha de local/data
    if (line.match(/datado e assinado eletronicamente/i) || line.match(/^\w+,\s*\d{1,2}\s*de\s*\w+\s*de\s*\d{4}/)) {
      paragraphs.push(createDateParagraph(line));
      continue;
    }

    // Detectar assinatura (nome dos advogados)
    if (line.match(/^(Ademir|Pedro Eduardo|ADEMIR|PEDRO)/i) || line.match(/OAB\/(PR|SP|RJ|MG)/i) || line.match(/^Advogado/i)) {
      if (line.match(/OAB/i) || line.match(/^Advogado/i)) {
        paragraphs.push(createOABParagraph(line));
      } else {
        paragraphs.push(createSignatureParagraph(line));
      }
      continue;
    }

    // Detectar bullet points
    if (line.match(/^[-•]\s/) || line.match(/^[a-z]\)\s/i) || line.match(/^\d+[.)]\s/)) {
      paragraphs.push(createBulletParagraph(line));
      continue;
    }

    // Parágrafo normal do corpo
    paragraphs.push(createBodyParagraph(line));
  }

  // Criar o documento
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: convertMillimetersToTwip(210),  // A4 largura
            height: convertMillimetersToTwip(297),  // A4 altura
          },
          margin: {
            top: convertMillimetersToTwip(30),      // 3.0 cm
            bottom: convertMillimetersToTwip(20),    // 2.0 cm
            left: convertMillimetersToTwip(30),      // 3.0 cm
            right: convertMillimetersToTwip(20),     // 2.0 cm
          },
        },
      },
      children: paragraphs,
    }],
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: FONT_SIZE,
            color: '000000',
          },
          paragraph: {
            spacing: {
              line: LINE_SPACING,
              lineRule: LineRuleType.AUTO,
              before: 0,
              after: 0,
            },
            alignment: AlignmentType.JUSTIFIED,
          },
        },
      },
    },
  });

  // Gerar buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

// ─── Funções auxiliares de criação de parágrafos ───────────────────────

function createEmptyParagraph() {
  return new Paragraph({
    spacing: { line: LINE_SPACING, before: 0, after: 0 },
    children: [],
  });
}

function createSectionHeading(text) {
  return new Paragraph({
    spacing: { line: LINE_SPACING, before: 120, after: 120 },
    alignment: AlignmentType.JUSTIFIED,
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        font: FONT,
        size: FONT_SIZE,
      }),
    ],
  });
}

function createAddressingParagraph(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE_SPACING, before: 0, after: 0 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: FONT,
        size: FONT_SIZE,
        bold: true,
      }),
    ],
  });
}

function createAutosParagraph(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE_SPACING, before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: FONT_SIZE,
        bold: true,
      }),
    ],
  });
}

function createCitationParagraph(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: CITATION_INDENT },
    spacing: { line: 240, before: 60, after: 60 }, // Espaçamento simples
    children: parseInlineFormatting(text, FONT_SIZE_SMALL),
  });
}

function createClosingParagraph(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { firstLine: FIRST_LINE_INDENT },
    spacing: { line: LINE_SPACING, before: 120, after: 0 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: FONT_SIZE,
      }),
    ],
  });
}

function createDateParagraph(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: LINE_SPACING, before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: FONT_SIZE,
        italics: true,
      }),
    ],
  });
}

function createSignatureParagraph(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: LINE_SPACING, before: 360, after: 0 },
    children: [
      new TextRun({
        text,
        font: 'Brush Script MT',
        size: FONT_SIZE_SIGNATURE,
        color: '000000',
      }),
    ],
  });
}

function createOABParagraph(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: LINE_SPACING, before: 0, after: 0 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: FONT,
        size: FONT_SIZE_SMALL,
      }),
    ],
  });
}

function createBulletParagraph(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: FIRST_LINE_INDENT },
    spacing: { line: LINE_SPACING, before: 0, after: 0 },
    children: parseInlineFormatting(text, FONT_SIZE),
  });
}

function createBodyParagraph(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: FIRST_LINE_INDENT },
    spacing: { line: LINE_SPACING, before: 0, after: 0 },
    children: parseInlineFormatting(text, FONT_SIZE),
  });
}

// ─── Detectores ───────────────────────────────────────────────────────

function isSectionHeading(line) {
  // Markdown heading
  if (line.match(/^#{1,3}\s/)) return true;
  // Tudo em CAIXA ALTA com pelo menos 3 palavras (ex: "DOS FATOS E FUNDAMENTOS")
  const clean = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
  if (clean.length > 5 && clean === clean.toUpperCase() && clean.match(/[A-ZÀ-Ú]/) && !clean.match(/^\d/) && !clean.match(/^(OAB|CPF|CNPJ|CEP|RG)/)) {
    // Verificar se não é endereçamento (que tem "JUÍZO", "VARA", "COMARCA")
    if (clean.match(/^(I{1,3}V?|V?I{0,3})\s*[-.–]\s*/)) return true; // Numeração romana
    if (clean.match(/^(D[OA]S?\s|PRELIMINAR|DO MÉRITO|DOS PEDIDOS|DA TEMPEST|DO CABIMENTO|DAS RAZÕES|DO DIREITO|DOS FATOS|DA JURIS)/)) return true;
  }
  return false;
}

function isUpperCase(text) {
  const clean = text.replace(/[^a-zA-ZÀ-ú]/g, '');
  return clean.length > 3 && clean === clean.toUpperCase();
}

/**
 * Converte formatação inline (negrito **texto**) em TextRuns
 */
function parseInlineFormatting(text, fontSize) {
  const runs = [];
  // Regex para capturar **negrito**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({
        text: part.slice(2, -2),
        bold: true,
        font: FONT,
        size: fontSize,
      }));
    } else if (part.length > 0) {
      runs.push(new TextRun({
        text: part,
        font: FONT,
        size: fontSize,
      }));
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text, font: FONT, size: fontSize })];
}
