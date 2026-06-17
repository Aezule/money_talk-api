import { MongoClient } from 'mongodb';

function resolveDbName(mongoUri: string) {
  const uriWithoutQuery = mongoUri.split('?')[0] ?? mongoUri;
  const parts = uriWithoutQuery.split('/');
  const candidate = parts[parts.length - 1];
  return candidate && candidate.length > 0 ? candidate : 'moneytalks';
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
  };
}

async function main() {
  const { dryRun } = parseArgs();
  const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/moneytalks';
  const dbName = resolveDbName(mongoUri);
  const client = new MongoClient(mongoUri);

  await client.connect();
  try {
    const db = client.db(dbName);

    if (dryRun) {
      const collections = await db.listCollections({}, { nameOnly: true }).toArray();
      console.log(`Dry run: database "${dbName}" would be purged.`);
      console.log(
        `Collections: ${
          collections.map((c) => c.name).sort().join(', ') || '(none)'
        }`,
      );
      return;
    }

    await db.dropDatabase();
    console.log(`Database "${dbName}" purged successfully.`);
  } finally {
    await client.close();
  }
}

try {
  await main();
} catch (e) {
  console.error('Purge failed:', e);
  process.exitCode = 1;
}
