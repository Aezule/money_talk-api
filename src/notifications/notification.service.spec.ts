// Test UNITAIRE
import { jest } from '@jest/globals';
import { NotificationService } from './notification.service.js';

const createPrismaMock = () => ({
  notification: {
    findMany: jest.fn<any>(),
    create: jest.fn<any>(),
    updateMany: jest.fn<any>(),
  },
  budget: {
    findMany: jest.fn<any>(),
  },
  transaction: {
    aggregate: jest.fn<any>(),
  },
});

describe('NotificationService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: NotificationService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.notification.create.mockResolvedValue({ id: 'n1' });
    service = new NotificationService(prisma as any);
  });

  describe('checkBudgetForCategory', () => {
    it('does nothing when there is no budget for the category', async () => {
      prisma.budget.findMany.mockResolvedValue([]);

      await service.checkBudgetForCategory('u1', 'c1');

      expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('persists a budget_exceeded notification when spending is over the budget', async () => {
      prisma.budget.findMany.mockResolvedValue([
        { id: 'b1', userId: 'u1', categoryId: 'c1', amount: 100, period: 'monthly' },
      ]);
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 150 } });

      await service.checkBudgetForCategory('u1', 'c1');

      const created = prisma.notification.create.mock.calls.map(
        (call: any) => call[0].data,
      );
      expect(created.some((d: any) => d.type === 'budget_exceeded')).toBe(true);
    });

    it('persists a budget_alert when spending is between the threshold and the budget', async () => {
      prisma.budget.findMany.mockResolvedValue([
        {
          id: 'b1',
          userId: 'u1',
          categoryId: 'c1',
          amount: 100,
          alertThreshold: 80,
          period: 'monthly',
        },
      ]);
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 90 } });

      await service.checkBudgetForCategory('u1', 'c1');

      const created = prisma.notification.create.mock.calls.map(
        (call: any) => call[0].data,
      );
      expect(created.some((d: any) => d.type === 'budget_alert')).toBe(true);
      expect(created.some((d: any) => d.type === 'budget_exceeded')).toBe(false);
    });

    it('does not alert when spending is below the threshold', async () => {
      prisma.budget.findMany.mockResolvedValue([
        {
          id: 'b1',
          userId: 'u1',
          categoryId: 'c1',
          amount: 100,
          alertThreshold: 80,
          period: 'monthly',
        },
      ]);
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 10 } });

      await service.checkBudgetForCategory('u1', 'c1');

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('getNotifications', () => {
    it('returns the user notifications ordered by newest first', async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);

      const result = await service.getNotifications('u1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([{ id: 'n1' }]);
    });
  });

  describe('stream / onModuleDestroy', () => {
    it('returns an observable and flushes pending notifications as delivered', async () => {
      prisma.notification.findMany.mockResolvedValue([
        { id: 'p1', type: 'budget_alert', payload: { type: 'budget_alert' } },
      ]);
      prisma.notification.updateMany.mockResolvedValue({});

      const obs = service.stream('u1');
      const received: any[] = [];
      obs.subscribe((event) => received.push(event));

      // Laisse le flush asynchrone interne à stream() se terminer.
      await new Promise((resolve) => setImmediate(resolve));

      expect(received).toHaveLength(1);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1'] } },
        data: { delivered: true, deliveredAt: expect.any(Date) },
      });

      // Ne doit pas lever d'erreur et doit vider le registre des flux.
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });
});
