import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

const outputDir = path.join(import.meta.dirname, 'site/images/logos/x');
const imagePath = path.join(import.meta.dirname, 'site/images/logos/x/x-dark.png');
const buffer = fs.readFileSync(imagePath);

await sharp(buffer)
	.resize(64, 64)
	.webp()
	.toFile(path.join(outputDir, 'x-dark.webp'))