import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Tree, TreeChildren, TreeParent,
} from 'typeorm';

@Entity('faq_nodes')
export class FaqNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FaqNode, (node) => node.id, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: FaqNode;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string;

  @Column()
  question: string;

  @Column({ type: 'text', nullable: true })
  answer: string;

  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @Column({ name: 'escalate_to_booking', default: false })
  escalateToBooking: boolean;
}
