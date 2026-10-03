// Fontkit’s Indic shaping engine uses this runtime for Sinhala and Tamil.
import "regenerator-runtime/runtime";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, PDFImage, PageSizes, rgb } from "pdf-lib";

const MARGIN = 32;
const FONT_FILES = ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "NotoSansSinhala-Regular.ttf", "NotoSansTamil-Regular.ttf"];
let browserFonts: Promise<void> | undefined;
const assets = new Map<string, Promise<ArrayBuffer>>();

export function loadPdfAsset(path: string): Promise<ArrayBuffer> {
  let pending = assets.get(path);
  if (!pending) {
    pending = fetch(path).then((response) => {
      if (!response.ok) throw new Error(`Could not load PDF asset ${path} (${response.status}).`);
      return response.arrayBuffer();
    }).catch((error) => {
      assets.delete(path);
      throw new Error(`Could not load PDF asset ${path}: ${error instanceof Error ? error.message : String(error)}`);
    });
    assets.set(path, pending);
  }
  return pending;
}

// Convert the existing local SVG logos to PNG for pdf-lib (which embeds PNG/JPEG).
export async function embedLogo(pdf: PDFDocument, path: string) {
  const bytes = await loadPdfAsset(path);
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 240;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.drawImage(image, 0, 0, 240, 240);
    return await pdf.embedPng(canvas.toDataURL("image/png"));
  } catch (error) {
    throw new Error(`Could not render PDF logo ${path}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Run = { text: string; font: PDFFont };
export class PdfLayout {
  page!: PDFPage;
  y = MARGIN;
  readonly margin = MARGIN;
  readonly width: number;
  readonly height: number;
  readonly contentWidth: number;
  readonly bottom: number;
  private characterSets: Set<number>[];
  private imageTasks: Promise<void>[] = [];
  private scriptImages = new Map<string, Promise<PDFImage>>();
  private scriptCanvas?: CanvasRenderingContext2D;
  header?: () => void;

  private constructor(readonly pdf: PDFDocument, private fonts: PDFFont[], landscape: boolean) {
    const [short, long] = PageSizes.A4;
    this.width = landscape ? long : short;
    this.height = landscape ? short : long;
    this.contentWidth = this.width - 2 * MARGIN;
    this.bottom = this.height - MARGIN - 20;
    if (typeof document !== "undefined") {
      this.scriptCanvas = document.createElement("canvas").getContext("2d") ?? undefined;
      if (!this.scriptCanvas) throw new Error("Canvas is unavailable for PDF text shaping.");
    }
    this.characterSets = fonts.map((font) => new Set(font.getCharacterSet()));
  }

  static async create(landscape = false) {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const bytes = await Promise.all(FONT_FILES.map((file) => loadPdfAsset(`/fonts/${file}`)));
    if (typeof document !== "undefined") {
      // Browser shaping preserves Indic mark placement, which pdf-lib's drawText
      // does not apply. Register the same bundled fonts for those text runs.
      browserFonts ??= Promise.all(bytes.map(async (data, index) => {
        const face = new FontFace(`AegirPdf${index}`, data);
        await face.load();
        document.fonts.add(face);
      })).then(() => undefined).catch((error) => {
        browserFonts = undefined;
        throw new Error(`Could not load PDF fonts: ${String(error)}`);
      });
      await browserFonts;
    }
    // Full embedding avoids subset glyph issues.
    const fonts = await Promise.all(bytes.map(async (data, index) => {
      try { return await pdf.embedFont(data); }
      catch { throw new Error(`Could not embed PDF font /fonts/${FONT_FILES[index]}. The font asset may be invalid.`); }
    }));
    return new PdfLayout(pdf, fonts, landscape);
  }

  private runs(value: string, bold: boolean): Run[] {
    const runs: Run[] = [];
    // Keep combining marks and script joiners with their base glyph for shaping.
    const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value);
    for (const { segment } of segments) {
      const codes = Array.from(segment, (char) => char.codePointAt(0)!);
      const index = [bold ? 1 : 0, 2, 3].find((i) => codes.every((code) =>
        code === 0x200c || code === 0x200d || this.characterSets[i].has(code)));
      if (index === undefined) {
        throw new Error(`PDF fonts do not support ${JSON.stringify(segment)} (${codes.map((c) => `U+${c.toString(16).toUpperCase()}`).join(", ")}). Please use a supported name or add a font for this script.`);
      }
      const font = this.fonts[index];
      const last = runs[runs.length - 1];
      if (last?.font === font) last.text += segment;
      else runs.push({ text: segment, font });
    }
    return runs;
  }

  private runWidth(run: Run, size: number) {
    const index = this.fonts.indexOf(run.font);
    if (index >= 2 && this.scriptCanvas) {
      this.scriptCanvas.font = `${size}px AegirPdf${index}`;
      return this.scriptCanvas.measureText(run.text).width;
    }
    return run.font.widthOfTextAtSize(run.text, size);
  }

  measure(value: string, size = 9, bold = false) {
    return this.runs(value, bold).reduce((sum, run) => sum + this.runWidth(run, size), 0);
  }

  wrap(value: string, width: number, size = 9, bold = false): string[] {
    if (width <= 0) throw new Error("PDF text column is too narrow.");
    const lines: string[] = [];
    for (const paragraph of value.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.measure(candidate, size, bold) <= width) { line = candidate; continue; }
        if (line) { lines.push(line); line = ""; }
        // Long words/registration numbers wrap at grapheme boundaries, never clip.
        for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)) {
          if (this.measure(segment, size, bold) > width) throw new Error(`PDF column is too narrow for ${JSON.stringify(segment)}.`);
          if (line && this.measure(line + segment, size, bold) > width) { lines.push(line); line = ""; }
          line += segment;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  text(value: string, x: number, top: number, size = 9, bold = false) {
    for (const run of this.runs(value, bold)) {
      const index = this.fonts.indexOf(run.font);
      const width = this.runWidth(run, size);
      if (index >= 2 && this.scriptCanvas) {
        // Rasterize only Indic runs using the browser's shaping engine. At 4x
        // resolution, marks and conjuncts retain print quality and correct order.
        const scale = 4;
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil((width + size) * scale);
        canvas.height = Math.ceil(size * 3 * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable for PDF text shaping.");
        context.font = `${size * scale}px AegirPdf${index}`;
        context.fillStyle = "#141414";
        context.fillText(run.text, size * scale / 2, size * scale * 1.5);
        const page = this.page;
        const imageX = x - size / 2;
        const imageY = this.height - top - size * 2.5;
        const key = `${index}:${size}:${run.text}`;
        let pendingImage = this.scriptImages.get(key);
        if (!pendingImage) {
          pendingImage = this.pdf.embedPng(canvas.toDataURL("image/png"));
          this.scriptImages.set(key, pendingImage);
        }
        this.imageTasks.push(pendingImage.then((image) => {
          page.drawImage(image, { x: imageX, y: imageY, width: canvas.width / scale, height: canvas.height / scale });
        }));
      } else {
        this.page.drawText(run.text, { x, y: this.height - top - size, size, font: run.font, color: rgb(0.08, 0.08, 0.08) });
      }
      x += width;
    }
  }

  block(value: string, x: number, top: number, width: number, size = 9, bold = false, centered = false) {
    const lines = this.wrap(value, width, size, bold);
    lines.forEach((line, i) => this.text(line, x + (centered ? (width - this.measure(line, size, bold)) / 2 : 0), top + i * size * 1.5, size, bold));
    return lines.length * size * 1.5;
  }

  line(x: number, top: number, width: number) {
    this.page.drawLine({ start: { x, y: this.height - top }, end: { x: x + width, y: this.height - top }, thickness: 0.5, color: rgb(0, 0, 0) });
  }

  rect(x: number, top: number, width: number, height: number, shaded = false) {
    this.page.drawRectangle({ x, y: this.height - top - height, width, height, borderColor: rgb(0, 0, 0), borderWidth: 0.5, ...(shaded ? { color: rgb(0.94, 0.94, 0.94) } : {}) });
  }

  newPage() {
    this.page = this.pdf.addPage([this.width, this.height]);
    this.y = MARGIN;
    this.header?.();
  }

  ensure(height: number, repeat?: () => void) {
    if (this.y + height > this.bottom) { this.newPage(); repeat?.(); }
    if (this.y + height > this.bottom) throw new Error("A PDF row is too tall to fit on one page. Please shorten the text in this row.");
  }

  rowHeight(cells: string[], widths: number[], size = 9, bold = false, minHeight = 24) {
    return Math.max(minHeight, ...cells.map((cell, i) => this.wrap(cell, widths[i] - 10, size, bold).length * size * 1.5 + 12));
  }

  row(cells: string[], widths: number[], height: number, bold = false, size = 9) {
    let x = MARGIN;
    cells.forEach((cell, i) => {
      this.rect(x, this.y, widths[i], height, bold);
      this.block(cell, x + 5, this.y + 5, widths[i] - 10, size, bold);
      x += widths[i];
    });
    this.y += height;
  }

  async save() {
    const pages = this.pdf.getPages();
    pages.forEach((page, i) => {
      this.page = page;
      this.line(MARGIN, this.height - MARGIN - 8, this.contentWidth);
      this.text(`Aegir | Page ${i + 1} of ${pages.length}`, MARGIN, this.height - MARGIN, 8);
    });
    await Promise.all(this.imageTasks);
    return this.pdf.save();
  }
}

