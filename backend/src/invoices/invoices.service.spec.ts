import { InvoicesService } from './invoices.service';
import { Role } from '../common/enums';
describe('Uploaded documents',()=>{
 const repo:any={create:(v:any)=>v,save:jest.fn(async v=>({...v,id:'invoice'}))};
 const requests:any={findOne:jest.fn(async()=>({id:'ticket',customerId:'owner',customer:{id:'owner',name:'Customer'},serviceRequestNumber:'VFX-TEST'}))};
 const notifications:any={notify:jest.fn(async()=>{})};
 const staff:any={id:'admin',role:Role.SUPER_ADMIN};
 beforeEach(()=>jest.clearAllMocks());
 it('denies another customer access to ticket documents',async()=>{
  const s=new InvoicesService(repo,requests,notifications);
  await expect(s.assertAccess('ticket',{id:'stranger',role:Role.CUSTOMER} as any)).rejects.toThrow();
 });
 it('rejects files that only pretend to be PDFs',async()=>{
  const s=new InvoicesService(repo,requests,notifications);
  await expect(s.upload('ticket',{buffer:Buffer.from('<html>'),size:6,mimetype:'application/pdf'} as any,'INV-1','Invoice',staff)).rejects.toThrow('Upload a PDF');
  expect(repo.save).not.toHaveBeenCalled();
 });
 it('retains the exact uploaded PDF and excludes bytes from the API metadata',async()=>{
  const s=new InvoicesService(repo,requests,notifications),buffer=Buffer.from('%PDF-1.4 test');
  const result=await s.upload('ticket',{buffer,size:buffer.length,originalname:'customer-invoice.pdf'} as any,'INV-1','Receipt',staff);
  expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({fileData:buffer,invoiceNumber:'INV-1',documentKind:'Receipt',originalFilename:'customer-invoice.pdf',uploadedBy:'admin'}));
  expect(result).not.toHaveProperty('fileData');
  expect(notifications.notify).toHaveBeenCalled();
 });
 it('turns a duplicate document reference into a clear conflict response',async()=>{
  repo.save.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
  const s=new InvoicesService(repo,requests,notifications),buffer=Buffer.from('%PDF-1.4 test');
  await expect(s.upload('ticket',{buffer,size:buffer.length,originalname:'invoice.pdf'} as any,'INV-1','Invoice',staff)).rejects.toThrow('document reference is already in use');
 });
});
