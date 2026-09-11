import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { Email } from '../../domain/user/email.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { User } from '../../domain/user/user.entity.js';
import { UserRepository } from '../../domain/user/user.repository.js';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<void> {
    const { id, email, passwordHash, name, isActive } = user.toPrimitives();

    await this.prisma.user.upsert({
      where: { id },
      create: { id, email, passwordHash, name, isActive },
      update: { email, passwordHash, name, isActive },
    });
  }

  async find(id: UserId): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id: id.value } });

    return row ? User.fromPrimitives(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.value } });

    return row ? User.fromPrimitives(row) : null;
  }

  async searchByIds(ids: UserId[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids.map((id) => id.value) } },
      orderBy: { email: 'asc' },
    });

    return rows.map((row) => User.fromPrimitives(row));
  }
}
