import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#1a1a2e"/>
  <circle cx="256" cy="200" r="100" fill="#22c55e"/>
  <path d="M216 170 L216 230 L296 200 Z" fill="#1a1a2e"/>
  <text x="256" y="380" text-anchor="middle" fill="#22c55e" font-size="64" font-weight="bold" font-family="system-ui">QueSuena</text>
</svg>
`;

const iconsDir = join(__dirname, '../public/icons');

async function generateIcons() {
  const buffer = Buffer.from(svgContent);

  // Generate 192x192
  await sharp(buffer)
    .resize(192, 192)
    .png()
    .toFile(join(iconsDir, 'icon-192.png'));

  console.log('✓ Generated icon-192.png');

  // Generate 512x512
  await sharp(buffer)
    .resize(512, 512)
    .png()
    .toFile(join(iconsDir, 'icon-512.png'));

  console.log('✓ Generated icon-512.png');

  console.log('\\nIcons generated successfully!');
}

generateIcons().catch(console.error);
