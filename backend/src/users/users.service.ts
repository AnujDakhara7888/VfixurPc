import {
  Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { UpdateUserDto, UpdateRoleDto } from './dto/update-user.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { Role } from '../common/enums';

/** Strip sensitive fields before returning a user to the client. */
function sanitize(user: User) {
  const { passwordHash, refreshToken, fcmToken, ...safe } = user;
  return safe;
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async findAll(filters: { role?: Role; search?: string } = {}) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .select([
        'u.id', 'u.name', 'u.email', 'u.phone', 'u.username',
        'u.role', 'u.isActive', 'u.createdAt',
      ])
      .orderBy('u.createdAt', 'DESC');

    if (filters.role) qb.andWhere('u.role = :role', { role: filters.role });
    if (filters.search) {
      qb.andWhere(
        '(u.name ILIKE :search OR u.phone ILIKE :search OR u.email ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }
    return qb.getMany();
  }

  /** Admin-only: create a staff member (technician / operations / delivery). */
  async createStaff(dto: CreateStaffDto) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();
    const digits = dto.phone.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) {
      throw new BadRequestException('Enter a valid 10-digit mobile number');
    }
    const phone = `+91${digits}`;

    const [emailExists, usernameExists, phoneExists] = await Promise.all([
      this.userRepo.exists({ where: { email } }),
      this.userRepo.exists({ where: { username } }),
      this.userRepo.exists({ where: { phone } }),
    ]);
    if (emailExists) throw new ConflictException('Email already in use');
    if (usernameExists) throw new ConflictException('Username already in use');
    if (phoneExists) throw new ConflictException('Phone number already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      name: dto.name.trim(),
      email,
      username,
      phone,
      passwordHash,
      role: dto.role,
      isActive: true,
    });
    await this.userRepo.save(user);
    return sanitize(user);
  }

  /** Enable / disable a staff member's access. */
  async setActive(id: string, isActive: boolean) {
    const user = await this.findOne(id);
    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot deactivate a super admin');
    }
    user.isActive = isActive;
    await this.userRepo.save(user);
    return sanitize(user);
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto, requestingUser: User) {
    if (requestingUser.id !== id && requestingUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException();
    }
    const changes = { ...dto };
    if (changes.email !== undefined) {
      if (requestingUser.id === id) {
        throw new BadRequestException('Use the verified email change option in your profile');
      }
      changes.email = changes.email.trim().toLowerCase();
      if (await this.userRepo.exists({ where: { email: changes.email, id: Not(id) } })) {
        throw new ConflictException('Email already in use');
      }
      await this.userRepo.manager.transaction(async manager => {
        await manager.update(User, id, { ...changes, refreshToken: null });
        await manager.increment(User, { id }, 'tokenVersion', 1);
        await manager.query('DELETE FROM login_otp_challenges WHERE user_id=$1', [id]);
      });
      return this.findOne(id);
    }
    await this.userRepo.update(id, changes);
    return this.findOne(id);
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    await this.userRepo.update(id, { role: dto.role });
    return this.findOne(id);
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    await this.userRepo.remove(user);
  }

  async findByRole(role: Role) {
    return this.userRepo.find({ where: { role } });
  }
}
