import { PrismaClient } from '.prisma/client';
import { inflateRawSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

interface ParsedProductRow {
  rowNumber: number;
  categoryName: string;
  article: string;
  name: string;
  price: string;
  imageUrl?: string;
}

interface CliOptions {
  filePath: string;
  dryRun: boolean;
  sheetName?: string;
}

type SheetCell = string | number | null;

const DEFAULT_FILE_PATH = 'docs/majormodelsprice.xlsx';
const DEFAULT_SHEET_NAME = 'Продукция';

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const absolutePath = resolve(options.filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Excel file not found: ${absolutePath}`);
  }

  const rows = readCatalogRows(absolutePath, options.sheetName ?? DEFAULT_SHEET_NAME);
  const products = normalizeCatalogRows(rows);
  const uniqueCategoryCount = new Set(products.map((product) => product.categoryName)).size;

  if (options.dryRun) {
    printSummary({
      mode: 'dry-run',
      filePath: absolutePath,
      rows: products.length,
      categories: uniqueCategoryCount,
      productsCreated: products.length,
      productsUpdated: 0,
      categoriesCreated: uniqueCategoryCount,
    });
    return;
  }

  const prisma = new PrismaClient();
  try {
    const categoryNames = Array.from(
      new Set(products.map((product) => product.categoryName)),
    );
    const articles = Array.from(new Set(products.map((product) => product.article)));

    const [existingCategories, existingProducts] = await Promise.all([
      prisma.category.findMany({
        where: { name: { in: categoryNames } },
        select: { name: true },
      }),
      prisma.product.findMany({
        where: { article: { in: articles } },
        select: { article: true },
      }),
    ]);

    const existingCategoryNames = new Set(
      existingCategories.map((category) => category.name),
    );
    const existingArticles = new Set(existingProducts.map((product) => product.article));
    const categoryIdsByName = new Map<string, string>();

    for (const categoryName of categoryNames) {
      const category = await prisma.category.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName },
        select: { id: true, name: true },
      });
      categoryIdsByName.set(category.name, category.id);
    }

    for (const product of products) {
      const categoryId = categoryIdsByName.get(product.categoryName);
      if (!categoryId) {
        throw new Error(`Internal error: category not imported: ${product.categoryName}`);
      }

      await prisma.product.upsert({
        where: { article: product.article },
        update: {
          categoryId,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl ?? null,
        },
        create: {
          categoryId,
          article: product.article,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
        },
      });
    }

    const productsUpdated = products.filter((product) =>
      existingArticles.has(product.article),
    ).length;

    printSummary({
      mode: 'import',
      filePath: absolutePath,
      rows: products.length,
      categories: uniqueCategoryCount,
      categoriesCreated: categoryNames.filter((name) => !existingCategoryNames.has(name))
        .length,
      productsCreated: products.length - productsUpdated,
      productsUpdated,
    });
  } finally {
    await prisma.$disconnect();
  }
}

function parseCliOptions(args: string[]): CliOptions {
  let filePath = DEFAULT_FILE_PATH;
  let dryRun = false;
  let sheetName: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--sheet') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Missing value for --sheet');
      }
      sheetName = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--sheet=')) {
      sheetName = arg.slice('--sheet='.length);
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    filePath = arg;
  }

  return { filePath, dryRun, sheetName };
}

function readCatalogRows(filePath: string, sheetName: string): SheetCell[][] {
  const zipEntries = readZipEntries(readFileSync(filePath));
  const workbookXml = readZipText(zipEntries, 'xl/workbook.xml');
  const workbookRelsXml = readZipText(zipEntries, 'xl/_rels/workbook.xml.rels');
  const sharedStrings = readSharedStrings(zipEntries);
  const sheetPath = resolveWorksheetPath(workbookXml, workbookRelsXml, sheetName);
  const sheetXml = readZipText(zipEntries, sheetPath);

  return readSheetRows(sheetXml, sharedStrings);
}

function normalizeCatalogRows(rows: SheetCell[][]): ParsedProductRow[] {
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(String(cell ?? '')) === 'category'),
  );
  if (headerRowIndex < 0) {
    throw new Error('Header row not found. Required column: Категория');
  }

  const header = rows[headerRowIndex];
  const columns = findHeaderColumns(header);
  const products: ParsedProductRow[] = [];
  const seenArticles = new Set<string>();

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || row.every((cell) => cell === null || String(cell).trim() === '')) {
      continue;
    }

    const product = {
      rowNumber: index + 1,
      categoryName: getRequiredText(row, columns.category, 'Категория', index + 1),
      article: getRequiredText(row, columns.article, 'Артикул', index + 1),
      name: getRequiredText(row, columns.name, 'Наименование', index + 1),
      price: normalizePrice(
        getRequiredText(row, columns.price, 'Цена', index + 1),
        index + 1,
      ),
      imageUrl:
        columns.imageUrl === undefined
          ? undefined
          : getOptionalText(row, columns.imageUrl),
    };

    if (seenArticles.has(product.article)) {
      throw new Error(
        `Duplicate article '${product.article}' in Excel row ${product.rowNumber}`,
      );
    }

    seenArticles.add(product.article);
    products.push(product);
  }

  if (products.length === 0) {
    throw new Error('No product rows found in Excel file');
  }

  return products;
}

function findHeaderColumns(header: SheetCell[]): {
  category: number;
  article: number;
  name: number;
  price: number;
  imageUrl?: number;
} {
  const columns = new Map<string, number>();
  header.forEach((cell, index) => {
    const normalized = normalizeHeader(String(cell ?? ''));
    if (normalized && !columns.has(normalized)) {
      columns.set(normalized, index);
    }
  });

  return {
    category: requireColumn(columns, 'category', 'Категория'),
    article: requireColumn(columns, 'article', 'Артикул'),
    name: requireColumn(columns, 'name', 'Наименование'),
    price: requireColumn(columns, 'price', 'Цена'),
    imageUrl: columns.get('imageUrl'),
  };
}

function normalizeHeader(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  const aliases: Record<string, string> = {
    category: 'category',
    категория: 'category',
    article: 'article',
    артикул: 'article',
    sku: 'article',
    name: 'name',
    наименование: 'name',
    название: 'name',
    товар: 'name',
    price: 'price',
    цена: 'price',
    image: 'imageUrl',
    imageurl: 'imageUrl',
    картинка: 'imageUrl',
    фото: 'imageUrl',
  };

  return aliases[normalized] ?? '';
}

function requireColumn(
  columns: Map<string, number>,
  key: string,
  label: string,
): number {
  const index = columns.get(key);
  if (index === undefined) {
    throw new Error(`Required Excel column not found: ${label}`);
  }

  return index;
}

function getRequiredText(
  row: SheetCell[],
  column: number,
  label: string,
  rowNumber: number,
): string {
  const value = getOptionalText(row, column);
  if (!value) {
    throw new Error(`Missing '${label}' in Excel row ${rowNumber}`);
  }

  return value;
}

function getOptionalText(row: SheetCell[], column: number): string | undefined {
  const raw = row[column];
  if (raw === null || raw === undefined) {
    return undefined;
  }

  const value = String(raw).trim();
  return value.length > 0 ? value : undefined;
}

function normalizePrice(value: string, rowNumber: number): string {
  const normalized = value.replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid price '${value}' in Excel row ${rowNumber}`);
  }

  return Number(normalized).toFixed(2);
}

