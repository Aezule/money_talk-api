import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient, type Db, type Filter, type Document } from 'mongodb';
import { v4 as uuid } from 'uuid';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: MongoClient;
  private db: Db | null = null;

  constructor(private readonly configService: ConfigService) {
    const mongoUri =
      this.configService.get<string>('MONGODB_URI') ??
      'mongodb://mongo:27017/moneytalks';
    this.client = new MongoClient(mongoUri);
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    const dbName = this.resolveDbName();
    this.db = this.client.db(dbName);
    await this.ensureIndexes();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  async $transaction<T>(callback: (db: this) => Promise<T>): Promise<T> {
    return callback(this);
  }

  utilisateur = {
    findUnique: async (args: any) => this.findOne('utilisateur', args),
    findFirst: async (args: any) => this.findOne('utilisateur', args),
    create: async (args: any) => this.createOne('utilisateur', args),
    update: async (args: any) => this.updateOne('utilisateur', args),
    delete: async (args: any) => this.deleteOne('utilisateur', args),
    deleteMany: async (args: any) => this.deleteMany('utilisateur', args),
    findMany: async (args: any) => this.findMany('utilisateur', args),
  };

  refreshToken = {
    findUnique: async (args: any) => this.findOne('refresh_tokens', args),
    create: async (args: any) => this.createOne('refresh_tokens', args),
    update: async (args: any) => this.updateOne('refresh_tokens', args),
    deleteMany: async (args: any) => this.deleteMany('refresh_tokens', args),
  };

  category = {
    findUnique: async (args: any) => this.findOne('categories', args),
    findMany: async (args: any) => this.findMany('categories', args),
    create: async (args: any) => this.createOne('categories', args),
    update: async (args: any) => this.updateOne('categories', args),
    delete: async (args: any) => this.deleteOne('categories', args),
    deleteMany: async (args: any) => this.deleteMany('categories', args),
  };

  budget = {
    findUnique: async (args: any) => this.findOne('budgets', args),
    findFirst: async (args: any) => this.findOne('budgets', args),
    findMany: async (args: any) => this.findMany('budgets', args),
    create: async (args: any) => this.createOne('budgets', args),
    update: async (args: any) => this.updateOne('budgets', args),
    delete: async (args: any) => this.deleteOne('budgets', args),
    deleteMany: async (args: any) => this.deleteMany('budgets', args),
  };

  forecastLine = {
    findUnique: async (args: any) => this.findOne('forecast_lines', args),
    findMany: async (args: any) => this.findMany('forecast_lines', args),
    create: async (args: any) => this.createOne('forecast_lines', args),
    update: async (args: any) => this.updateOne('forecast_lines', args),
    delete: async (args: any) => this.deleteOne('forecast_lines', args),
    deleteMany: async (args: any) => this.deleteMany('forecast_lines', args),
  };

  recurringTransaction = {
    deleteMany: async (args: any) =>
      this.deleteMany('recurring_transactions', args),
  };

  attachment = {
    deleteMany: async (args: any) => this.deleteMany('attachments', args),
  };

  notification = {
    findMany: async (args: any) => this.findMany('notifications', args),
    create: async (args: any) => this.createOne('notifications', args),
    updateMany: async (args: any) => this.updateMany('notifications', args),
  };

  transaction = {
    findUnique: async (args: any) => this.findOne('transactions', args),
    findMany: async (args: any) => this.findTransactions(args),
    create: async (args: any) => this.createOne('transactions', args),
    update: async (args: any) => this.updateOne('transactions', args),
    delete: async (args: any) => this.deleteOne('transactions', args),
    updateMany: async (args: any) => this.updateMany('transactions', args),
    deleteMany: async (args: any) => this.deleteMany('transactions', args),
    aggregate: async (args: any) => this.aggregateTransactions(args),
  };

  private resolveDbName(): string {
    const mongoUri =
      this.configService.get<string>('MONGODB_URI') ??
      'mongodb://mongo:27017/moneytalks';
    const uriWithoutQuery = mongoUri.split('?')[0] ?? mongoUri;
    const parts = uriWithoutQuery.split('/');
    const candidate = parts.at(-1) ?? '';
    return candidate.length > 0 ? candidate : 'moneytalks';
  }

  private collection(name: string) {
    if (!this.db) {
      throw new Error('MongoDB is not connected');
    }
    return this.db.collection(name);
  }

  private isObjectFilter(v: any): boolean {
    return !!v && typeof v === 'object' && !(v instanceof Date);
  }

  private buildSubFilter(value: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    if ('gte' in value) out.$gte = value.gte;
    if ('lte' in value) out.$lte = value.lte;
    if ('in' in value) out.$in = value.in;
    return out;
  }

  private mapWhere(where?: Record<string, any>): Filter<Document> {
    if (!where) return {};
    const filter: Record<string, any> = {};

    for (const [key, value] of Object.entries(where)) {
      if (this.isObjectFilter(value)) {
        const subFilter = this.buildSubFilter(value);
        filter[key] = Object.keys(subFilter).length > 0 ? subFilter : value;
      } else {
        filter[key] = value;
      }
    }

    return filter;
  }

  private selectFields<T extends Record<string, any>>(
    doc: T | null,
    select?: Record<string, boolean>,
  ) {
    if (!doc) return null;
    const { _id: _ignored, ...plain } = doc as any;
    if (!select) return plain;
    const result: Record<string, any> = {};
    for (const [field, enabled] of Object.entries(select)) {
      if (enabled) result[field] = plain[field];
    }
    return result;
  }

  private applyOrder(cursor: any, orderBy?: Record<string, 'asc' | 'desc'>) {
    if (!orderBy) return cursor;
    const sort: Record<string, 1 | -1> = {};
    for (const [field, direction] of Object.entries(orderBy)) {
      sort[field] = direction === 'desc' ? -1 : 1;
    }
    return cursor.sort(sort);
  }

  private async findOne(collectionName: string, args: any) {
    const where = this.mapWhere(args?.where);
    const doc = await this.collection(collectionName).findOne(where);
    return this.selectFields(doc as any, args?.select);
  }

  private async findMany(collectionName: string, args: any) {
    const where = this.mapWhere(args?.where);
    let cursor = this.collection(collectionName).find(where);
    cursor = this.applyOrder(cursor, args?.orderBy);
    const docs = await cursor.toArray();
    return docs.map((doc) => this.selectFields(doc as any, args?.select));
  }

  private async createOne(collectionName: string, args: any) {
    const now = new Date();
    const data = {
      id: args?.data?.id ?? uuid(),
      ...args?.data,
      createdAt: args?.data?.createdAt ?? now,
      updatedAt: args?.data?.updatedAt ?? now,
    };

    await this.collection(collectionName).insertOne(data);
    return this.selectFields(data, args?.select);
  }

  private async updateOne(collectionName: string, args: any) {
    const where = this.mapWhere(args?.where);
    const raw = { ...args?.data, updatedAt: new Date() };
    const data = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== undefined),
    );
    await this.collection(collectionName).updateOne(where, { $set: data });
    const doc = await this.collection(collectionName).findOne(where);
    return this.selectFields(doc as any, args?.select);
  }

  private async updateMany(collectionName: string, args: any) {
    const where = this.mapWhere(args?.where);
    const data = { ...args?.data, updatedAt: new Date() };
    return this.collection(collectionName).updateMany(where, { $set: data });
  }

  private async deleteOne(collectionName: string, args: any) {
    const where = this.mapWhere(args?.where);
    const res = await this.collection(collectionName).findOneAndDelete(where);
    return this.selectFields(res as any, args?.select);
  }

  private async deleteMany(collectionName: string, args: any) {
    const where = this.mapWhere(args?.where);
    return this.collection(collectionName).deleteMany(where);
  }

  private async findTransactions(args: any) {
    const where = this.mapWhere(args?.where);
    let cursor = this.collection('transactions').find(where);
    cursor = this.applyOrder(cursor, args?.orderBy);
    const transactions = (await cursor.toArray()).map((doc) =>
      this.selectFields(doc as any),
    );

    if (!args?.include?.category && !args?.include?.attachments) {
      return transactions;
    }

    const categoryIds = Array.from(
      new Set(transactions.map((t) => t.categoryId).filter(Boolean)),
    );
    const txIds = transactions.map((t) => t.id);

    const categories = args?.include?.category
      ? await this.collection('categories')
          .find({ id: { $in: categoryIds } })
          .toArray()
      : [];
    const attachments = args?.include?.attachments
      ? await this.collection('attachments')
          .find({ transactionId: { $in: txIds } })
          .toArray()
      : [];

    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    const attachmentsByTx = new Map<string, any[]>();
    for (const att of attachments) {
      const list = attachmentsByTx.get(att.transactionId) ?? [];
      list.push(att);
      attachmentsByTx.set(att.transactionId, list);
    }

    return transactions.map((tx) => ({
      ...tx,
      category: args?.include?.category
        ? (categoriesById.get(tx.categoryId) ?? null)
        : undefined,
      attachments: args?.include?.attachments
        ? (attachmentsByTx.get(tx.id) ?? [])
        : undefined,
    }));
  }

  private async aggregateTransactions(args: any) {
    const where = this.mapWhere(args?.where);
    const pipeline = [
      { $match: where },
      { $group: { _id: null, sumAmount: { $sum: '$amount' } } },
    ];
    const res = await this.collection('transactions')
      .aggregate(pipeline)
      .toArray();
    return { _sum: { amount: res[0]?.sumAmount ?? 0 } };
  }

  private async ensureIndexes() {
    await this.collection('utilisateur').createIndex(
      { email: 1 },
      { unique: true },
    );
    await this.collection('refresh_tokens').createIndex(
      { tokenHash: 1 },
      { unique: true },
    );
    await this.collection('transactions').createIndex({ userId: 1, date: -1 });
    await this.collection('budgets').createIndex({ userId: 1, categoryId: 1 });
    await this.collection('categories').createIndex({
      userId: 1,
      name: 1,
      type: 1,
    });
    await this.collection('notifications').createIndex({
      userId: 1,
      delivered: 1,
    });
    await this.collection('forecast_lines').createIndex({ userId: 1, type: 1 });
  }
}
