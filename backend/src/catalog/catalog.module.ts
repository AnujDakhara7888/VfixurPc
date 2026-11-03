import {
  Module,
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceDefinition } from './service-definition.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { Role } from '../common/enums';
import defaults from './catalog.defaults.json';
import { applyRequirements } from './requirements';

const CUSTOMER_LABELS: Record<string, Pick<any, 'label' | 'short' | 'tagline'>> = {
  network: { label: 'IT Infrastructure Setup', short: 'IT Infrastructure', tagline: 'Networks, Wi-Fi & office infrastructure' },
  backup: { label: 'Data Backup & Security', short: 'Backup & Security', tagline: 'Cloud, NAS, recovery & data protection' },
};

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(ServiceDefinition)
    private repo: Repository<ServiceDefinition>,
  ) {}
  async list(all = false) {
    const saved = await this.repo.find();
    const entries = new Map<string, any>(defaults.map((d) => [d.id, d]));
    saved.forEach((row) => entries.set(row.id, { ...row.definition, ...CUSTOMER_LABELS[row.id], id: row.id }));
    return [...entries.values()]
      .map(applyRequirements)
      .filter((d) => all || d.enabled !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  async get(id: string) {
    return (await this.list()).find((d) => d.id === id);
  }
  async save(id: string, data: any) {
    if (
      !/^[a-z0-9-]{1,40}$/.test(id) ||
      !data ||
      typeof data.label !== 'string' ||
      !data.label.trim() ||
      !Array.isArray(data.fields) ||
      !Array.isArray(data.issues) ||
      !data.issues.length ||
      !Array.isArray(data.modes) ||
      !data.modes.length ||
      data.modes.some(
        (m) =>
          !['PICKUP', 'CARRY_IN', 'ON_SITE', 'REMOTE', 'CONSULTATION'].includes(
            m,
          ),
      )
    ) {
      throw new BadRequestException(
        'A service needs a name, questions, issues and valid service modes',
      );
    }
    for (const field of data.fields) {
      if (
        !field.id ||
        !field.label ||
        !['text', 'number', 'select', 'multi'].includes(field.type) ||
        (['select', 'multi'].includes(field.type) &&
          (!Array.isArray(field.options) || !field.options.length))
      ) {
        throw new BadRequestException('Invalid question definition');
      }
    }
    if (data.issues.some((i) => !i.id || !i.label))
      throw new BadRequestException('Each issue needs an ID and label');
    const definition = applyRequirements({ ...data, id });
    await this.repo.save({ id, definition });
    return definition;
  }
}
@Controller('catalog')
export class CatalogController {
  constructor(private service: CatalogService) {}
  @Get() list() {
    return this.service.list();
  }
  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  all() {
    return this.service.list(true);
  }
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.OPERATIONS)
  save(@Param('id') id: string, @Body() data: any) {
    return this.service.save(id, data);
  }
}
@Module({
  imports: [TypeOrmModule.forFeature([ServiceDefinition])],
  providers: [CatalogService],
  controllers: [CatalogController],
  exports: [CatalogService],
})
export class CatalogModule {}
