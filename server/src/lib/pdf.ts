/**
 * Générateur PDF minimaliste, sans dépendance externe.
 *
 * Il produit des documents texte A4 avec les polices standard Helvetica /
 * Helvetica-Bold. Les caractères sont encodés en Latin-1 (WinAnsi) : les
 * accents français sont conservés, les caractères typographiques exotiques
 * sont translittérés pour rester lisibles.
 */

export interface TextOptions {
  size?: number;
  bold?: boolean;
  color?: string;
  lineHeight?: number;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

function sanitize(value: string): string {
  return value
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u202F\u2007\u2009\u200A]/g, ' ')
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'OE')
    .replace(/\u00E6/g, 'ae')
    .replace(/\u00C6/g, 'AE')
    .replace(/[^\x20-\xFF\n]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(value: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        if (word.length > maxChars) {
          let rest = word;
          while (rest.length > maxChars) {
            lines.push(rest.slice(0, maxChars));
            rest = rest.slice(maxChars);
          }
          current = rest;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [''];
}

export class TextPdf {
  private readonly pages: string[][] = [[]];
  private pageIndex = 0;
  private cursorY = PAGE_HEIGHT - MARGIN;

  get y(): number {
    return this.cursorY;
  }

  set y(value: number) {
    this.cursorY = value;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  get contentWidth(): number {
    return PAGE_WIDTH - MARGIN * 2;
  }

  get left(): number {
    return MARGIN;
  }

  get right(): number {
    return PAGE_WIDTH - MARGIN;
  }

  newPage(): void {
    this.pages.push([]);
    this.pageIndex += 1;
    this.cursorY = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(needed: number): boolean {
    if (this.cursorY - needed < MARGIN) {
      this.newPage();
      return true;
    }
    return false;
  }

  text(value: string, x: number, y: number, options: TextOptions = {}): void {
    const size = options.size ?? 10;
    const font = options.bold ? 'F2' : 'F1';
    const color = options.color ?? '0.1 0.1 0.1';
    const escaped = sanitize(value);
    this.pages[this.pageIndex]!.push(
      `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escaped}) Tj ET`,
    );
  }

  rightText(value: string, xRight: number, y: number, options: TextOptions = {}): void {
    const size = options.size ?? 10;
    const estimated = sanitize(value).length * size * 0.5;
    this.text(value, Math.max(MARGIN, xRight - estimated), y, options);
  }

  paragraph(value: string, options: TextOptions & { x?: number; width?: number } = {}): void {
    const size = options.size ?? 10;
    const lineHeight = options.lineHeight ?? Math.round(size * 1.45);
    const width = options.width ?? this.contentWidth;
    const x = options.x ?? MARGIN;
    const maxChars = Math.max(12, Math.floor(width / (size * 0.52)));
    for (const line of wrapText(value, maxChars)) {
      this.ensureSpace(lineHeight);
      this.text(line, x, this.cursorY, { ...options, size });
      this.cursorY -= lineHeight;
    }
  }

  rule(y = this.cursorY, color = '0.8 0.8 0.8'): void {
    this.pages[this.pageIndex]!.push(
      `${color} RG 0.6 w ${MARGIN} ${y.toFixed(2)} m ${(PAGE_WIDTH - MARGIN).toFixed(2)} ${y.toFixed(2)} l S`,
    );
  }

  finish(): Buffer {
    const pages = this.pages.filter((page) => page.length > 0);
    const objects: string[] = [];
    const pageObjectNumbers = pages.map((_, index) => 5 + index * 2);

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    pages.forEach((commands, index) => {
      const pageObjectNumber = 5 + index * 2;
      const contentObjectNumber = pageObjectNumber + 1;
      const stream = commands.join('\n');
      objects[pageObjectNumber] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
      objects[contentObjectNumber] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
    });

    let body = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets: number[] = [];
    for (let index = 1; index < objects.length; index += 1) {
      if (!objects[index]) continue;
      offsets[index] = Buffer.byteLength(body, 'latin1');
      body += `${index} 0 obj\n${objects[index]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(body, 'latin1');
    const size = objects.length;
    body += `xref\n0 ${size}\n`;
    body += '0000000000 65535 f \n';
    for (let index = 1; index < size; index += 1) {
      body += `${String(offsets[index] ?? 0).padStart(10, '0')} 00000 n \n`;
    }
    body += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(body, 'latin1');
  }
}
