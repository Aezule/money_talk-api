import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ───── Seed data types ───── */

type SeedCategory = { name: string; type?: 'expense' | 'income'; color?: string; icon?: string };
type SeedBudget = { category: string; amount: number; period?: string; startDate?: string; endDate?: string; alertThreshold?: number };
type SeedTransaction = { date: string; amount: number; type?: 'expense' | 'income'; category?: string; description?: string; notes?: string; isRecurring?: boolean };

type SeedData = {
  user: { email: string; password?: string; firstName?: string; lastName?: string };
  categories?: SeedCategory[];
  budgets?: SeedBudget[];
  transactions?: SeedTransaction[];
};

type CategoryRecord = {
  id: string;
  userId: string;
  name: string;
  type: 'expense' | 'income';
  color?: string | null;
  icon?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/* ───── Helpers ───── */

function normalizeType(value?: string): 'expense' | 'income' {
  return value === 'income' ? 'income' : 'expense';
}

function catKey(name: string, type?: string) {
  return `${name.trim().toLowerCase()}::${normalizeType(type)}`;
}

function resolveDbName(uri: string) {
  const withoutQuery = uri.split('?')[0] ?? uri;
  const last = withoutQuery.split('/').at(-1) ?? '';
  return last.length > 0 ? last : 'moneytalks';
}

function parseArgs() {
  const args = process.argv.slice(2);
  let filePath = path.resolve(__dirname, 'seed-data.json');
  let reset = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--file' || args[i] === '-f') && args[i + 1]) {
      filePath = path.resolve(process.cwd(), args[++i]!);
    } else if (args[i] === '--reset') {
      reset = true;
    }
  }
  return { filePath, reset };
}

/* ───── DB operations ───── */

async function ensureUser(db: any, data: SeedData['user']) {
  const email = data.email.trim().toLowerCase();
  const users = db.collection('utilisateur');
  const existing = await users.findOne({ email });

  if (existing) {
    console.log(`Using existing user: ${email}`);
    const firstName = data.firstName ?? existing.firstName;
    const lastName = data.lastName ?? existing.lastName;
    if (firstName !== existing.firstName || lastName !== existing.lastName) {
      await users.updateOne(
        { id: existing.id },
        { $set: { firstName, lastName, updatedAt: new Date() } },
      );
    }
    return existing;
  }

  const now = new Date();
  const userId = uuid();
  const created = {
    id: userId,
    userId,
    email,
    password: await bcrypt.hash(data.password || 'password', 10),
    firstName: data.firstName || null,
    lastName: data.lastName || null,
    createdAt: now,
    updatedAt: now,
  };
  await users.insertOne(created);
  console.log(`Created user: ${email}`);
  return created;
}

async function clearUserData(db: any, userId: string) {
  const txIds = (
    await db.collection('transactions').find({ userId }).project({ id: 1 }).toArray()
  ).map((t: any) => t.id);

  if (txIds.length) {
    await db.collection('attachments').deleteMany({ transactionId: { $in: txIds } });
  }

  await db.collection('transactions').deleteMany({ userId });
  await db.collection('recurring_transactions').deleteMany({ userId });
  await db.collection('budgets').deleteMany({ userId });
  await db.collection('categories').deleteMany({ userId });
  await db.collection('forecast_lines').deleteMany({ userId });
}

async function upsertCategory(
  db: any,
  userId: string,
  cat: SeedCategory,
  cache: Map<string, CategoryRecord>,
) {
  const name = cat.name?.trim();
  if (!name) return;
  const type = normalizeType(cat.type);
  const col = db.collection('categories');
  const now = new Date();

  let record = (await col.findOne({ userId, name, type })) as CategoryRecord | null;

  if (record) {
    if (cat.color || cat.icon) {
      const update = {
        color: cat.color ?? record.color ?? null,
        icon: cat.icon ?? record.icon ?? null,
        updatedAt: now,
      };
      await col.updateOne({ id: record.id }, { $set: update });
      record = { ...record, ...update };
    }
  } else {
    record = { id: uuid(), userId, name, type, color: cat.color ?? null, icon: cat.icon ?? null, createdAt: now, updatedAt: now };
    await col.insertOne(record);
  }

  cache.set(catKey(name, type), record);
}

