import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FaqNode } from './faq-node.entity';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFaqNodeDto {
  @IsOptional() @IsUUID() parentId?: string;
  @IsString() @IsNotEmpty() question: string;
  @IsOptional() @IsString() answer?: string;
  @IsOptional() orderIndex?: number;
  @IsOptional() @IsBoolean() escalateToBooking?: boolean;
}

@Injectable()
export class FaqService {
  constructor(@InjectRepository(FaqNode) private nodeRepo: Repository<FaqNode>) {}

  async getTree() {
    // Return all root nodes (parentId = null)
    return this.nodeRepo.find({
      where: { parentId: IsNull() },
      order: { orderIndex: 'ASC' },
    });
  }

  async getChildren(parentId: string) {
    return this.nodeRepo.find({
      where: { parentId },
      order: { orderIndex: 'ASC' },
    });
  }

  async findOne(id: string) {
    const node = await this.nodeRepo.findOne({ where: { id } });
    if (!node) throw new NotFoundException('FAQ node not found');
    return node;
  }

  async create(dto: CreateFaqNodeDto) {
    const node = this.nodeRepo.create(dto);
    return this.nodeRepo.save(node);
  }

  async update(id: string, dto: Partial<CreateFaqNodeDto>) {
    await this.nodeRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const node = await this.findOne(id);
    await this.nodeRepo.remove(node);
  }
}
