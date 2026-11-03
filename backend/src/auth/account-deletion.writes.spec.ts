import { ForbiddenException } from '@nestjs/common';
import { AttachmentsService } from '../attachments/attachments.module';
import { DevicesService } from '../devices/devices.service';
import { Role } from '../common/enums';

describe('Customer writes serialized with account deletion', () => {
  const user = { id: 'customer', role: Role.CUSTOMER } as any;
  const file = { buffer: Buffer.from([255, 216, 255, 0]), size: 4 } as Express.Multer.File;
  let rows: any[];
  let query: jest.Mock;
  let transactional: any;
  let repo: any;
  let notifications: any;
  let attachments: AttachmentsService;
  let devices: DevicesService;
  beforeEach(() => {
    rows = [{ is_active: true }];
    query = jest.fn(async () => rows);
    transactional = {
      create: jest.fn(value => value), save: jest.fn(async value => ({ id: 'saved', ...value })),
      count: jest.fn(async () => 0), remove: jest.fn(),
      findOne: jest.fn(async () => ({ id: 'device', customerId: user.id, brand: 'Original' })),
    };
    const em = { query, getRepository: jest.fn(() => transactional) };
    repo = { manager: { transaction: jest.fn(work => work(em)) }, findOne: transactional.findOne };
    notifications = { notify: jest.fn(async () => {}), notifyAdmins: jest.fn(async () => {}) };
    const requests = { findOne: jest.fn(async () => ({ id: 'ticket', customerId: user.id, customer: user, serviceRequestNumber: 'TEST-1' })) };
    attachments = new AttachmentsService(repo, requests as any, notifications);
    devices = new DevicesService(repo);
  });

  it.each(['create', 'update', 'remove'])('locks the customer before a device %s write', async operation => {
    if (operation === 'create') await devices.create({ brand: 'Dell', model: 'Laptop' }, user.id);
    else if (operation === 'update') await devices.update('device', { brand: 'New' }, user);
    else await devices.remove('device', user);
    expect(query).toHaveBeenCalledWith('SELECT is_active FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    const write = operation === 'remove' ? transactional.remove : transactional.save;
    expect(query.mock.invocationCallOrder[0]).toBeLessThan(write.mock.invocationCallOrder[0]);
    expect(repo.manager.transaction).toHaveBeenCalledTimes(1);
  });

  it.each(['create', 'update', 'remove', 'upload'])('rejects %s from an already-authenticated customer after deletion wins the lock', async operation => {
    rows = [{ is_active: false }];
    const run = operation === 'create' ? devices.create({ brand: 'Dell', model: 'Laptop' }, user.id)
      : operation === 'update' ? devices.update('device', { brand: 'Personal' }, user)
      : operation === 'remove' ? devices.remove('device', user)
      : attachments.upload('ticket', file, 'Personal photo', user);
    await expect(run).rejects.toBeInstanceOf(ForbiddenException);
    expect(transactional.save).not.toHaveBeenCalled();
    expect(transactional.remove).not.toHaveBeenCalled();
    expect(notifications.notifyAdmins).not.toHaveBeenCalled();
  });

  it('preserves normal upload bytes, caption and notifications while omitting bytes from the response', async () => {
    const result = await attachments.upload('ticket', file, 'Device condition', user);
    expect(query).toHaveBeenCalledWith('SELECT is_active FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    expect(transactional.save).toHaveBeenCalledWith(expect.objectContaining({ fileData: file.buffer, caption: 'Device condition', mime: 'image/jpeg', uploadedBy: user.id }));
    expect(query.mock.invocationCallOrder[0]).toBeLessThan(transactional.save.mock.invocationCallOrder[0]);
    expect(result).not.toHaveProperty('fileData');
    expect(notifications.notifyAdmins).toHaveBeenCalledTimes(1);
  });

  it('checks the attachment limit inside the locked transaction', async () => {
    transactional.count.mockResolvedValue(30);
    await expect(attachments.upload('ticket', file, '', user)).rejects.toThrow('Maximum 30');
    expect(transactional.save).not.toHaveBeenCalled();
  });

  it('prevents staff from recreating general media on a deleted customer ticket', async () => {
    rows = [{ is_active: false }];
    await expect(attachments.upload('ticket', file, '', { id: 'staff', role: Role.OPERATIONS } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(transactional.save).not.toHaveBeenCalled();
  });

  it('keeps ownership restrictions and media validation', async () => {
    await expect(attachments.upload('ticket', file, '', { id: 'other', role: Role.CUSTOMER } as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(devices.update('device', { brand: 'New' }, { id: 'other', role: Role.CUSTOMER } as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attachments.upload('ticket', { buffer: Buffer.from('invalid'), size: 7 } as any, '', user)).rejects.toThrow('Upload JPG');
    expect(repo.manager.transaction).not.toHaveBeenCalled();
  });
});
