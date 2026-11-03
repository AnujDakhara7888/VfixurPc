import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Device } from './device.entity';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/device.dto';
import { User } from '../users/user.entity';
import { Role } from '../common/enums';

@Injectable()
export class DevicesService {
  constructor(@InjectRepository(Device) private deviceRepo: Repository<Device>) {}

  private withActiveCustomer<T>(customerId: string, work: (em: EntityManager) => Promise<T>) {
    return this.deviceRepo.manager.transaction(async em => {
      const [customer] = await em.query('SELECT is_active FROM users WHERE id = $1 FOR UPDATE', [customerId]);
      if (!customer?.is_active) throw new ForbiddenException('This customer account is no longer active');
      return work(em);
    });
  }

  async create(dto: CreateDeviceDto, customerId: string) {
    return this.withActiveCustomer(customerId, async em => {
      const devices = em.getRepository(Device);
      return devices.save(devices.create({ ...dto, customerId }));
    });
  }

  async findByCustomer(customerId: string) {
    return this.deviceRepo.find({ where: { customerId } });
  }

  async findOne(id: string) {
    const device = await this.deviceRepo.findOne({ where: { id } });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async findOwned(id: string, user: User) {
    const device = await this.findOne(id);
    if (device.customerId !== user.id && ![Role.SUPER_ADMIN, Role.OPERATIONS].includes(user.role)) {
      throw new NotFoundException('Device not found');
    }
    return device;
  }

  async update(id: string, dto: UpdateDeviceDto, user: User) {
    const device = await this.findOne(id);
    if (device.customerId !== user.id && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException();
    }
    return this.withActiveCustomer(device.customerId, async em => {
      const devices = em.getRepository(Device);
      const current = await devices.findOne({ where: { id } });
      if (!current) throw new NotFoundException('Device not found');
      Object.assign(current, dto);
      return devices.save(current);
    });
  }

  async remove(id: string, user: User) {
    const device = await this.findOne(id);
    if (device.customerId !== user.id && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException();
    }
    await this.withActiveCustomer(device.customerId, async em => {
      const devices = em.getRepository(Device);
      const current = await devices.findOne({ where: { id } });
      if (!current) throw new NotFoundException('Device not found');
      await devices.remove(current);
    });
  }
}
