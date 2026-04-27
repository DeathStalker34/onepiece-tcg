import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../src/index';

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const outputPath = args[0];
  if (!outputPath) {
    console.error('Usage: export-cards <output-path>');
    process.exit(1);
  }
  const cards = await prisma.card.findMany({ orderBy: { id: 'asc' } });
  const absolute = resolve(process.cwd(), outputPath);
  writeFileSync(absolute, JSON.stringify(cards, null, 2));
  console.log(`Wrote ${cards.length} cards to ${absolute}`);
  await prisma.$disconnect();
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('export-cards.ts')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