function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const centralDirectory = readCentralDirectory(buffer);

  for (const entry of centralDirectory) {
    const localHeaderOffset = entry.localHeaderOffset;
    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid ZIP local header for ${entry.name}`);
    }

    const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
    const compressed = buffer.subarray(
      dataStart,
      dataStart + entry.compressedSize,
    );

    if (entry.method === 0) {
      entries.set(entry.name, Buffer.from(compressed));
    } else if (entry.method === 8) {
      entries.set(entry.name, inflateRawSync(compressed));
    } else {
      throw new Error(
        `Unsupported compression method ${entry.method} for ${entry.name}`,
      );
    }
  }

  return entries;
}

function readCentralDirectory(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory');
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString('utf8');

    entries.push({
      name,
      method,
      compressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 65557);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) {
      return offset;
    }
  }

  throw new Error('Invalid XLSX file: ZIP end of central directory not found');
}

function readZipText(entries: Map<string, Buffer>, path: string): string {
  const content = entries.get(path);
  if (!content) {
    throw new Error(`XLSX part not found: ${path}`);
  }

  return content.toString('utf8');
}

function readSharedStrings(entries: Map<string, Buffer>): string[] {
  const content = entries.get('xl/sharedStrings.xml');
  if (!content) {
    return [];
  }

  const xml = content.toString('utf8');
  return Array.from(xml.matchAll(/<si\b[\s\S]*?<\/si>/g)).map((match) => {
    const texts = Array.from(match[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g));
    return texts.map((textMatch) => decodeXml(textMatch[1])).join('');
  });
}

function resolveWorksheetPath(
  workbookXml: string,
  workbookRelsXml: string,
  sheetName: string,
): string {
  const sheets = Array.from(
    workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g),
  ).map((match) => ({
    name: readXmlAttribute(match[1], 'name'),
    relationshipId: readXmlAttribute(match[1], 'r:id'),
  }));

  const sheet = sheets.find((item) => item.name === sheetName) ?? sheets[0];
  if (!sheet || !sheet.relationshipId) {
    throw new Error(`Worksheet not found: ${sheetName}`);
  }

  const relationshipMatch = Array.from(
    workbookRelsXml.matchAll(/<Relationship\b([^>]*)\/?>/g),
  ).find((match) => readXmlAttribute(match[1], 'Id') === sheet.relationshipId);

  if (!relationshipMatch) {
    throw new Error(`Worksheet relationship not found: ${sheet.relationshipId}`);
  }

  const target = readXmlAttribute(relationshipMatch[1], 'Target');
  if (!target) {
    throw new Error(`Worksheet target not found: ${sheet.relationshipId}`);
  }

  return target.startsWith('xl/') ? target : `xl/${target.replace(/^\//, '')}`;
}

function readSheetRows(sheetXml: string, sharedStrings: string[]): SheetCell[][] {
  const rows: SheetCell[][] = [];
  const rowMatches = sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g);

  for (const rowMatch of rowMatches) {
    const rowNumber = Number(readXmlAttribute(rowMatch[1], 'r') ?? rows.length + 1);
    const row: SheetCell[] = [];
    let fallbackColumn = 0;

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1];
      const body = cellMatch[2];
      const reference = readXmlAttribute(attributes, 'r');
      const type = readXmlAttribute(attributes, 't');
      const columnIndex = reference ? columnNameToIndex(reference) : fallbackColumn;
      row[columnIndex] = readCellValue(body, type, sharedStrings);
      fallbackColumn = columnIndex + 1;
    }

    rows[rowNumber - 1] = row;
  }

  return rows;
}

