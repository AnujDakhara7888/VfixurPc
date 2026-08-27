import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from './device.entity';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/device.dto';
import { User } from '../users/user.entity';
import { Role } from '../common/enums';

@Injectable()
export class DevicesService {
  constructor(@InjectRepository(Device) private deviceRepo: Repository<Device>) {}

  async create(dto: CreateDeviceDto, customerId: string) {
    const device = this.deviceRepo.create({ ...dto, customerId });
    return this.deviceRepo.save(device);
  }

  async findByCustomer(customerId: string) {
    return this.deviceRepo.find({ where: { customerId } });
  }

  async findOne(id: string) {
    const device = await this.deviceRepo.findOne({ where: { id } });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async update(id: string, dto: UpdateDeviceDto, user: User) {
    const device = await this.findOne(id);
    if (device.customerId !== user.id && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException();
    }
    Object.assign(device, dto);
    return this.deviceRepo.save(device);
  }

  async remove(id: string, user: User) {
    const device = await this.findOne(id);
    if (device.customerId !== user.id && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException();
    }
    await this.deviceRepo.remove(device);
  }
}
