import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { argv } from 'node:process';
import { randomInt } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  const userIdArgIndex = argv.findIndex((a) => a === '--userId' || a === '-u');
  const countArgIndex = argv.findIndex((a) => a === '--count' || a === '-c');
  if (userIdArgIndex === -1 || !argv[userIdArgIndex + 1]) {
    console.error('Usage: npx ts-node prisma/add-transactions.ts --userId <id> --count <n>');
    process.exit(1);
  }
  const userId = argv[userIdArgIndex + 1];
  const count = countArgIndex === -1 ? 5 : Number(argv[countArgIndex + 1] || 5);

  console.log(`Adding ${count} transactions for user ${userId}...`);

  const p = prisma;
  for (let i = 0; i < count; i++) {
    const amount = faker.number.int({ min: 100, max: 10000 });
    const type = faker.helpers.arrayElement(['expense', 'income']);
    const categories = await p.category.findMany({ where: { userId } });
    const category = categories.length
      ? categories[randomInt(0, categories.length)]
      : null;

    await p.transaction.create({
      data: {
        userId,
        categoryId: category?.id ?? null,
        amount,
        type,
        date: faker.date.past({ years: 1 }),
        description: faker.lorem.sentence(),
        notes: faker.lorem.sentences(1),
      },
    });
  }

  console.log('Done adding transactions.');
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}