function readCellValue(
  body: string,
  type: string | undefined,
  sharedStrings: string[],
): SheetCell {
  if (type === 'inlineStr') {
    const inlineText = Array.from(body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
      .map((match) => decodeXml(match[1]))
      .join('');
    return inlineText || null;
  }

  const valueMatch = body.match(/<v>([\s\S]*?)<\/v>/);
  if (!valueMatch) {
    return null;
  }

  const rawValue = decodeXml(valueMatch[1]);
  if (type === 's') {
    return sharedStrings[Number(rawValue)] ?? '';
  }

  if (type === 'str') {
    return rawValue;
  }

  const numeric = Number(rawValue);
  return Number.isFinite(numeric) ? numeric : rawValue;
}

function readXmlAttribute(attributes: string, name: string): string | undefined {
  const escapedName = name.replace(':', '\\:');
  const regex = new RegExp(`(?:^|\\s)${escapedName}="([^"]*)"`);
  const match = attributes.match(regex);
  return match ? decodeXml(match[1]) : undefined;
}

function columnNameToIndex(reference: string): number {
  const columnName = reference.replace(/[0-9]/g, '').toUpperCase();
  let index = 0;

  for (const char of columnName) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }

  return index - 1;
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function printSummary(summary: {
  mode: 'dry-run' | 'import';
  filePath: string;
  rows: number;
  categories: number;
  categoriesCreated: number;
  productsCreated: number;
  productsUpdated: number;
}): void {
  console.log(`Catalog ${summary.mode} completed`);
  console.log(`File: ${summary.filePath}`);
  console.log(`Rows: ${summary.rows}`);
  console.log(`Categories: ${summary.categories}`);
  console.log(`Categories created: ${summary.categoriesCreated}`);
  console.log(`Products created: ${summary.productsCreated}`);
  console.log(`Products updated: ${summary.productsUpdated}`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Catalog import failed: ${message}`);
  process.exit(1);
});
