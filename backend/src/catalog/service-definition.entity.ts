import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('service_definitions')
export class ServiceDefinition {
  @PrimaryColumn() id: string;
  @Column({ type: 'jsonb' }) definition: Record<string, any>;
}
