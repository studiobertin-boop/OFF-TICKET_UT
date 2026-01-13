import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, '..', 'docs', 'Officomp_logo-bianco (2).png');
const publicDir = path.join(__dirname, '..', 'public');

async function generateFavicons() {
  console.log('Generating favicons from Officomp logo...');

  // Create public directory if it doesn't exist
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Generate favicon.ico (32x32)
  await sharp(inputFile)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('✓ favicon.ico (32x32) created');

  // Generate favicon-16x16.png
  await sharp(inputFile)
    .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(path.join(publicDir, 'favicon-16x16.png'));
  console.log('✓ favicon-16x16.png created');

  // Generate favicon-32x32.png
  await sharp(inputFile)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('✓ favicon-32x32.png created');

  // Generate apple-touch-icon.png (180x180)
  await sharp(inputFile)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png (180x180) created');

  // Generate android-chrome-192x192.png
  await sharp(inputFile)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(path.join(publicDir, 'android-chrome-192x192.png'));
  console.log('✓ android-chrome-192x192.png created');

  // Generate android-chrome-512x512.png
  await sharp(inputFile)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(path.join(publicDir, 'android-chrome-512x512.png'));
  console.log('✓ android-chrome-512x512.png created');

  console.log('\n✅ All favicons generated successfully!');
}

generateFavicons().catch(err => {
  console.error('Error generating favicons:', err);
  process.exit(1);
});