async function resolveCategory(
  db: any,
  userId: string,
  name: string | undefined,
  typeHint: string,
  cache: Map<string, CategoryRecord>,
): Promise<CategoryRecord | null> {
  if (!name) return null;

  const key = catKey(name, typeHint);
  if (cache.has(key)) return cache.get(key)!;

  // Try DB lookup
  const existing = await db.collection('categories').findOne({ userId, name: name.trim(), type: normalizeType(typeHint) });
  if (existing) {
    cache.set(key, existing);
    return existing;
  }

  // Auto-create
  const now = new Date();
  const created: CategoryRecord = { id: uuid(), userId, name: name.trim(), type: normalizeType(typeHint), createdAt: now, updatedAt: now };
  await db.collection('categories').insertOne(created);
  cache.set(key, created);
  return created;
}

async function importBudget(
  db: any,
  userId: string,
  budget: SeedBudget,
  cache: Map<string, CategoryRecord>,
) {
  const category = await resolveCategory(db, userId, budget.category, 'expense', cache);
  if (!category) return;

  const amount = Math.round(Number(budget.amount));
  if (!Number.isFinite(amount)) return;

  const period = budget.period || 'monthly';
  const startDate = budget.startDate ? new Date(budget.startDate) : null;
  const endDate = budget.endDate ? new Date(budget.endDate) : null;
  const col = db.collection('budgets');

  const existing = await col.findOne({ userId, categoryId: category.id, period, startDate, endDate });
  if (existing) {
    await col.updateOne(
      { id: existing.id },
      { $set: { amount, alertThreshold: budget.alertThreshold ?? existing.alertThreshold, updatedAt: new Date() } },
    );
  } else {
    const now = new Date();
    await col.insertOne({
      id: uuid(), userId, categoryId: category.id, amount, period,
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(budget.alertThreshold !== undefined && { alertThreshold: budget.alertThreshold }),
      createdAt: now, updatedAt: now,
    });
  }
}

async function importTransaction(
  db: any,
  userId: string,
  tx: SeedTransaction,
  cache: Map<string, CategoryRecord>,
): Promise<boolean> {
  const type = normalizeType(tx.type);
  const date = new Date(tx.date);
  if (Number.isNaN(date.getTime())) return false;

  const amount = Math.round(Number(tx.amount));
  if (!Number.isFinite(amount)) return false;

  const category = await resolveCategory(db, userId, tx.category, type, cache);
  const categoryId = category?.id ?? undefined;
  const description = tx.description || undefined;
  const notes = tx.notes || undefined;
  const isRecurring = tx.isRecurring === true ? true : undefined;

  const existing = await db.collection('transactions').findOne({ userId, categoryId, amount, type, date, description, notes });
  if (existing) return false;

  const now = new Date();
  await db.collection('transactions').insertOne({ id: uuid(), userId, categoryId, amount, type, date, description, notes, ...(isRecurring && { isRecurring }), createdAt: now, updatedAt: now });
  return true;
}

/* ───── Main ───── */

async function main() {
  const { filePath, reset } = parseArgs();

  if (!existsSync(filePath)) {
    console.error(`Seed file not found: ${filePath}\nUsage: npm run bdd:init -- --file prisma/seed-data.json [--reset]`);
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(filePath, 'utf-8')) as SeedData;
  if (!data?.user?.email) {
    console.error('Seed file must include user.email');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/moneytalks';
  const client = new MongoClient(mongoUri);
  await client.connect();

  try {
    const db = client.db(resolveDbName(mongoUri));
    const user = await ensureUser(db, data.user);

    if (reset) {
      console.log('Reset: clearing existing user data...');
      await clearUserData(db, user.id);
    }

    const categoryCache = new Map<string, CategoryRecord>();

    for (const cat of data.categories ?? []) {
      await upsertCategory(db, user.id, cat, categoryCache);
    }

    for (const budget of data.budgets ?? []) {
      await importBudget(db, user.id, budget, categoryCache);
    }

    let txCreated = 0;
    for (const tx of data.transactions ?? []) {
      if (await importTransaction(db, user.id, tx, categoryCache)) txCreated++;
    }

    console.log(`Done: ${(data.categories ?? []).length} categories, ${(data.budgets ?? []).length} budgets, ${txCreated} transactions.`);
  } finally {
    await client.close();
  }
}

try {
  await main();
} catch (e) {
  console.error('Import failed:', e);
  process.exitCode = 1;
}
