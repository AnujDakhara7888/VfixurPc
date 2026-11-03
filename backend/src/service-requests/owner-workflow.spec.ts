import { ServiceRequestsService } from './service-requests.service';
import { ServiceRequestStatus,Role } from '../common/enums';
import { ServiceRequest } from './entities/service-request.entity';
describe('Quotation decisions',()=>{
 let sr:any,em:any,service:ServiceRequestsService;
 beforeEach(()=>{
  sr={id:'ticket',customerId:'owner',customer:{id:'owner'},status:ServiceRequestStatus.QUOTATION_SHARED,quoteVersion:2,quoteArchive:[],serviceRequestNumber:'VFX-TEST'};
  em={findOne:jest.fn(async()=>sr),find:jest.fn(async()=>[{description:'Repair',total:100,taxRate:18}]),save:jest.fn(async x=>x),create:jest.fn((entity,data)=>data)};
  service=new ServiceRequestsService({findOne:jest.fn(async()=>sr)} as any,{} as any,{} as any,{transaction:async(fn:any)=>fn(em)} as any,{notifyAdmins:jest.fn(async()=>{}),notify:jest.fn(async()=>{})} as any,{} as any,{} as any);
 });
 it('rejects an approval of an obsolete quote version',async()=>{
  await expect(service.approveQuote('ticket','owner',1)).rejects.toThrow('quotation changed');
  expect(em.save).not.toHaveBeenCalled();
 });
 it('records the exact amount, version, customer and decision timestamp',async()=>{
  await service.approveQuote('ticket','owner',2);
  expect(sr.status).toBe(ServiceRequestStatus.QUOTE_APPROVED);
  expect(sr.quoteArchive[0]).toEqual(expect.objectContaining({version:2,amount:118,actorId:'owner',action:'APPROVED',timestamp:expect.any(String)}));
  expect(em.findOne).toHaveBeenCalledWith(ServiceRequest,expect.objectContaining({lock:{mode:'pessimistic_write'}}));
 });
 it('rejects another customer approval',async()=>{
  await expect(service.approveQuote('ticket','other',2)).rejects.toThrow();
  expect(em.save).not.toHaveBeenCalled();
 });
 it('moves a rejection into return workflow without inventing a diagnosis fee',async()=>{
  sr.serviceMode='PICKUP';
  await service.rejectQuote('ticket','owner','Please return',2);
  expect(sr.status).toBe(ServiceRequestStatus.QUOTE_REJECTED);
  expect(sr.diagnosisFeeApplied).toBe(false);
  expect(sr.handoverMethod).toBe('DELIVERY');
  expect(sr.returnDeliveryFeeTotal).toBeNull();
  await expect(service.approveQuote('ticket','owner',2)).rejects.toThrow('No pending');
 });
 it('records free workshop collection separately from diagnosis',async()=>{
  sr.serviceMode='CARRY_IN';
  await service.rejectQuote('ticket','owner','Please return',2,'CUSTOMER_COLLECTION');
  expect(sr.handoverMethod).toBe('CUSTOMER_COLLECTION');
  expect(sr.returnDeliveryFeeTotal).toBeNull();
 });
 it('requires an address and records paid return delivery for carry-in',async()=>{
  sr.serviceMode='CARRY_IN';
  await expect(service.rejectQuote('ticket','owner','Please return',2,'PAID_RETURN_DELIVERY','')).rejects.toThrow('address');
  sr.status=ServiceRequestStatus.QUOTATION_SHARED;
  await service.rejectQuote('ticket','owner','Please return',2,'PAID_RETURN_DELIVERY','Flat 4, Vile Parle West, Mumbai');
  expect(sr.handoverMethod).toBe('DELIVERY');
  expect(sr.pickupAddress).toBe('Flat 4, Vile Parle West, Mumbai');
  expect(sr.returnDeliveryFeeTotal).toBe(590);
 });
  it('rejects paid return delivery outside the supported area',async()=>{
    sr.serviceMode='CARRY_IN';
    await expect(service.rejectQuote('ticket','owner','Please return',2,'PAID_RETURN_DELIVERY','Thane West')).rejects.toThrow('workshop drop-off');
  });
});
