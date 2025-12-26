type TesseractWorker = Awaited<
  ReturnType<(typeof import('tesseract.js'))['createWorker']>
>;

type OcrProgressHandler = (progress: number) => void;
type PdfViewport = { width: number; height: number };
type PdfRenderTask = { promise: Promise<void> };
type PdfPage = {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => PdfRenderTask;
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
};

export interface FileParseOptions {
  readonly ocrLanguage?: string;
  readonly maxOcrPages?: number;
  readonly minPdfTextLength?: number;
  readonly onOcrProgress?: OcrProgressHandler;
}

const DEFAULT_OCR_LANGUAGE = 'chi_sim+eng';
const DEFAULT_MAX_OCR_PAGES = 10;
const DEFAULT_MIN_PDF_TEXT_LENGTH = 200;

let ocrWorkerPromise: Promise<TesseractWorker> | null = null;
let currentOcrLanguage: string | null = null;
let activeOcrProgressHandler: OcrProgressHandler | undefined;
let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf')> | null =
  null;
let pdfjsWorkerSrcPromise: Promise<string> | null = null;

const loadPdfJs = async () => {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf');
  }
  return pdfjsPromise;
};

const loadPdfWorkerSrc = async () => {
  if (!pdfjsWorkerSrcPromise) {
    pdfjsWorkerSrcPromise =
      import('pdfjs-dist/legacy/build/pdf.worker?url').then(mod => mod.default);
  }
  return pdfjsWorkerSrcPromise;
};

const getPdfJs = async () => {
  const pdfjsLib = await loadPdfJs();
  const workerSrc = await loadPdfWorkerSrc();
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  return pdfjsLib;
};

const getOcrWorker = async (
  language: string,
  onOcrProgress?: OcrProgressHandler
) => {
  activeOcrProgressHandler = onOcrProgress;
  if (!ocrWorkerPromise) {
    const { createWorker } =
      (await import('tesseract.js/dist/tesseract.esm.min.js')) as typeof import('tesseract.js');
    ocrWorkerPromise = createWorker(language, undefined, {
      logger: message => {
        if (message.status === 'recognizing text' && activeOcrProgressHandler) {
          activeOcrProgressHandler(message.progress);
        }
      },
    });
    currentOcrLanguage = language;
  } else if (currentOcrLanguage !== language) {
    const worker = await ocrWorkerPromise;
    await worker.reinitialize(language);
    currentOcrLanguage = language;
  }
  return ocrWorkerPromise;
};

const fileExtension = (name: string) => {
  const index = name.lastIndexOf('.');
  if (index === -1) return '';
  return name.slice(index + 1).toLowerCase();
};

const readFileAsArrayBuffer = async (file: File) => {
  return file.arrayBuffer();
};

const extractPdfText = async (file: File) => {
  const data = new Uint8Array(await readFileAsArrayBuffer(file));
  const pdfjsLib = await getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    if (text.trim()) {
      pages.push(text);
    }
  }

  return pages.join('\n\n');
};

const renderPdfPageToBlob = async (page: PdfPage, scale: number) => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create canvas context for OCR.');
  }

  await page.render({ canvasContext: context, viewport }).promise;

  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, 'image/png');
  });

  if (!blob) {
    throw new Error('Unable to convert PDF page to image for OCR.');
  }

  return blob;
};

const ocrImage = async (
  image: Blob,
  language: string,
  onOcrProgress?: OcrProgressHandler
) => {
  const worker = await getOcrWorker(language, onOcrProgress);
  const result = await worker.recognize(image);
  return result.data.text || '';
};

const ocrPdf = async (file: File, options: FileParseOptions) => {
  const data = new Uint8Array(await readFileAsArrayBuffer(file));
  const pdfjsLib = await getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const maxPages = options.maxOcrPages ?? DEFAULT_MAX_OCR_PAGES;
  const pagesToProcess = Math.min(pdf.numPages, maxPages);
  const outputs: string[] = [];

  for (let pageIndex = 1; pageIndex <= pagesToProcess; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const blob = await renderPdfPageToBlob(page, 1.5);
    const text = await ocrImage(
      blob,
      options.ocrLanguage ?? DEFAULT_OCR_LANGUAGE,
      options.onOcrProgress
    );
    if (text.trim()) {
      outputs.push(`--- Page ${pageIndex} ---\n${text.trim()}`);
    }
  }

  return outputs.join('\n\n');
};

const parseDocx = async (file: File) => {
  const buffer = await readFileAsArrayBuffer(file);
  const { default: mammoth } = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value || '';
};

const parseXlsx = async (file: File) => {
  const buffer = await readFileAsArrayBuffer(file);
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const outputs: string[] = [];

  workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) {
      outputs.push(`--- Sheet: ${name} ---\n${csv.trim()}`);
    }
  });

  return outputs.join('\n\n');
};

const parseTextFile = async (file: File) => {
  return file.text();
};

export const parseFileToText = async (
  file: File,
  options: FileParseOptions = {}
) => {
  const extension = fileExtension(file.name);

  if (['txt', 'md'].includes(extension)) {
    return parseTextFile(file);
  }

  if (extension === 'docx') {
    return parseDocx(file);
  }

  if (extension === 'xlsx' || extension === 'xls') {
    return parseXlsx(file);
  }

  if (extension === 'pdf') {
    const text = await extractPdfText(file);
    const minLength = options.minPdfTextLength ?? DEFAULT_MIN_PDF_TEXT_LENGTH;
    if (text.trim().length >= minLength) {
      return text;
    }
    return ocrPdf(file, options);
  }

  if (
    ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'tif', 'tiff'].includes(
      extension
    )
  ) {
    return ocrImage(
      file,
      options.ocrLanguage ?? DEFAULT_OCR_LANGUAGE,
      options.onOcrProgress
    );
  }

  if (file.type.startsWith('text/')) {
    return parseTextFile(file);
  }

  throw new Error('Unsupported file type.');
};
