/**
 * Tulip Fragrance Company - Automated Extrait Images Compressor for Vercel Blob
 * 
 * Usage:
 *   npx tsx scripts/compress-blob-images.ts
 *   npx tsx scripts/compress-blob-images.ts --source="extraits-raw" --target="extraits" --delete-source
 */

import dotenv from 'dotenv';
import sharp from 'sharp';
import { list, put, del } from '@vercel/blob';

dotenv.config();

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string | boolean | number> = {};

  for (const arg of args) {
    if (arg.startsWith('--source=')) {
      options.source = arg.replace('--source=', '').trim();
    } else if (arg.startsWith('--target=')) {
      options.target = arg.replace('--target=', '').trim();
    } else if (arg === '--delete-source') {
      options.deleteSource = true;
    } else if (arg.startsWith('--max=')) {
      options.maxDimension = Number(arg.replace('--max=', ''));
    } else if (arg.startsWith('--quality=')) {
      options.quality = Number(arg.replace('--quality=', ''));
    }
  }

  return {
    sourceFolder: (options.source as string) || 'extraits-raw',
    targetFolder: (options.target as string) || 'extraits',
    deleteSource: Boolean(options.deleteSource),
    maxDimension: Number(options.maxDimension) || 1200,
    quality: Number(options.quality) || 82,
  };
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('❌ ERREUR: BLOB_READ_WRITE_TOKEN manquant dans les variables d\'environnement (.env).');
    process.exit(1);
  }

  const { sourceFolder, targetFolder, deleteSource, maxDimension, quality } = parseArgs();

  console.log('======================================================');
  console.log('🌸 Tulip - Compression Automatisée des Images Extraits');
  console.log('======================================================');
  console.log(`📂 Dossier source (brut)    : ${sourceFolder}`);
  console.log(`📁 Dossier cible (compressé): ${targetFolder}`);
  console.log(`📐 Dimensions maximales     : ${maxDimension}px`);
  console.log(`🗜️ Qualité WebP             : ${quality}%`);
  console.log(`🗑️ Supprimer les bruts      : ${deleteSource ? 'Oui' : 'Non'}`);
  console.log('------------------------------------------------------');

  const sourcePrefix = sourceFolder.replace(/^\/+|\/+$/g, '') + '/';
  let allBlobs: any[] = [];
  let cursor: string | undefined = undefined;

  console.log('🔍 Recherche des photos dans le dossier source...');
  do {
    const result = await list({
      prefix: sourcePrefix,
      limit: 1000,
      cursor,
      token,
    });
    allBlobs = allBlobs.concat(result.blobs || []);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  const imageRegex = /\.(jpg|jpeg|png|webp|avif|tiff|bmp)$/i;
  const imageBlobs = allBlobs.filter((b) => imageRegex.test(b.pathname || b.url));

  if (imageBlobs.length === 0) {
    console.log(`ℹ️ Aucune image trouvée dans "${sourceFolder}".`);
    process.exit(0);
  }

  console.log(`📦 ${imageBlobs.length} images détectées pour compression.\n`);

  let totalOriginal = 0;
  let totalCompressed = 0;
  let processed = 0;

  for (let i = 0; i < imageBlobs.length; i++) {
    const b = imageBlobs[i];
    const pathname = b.pathname || '';
    const rawFilename = pathname.split('/').pop() || pathname;
    const baseName = rawFilename.replace(/\.[a-zA-Z0-9]+$/i, '').replace(/-[a-zA-Z0-9]{6,}$/, '');
    const targetFilename = `${baseName}.webp`;
    const targetPath = targetFolder ? `${targetFolder}/${targetFilename}` : targetFilename;

    process.stdout.write(`[${i + 1}/${imageBlobs.length}] Compression de ${rawFilename}... `);

    try {
      const resp = await fetch(b.url);
      if (!resp.ok) {
        console.log(`❌ Échec téléchargement (HTTP ${resp.status})`);
        continue;
      }

      const buffer = Buffer.from(await resp.arrayBuffer());
      const origSize = buffer.length;
      totalOriginal += origSize;

      const compressed = await sharp(buffer)
        .rotate()
        .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer();

      const compSize = compressed.length;
      totalCompressed += compSize;

      const savedPercent = Math.round(((origSize - compSize) / origSize) * 100);

      await put(targetPath, compressed, {
        access: 'public',
        contentType: 'image/webp',
        token,
        addRandomSuffix: false,
      });

      if (deleteSource && b.url) {
        try {
          await del(b.url, { token });
        } catch {}
      }

      const origKb = (origSize / 1024).toFixed(1);
      const compKb = (compSize / 1024).toFixed(1);
      console.log(`✅ ${origKb} Ko -> ${compKb} Ko (-${savedPercent}%) -> ${targetFilename}`);
      processed++;
    } catch (err: any) {
      console.log(`❌ Erreur: ${err?.message || err}`);
    }
  }

  console.log('\n======================================================');
  console.log('🎉 Compression terminée avec succès !');
  const origMb = (totalOriginal / (1024 * 1024)).toFixed(2);
  const compMb = (totalCompressed / (1024 * 1024)).toFixed(2);
  const overallSaved = totalOriginal > 0 ? Math.round(((totalOriginal - totalCompressed) / totalOriginal) * 100) : 0;
  console.log(`📊 Bilan: ${processed}/${imageBlobs.length} images traitées`);
  console.log(`💾 Poids initial: ${origMb} Mo  ->  Poids final: ${compMb} Mo`);
  console.log(`⚡ Économie d'espace et de bande passante: -${overallSaved}%`);
  console.log('======================================================');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
