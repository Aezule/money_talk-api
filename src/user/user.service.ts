import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves a user by their unique identifier.
   *
   * This method queries the database for a user with the specified ID. If found,
   * it returns the user object with sensitive information (such as the password) excluded.
   *
   * @param userId - The unique identifier of the user to retrieve.
   * @returns A promise that resolves to the user object without the password, or `null` if no user is found.
   */
  async find(userId: string) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
    });
    if (!user) return null;

    const { password, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Modifies an existing user's information in the database.
   *
   * @param userId - The unique identifier of the user to update.
   * @param data - An object containing the fields to update (email, firstName, lastName, password). All fields are optional.
   * @returns A promise that resolves to the updated user object without the password field.
   * @throws {BadRequestException} If the user with the specified ID is not found.
   */
  async modify(
    userId: string,
    data: {
      email?: string;
      firstName?: string;
      lastName?: string;
      password?: string;
    },
  ) {
    const user = await this.prisma.utilisateur.update({
      where: { id: userId },
      data,
    });
    if (!user) throw new BadRequestException('User not found');
    const { password, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Modify the user's password after verifying the current password.
   *
   * @param userId - The unique identifier of the user.
   * @param currentPassword - The user's current password (plain text).
   * @param newPassword - The new password to set (plain text).
   * @returns An object with a success message upon completion.
   * @throws {BadRequestException} If the user is not found.
   * @throws {UnauthorizedException} If the current password is incorrect.
   */
  async modifyPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) throw new BadRequestException('User not found');

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.utilisateur.update({
      where: { id: userId },
      data: { password: newHash },
    });

    return { message: 'Password updated successfully' };
  }

  /**
   * Deletes a user and all their associated data from the database.
   *
   * This method performs a cascading delete operation within a transaction to ensure data integrity.
   * It removes the following entities associated with the user in this specific order:
   * 1. Attachments linked to the user's transactions.
   * 2. Transactions.
   * 3. Recurring transactions.
   * 4. Budgets.
   * 5. Categories.
   * 6. Refresh tokens.
   * 7. The user record itself.
   *
   * @param userId - The unique identifier of the user to delete.
   * @returns An object containing a success message upon completion.
   * @throws {BadRequestException} If the user with the provided `userId` does not exist.
   */
  async delete(userId: string) {
    const existing = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      throw new BadRequestException('User not found');
    }

    await this.prisma.$transaction(async (prisma) => {
      const txs = await prisma.transaction.findMany({
        where: { userId },
        select: { id: true },
      });
      const txIds = txs.map((t) => t.id);
      if (txIds.length) {
        await prisma.attachment.deleteMany({
          where: { transactionId: { in: txIds } },
        });
      }

      await prisma.transaction.deleteMany({ where: { userId } });

      await prisma.recurringTransaction.deleteMany({ where: { userId } });

      await prisma.budget.deleteMany({ where: { userId } });

      await prisma.category.deleteMany({ where: { userId } });

      await prisma.refreshToken.deleteMany({ where: { userId } });

      await prisma.utilisateur.delete({ where: { id: userId } });
    });

    return { message: 'User deleted successfully' };
  }
}
