#!/usr/bin/env node
// Optimize demo PNGs using sharp — reduces size ~50-70%
import sharp from "sharp";
import { readdirSync } from "fs";
import { join } from "path";

const DIR = "site/public/demo";
const files = readdirSync(DIR).filter((f) => f.endsWith(".png"));

for (const file of files) {
  const path = join(DIR, file);
  const buf = await sharp(path)
    .png({ quality: 80, compressionLevel: 9 })
    .toBuffer();
  await sharp(buf).toFile(path);
  console.log(`✅ ${file}`);
}

console.log(`\nOptimized ${files.length} PNGs`);
