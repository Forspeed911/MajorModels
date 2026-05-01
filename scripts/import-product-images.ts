import { PrismaClient } from '.prisma/client';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

interface CliOptions {
  rootPath: string;
  dryRun: boolean;
}

interface MatchedFolder {
  folderName: string;
  productId: string;
  article: string;
  files: string[];
}

const DEFAULT_IMAGES_ROOT = 'media/products';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const rootPath = resolve(options.rootPath);

  if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
    throw new Error(`Product images directory not found: ${rootPath}`);
  }

  const prisma = new PrismaClient();
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        article: true,
      },
    });

    const productByArticle = new Map(products.map((product) => [product.article, product]));
    const productByNormalizedArticle = new Map<string, Array<{ id: string; article: string }>>();

    for (const product of products) {
      const normalized = normalizeArticle(product.article);
      const list = productByNormalizedArticle.get(normalized) ?? [];
      list.push(product);
      productByNormalizedArticle.set(normalized, list);
    }

    const folders = readdirSync(rootPath)
      .filter((name) => statSync(resolve(rootPath, name)).isDirectory())
      .sort((a, b) => a.localeCompare(b));

    const matchedFolders: MatchedFolder[] = [];
    const skippedFolders: string[] = [];
    const ambiguousFolders: string[] = [];

    for (const folderName of folders) {
      const product = resolveProduct(folderName, productByArticle, productByNormalizedArticle);
      if (!product) {
        skippedFolders.push(folderName);
        continue;
      }

      if (product === 'ambiguous') {
        ambiguousFolders.push(folderName);
        continue;
      }

      const files = readdirSync(resolve(rootPath, folderName))
        .filter((name) => isImageFile(name))
        .sort((a, b) => a.localeCompare(b));

      matchedFolders.push({
        folderName,
        productId: product.id,
        article: product.article,
        files,
      });
    }

    if (!options.dryRun) {
      for (const folder of matchedFolders) {
        const urls = folder.files.map((fileName) => buildImageUrl(folder.folderName, fileName));
        await prisma.$transaction([
          prisma.productImage.deleteMany({
            where: {
              productId: folder.productId,
            },
          }),
          ...urls.map((url, index) =>
            prisma.productImage.create({
              data: {
                productId: folder.productId,
                url,
                sortOrder: index,
              },
            }),
          ),
          prisma.product.update({
            where: {
              id: folder.productId,
            },
            data: {
              imageUrl: urls[0] ?? null,
            },
          }),
        ]);
      }
    }

    printSummary({
      mode: options.dryRun ? 'dry-run' : 'import',
      rootPath,
      folderCount: folders.length,
      matchedProductCount: matchedFolders.length,
      imageCount: matchedFolders.reduce((sum, folder) => sum + folder.files.length, 0),
      skippedFolders,
      ambiguousFolders,
    });
  } finally {
    await prisma.$disconnect();
  }
}

function parseCliOptions(args: string[]): CliOptions {
  let rootPath = DEFAULT_IMAGES_ROOT;
  let dryRun = false;

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    rootPath = arg;
  }

  return { rootPath, dryRun };
}

function resolveProduct(
  folderName: string,
  productByArticle: Map<string, { id: string; article: string }>,
  productByNormalizedArticle: Map<string, Array<{ id: string; article: string }>>,
): { id: string; article: string } | 'ambiguous' | null {
  const exact = productByArticle.get(folderName);
  if (exact) {
    return exact;
  }

  const normalizedMatches = productByNormalizedArticle.get(normalizeArticle(folderName)) ?? [];
  if (normalizedMatches.length === 1) {
    return normalizedMatches[0];
  }

  if (normalizedMatches.length > 1) {
    return 'ambiguous';
  }

  return null;
}

function isImageFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return Array.from(IMAGE_EXTENSIONS).some((extension) => lower.endsWith(extension));
}

function buildImageUrl(folderName: string, fileName: string): string {
  return `/api/v1/media/products/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`;
}

function normalizeArticle(value: string): string {
  const replacements = new Map<string, string>([
    ['А', 'A'],
    ['В', 'B'],
    ['Е', 'E'],
    ['К', 'K'],
    ['М', 'M'],
    ['Н', 'H'],
    ['О', 'O'],
    ['Р', 'P'],
    ['С', 'C'],
    ['Т', 'T'],
    ['Х', 'X'],
    ['а', 'A'],
    ['в', 'B'],
    ['е', 'E'],
    ['к', 'K'],
    ['м', 'M'],
    ['н', 'H'],
    ['о', 'O'],
    ['р', 'P'],
    ['с', 'C'],
    ['т', 'T'],
    ['х', 'X'],
  ]);

  return Array.from(value.trim())
    .map((char) => replacements.get(char) ?? char.toUpperCase())
    .join('')
    .replace(/\s+/g, '');
}

function printSummary(summary: {
  mode: 'dry-run' | 'import';
  rootPath: string;
  folderCount: number;
  matchedProductCount: number;
  imageCount: number;
  skippedFolders: string[];
  ambiguousFolders: string[];
}): void {
  console.log(`Product images ${summary.mode} completed`);
  console.log(`Root: ${summary.rootPath}`);
  console.log(`Folders scanned: ${summary.folderCount}`);
  console.log(`Products matched: ${summary.matchedProductCount}`);
  console.log(`Images found: ${summary.imageCount}`);

  if (summary.skippedFolders.length > 0) {
    console.log(`Skipped folders: ${summary.skippedFolders.length}`);
    summary.skippedFolders.slice(0, 20).forEach((folder) => {
      console.log(`- ${folder}`);
    });
  }

  if (summary.ambiguousFolders.length > 0) {
    console.log(`Ambiguous folders: ${summary.ambiguousFolders.length}`);
    summary.ambiguousFolders.slice(0, 20).forEach((folder) => {
      console.log(`- ${folder}`);
    });
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Product images import failed: ${message}`);
  process.exit(1);
});
