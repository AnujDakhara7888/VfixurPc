import { NotificationsService } from './notifications.service';
import { NotificationType, Role } from '../common/enums';
jest.mock('axios',()=>({__esModule:true,default:{post:jest.fn()}}));
const mockSend = jest.fn();
jest.mock('firebase-admin/app',()=>({getApps:()=>[{}],initializeApp:jest.fn(),cert:jest.fn()}));
jest.mock('firebase-admin/messaging',()=>({getMessaging:()=>({send:mockSend})}));
describe('Notification inbox',()=>{
 const repo:any={create:jest.fn(v=>v),save:jest.fn(async v=>({...v,id:'event'})),update:jest.fn(),count:jest.fn(async()=>3),find:jest.fn(async()=>[])};
 const users:any={find:jest.fn(async()=>[]),findOne:jest.fn(async()=>null),update:jest.fn()};
 const config:any={get:jest.fn(()=>undefined)};
 const email:any={isConfigured:jest.fn(()=>false),send:jest.fn(async()=>{})};
 beforeEach(()=>jest.clearAllMocks());
 it('normalizes appointment dates before storing and sending customer messages', async()=>{
  const service=new NotificationsService(repo,users,config,{send:jest.fn()} as any,email);
  mockSend.mockResolvedValueOnce('accepted');
  await service.notify({id:'customer',role:Role.CUSTOMER,fcmToken:'native-test-token'} as any,'Appointment 2026-09-13T07:00:00Z','ticket');
  const message='Appointment Sun, 13 Sep 2026 · 12:30 PM';
  expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({message}));
  expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({notification:{title:'VfixurPC',body:message}}));
 });
 it('persists an unread event even when push credentials and tokens are absent',async()=>{
  const service=new NotificationsService(repo,users,config,{send:jest.fn()} as any,email);
  await service.notify({id:'customer'} as any,'Quote ready','ticket');
  expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({userId:'customer',serviceRequestId:'ticket',message:'Quote ready',type:NotificationType.PUSH}));
 });
 it('scopes mark-read updates to the authenticated user, including arbitrary event ids',async()=>{
  const service=new NotificationsService(repo,users,config,{send:jest.fn()} as any,email);
  await service.markRead('customer','other-users-event');
  expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({userId:'customer',id:'other-users-event'}),{readAt:expect.any(Date)});
 });
 it('sends browser push to staff even without a native token',async()=>{
  const push:any={send:jest.fn(async()=>{})};
  const service=new NotificationsService(repo,users,config,push,email);
  await service.notify({id:'admin',role:Role.SUPER_ADMIN} as any,'New booking','ticket');
  expect(push.send).toHaveBeenCalledWith('admin','event','ticket');
 });
 it('notifies each active admin and operations account',async()=>{
  users.find.mockResolvedValueOnce([{id:'one',role:Role.SUPER_ADMIN},{id:'two',role:Role.OPERATIONS}]);
  const service=new NotificationsService(repo,users,config,{send:jest.fn(async()=>{})} as any,email);
  await service.notifyAdmins('Customer activity');
  expect(repo.save).toHaveBeenCalledTimes(2);
  expect(service.emailSettings()).toEqual({configured:false});
 });
 it('sends Android native tokens directly through Firebase with a high-priority channel',async()=>{
  const service=new NotificationsService(repo,users,config,{send:jest.fn()} as any,email);
  mockSend.mockResolvedValueOnce('accepted');
  const result=await service.testNative({id:'customer',role:Role.CUSTOMER,fcmToken:'native-test-token'} as any);
  expect(result).toEqual({accepted:true});
  expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({token:'native-test-token',android:expect.objectContaining({priority:'high',notification:expect.objectContaining({channelId:'default',sound:'default'})})}));
 });
 it('reports provider failure rather than claiming a notification was delivered',async()=>{
  const service=new NotificationsService(repo,users,config,{send:jest.fn()} as any,email);
  mockSend.mockRejectedValueOnce({code:'messaging/registration-token-not-registered'});
  expect(await service.testNative({id:'customer',role:Role.CUSTOMER,fcmToken:'expired-test-token'} as any)).toEqual({accepted:false});
  expect(users.update).toHaveBeenCalledWith({id:'customer',fcmToken:'expired-test-token'},{fcmToken:''});
 });
 it('does not create a test alert when no device is registered',async()=>{
  const service=new NotificationsService(repo,users,config,{send:jest.fn()} as any,email);
  await expect(service.testNative({id:'customer'} as any)).rejects.toThrow('Enable notifications');
  expect(repo.save).not.toHaveBeenCalled();
 });
 it('sends staff email through the shared sender and retains inbox events on failure',async()=>{
  const settings:any={get:(key:string)=>({ADMIN_NOTIFICATION_EMAILS:'hriday@vfixurpc.com',ADMIN_PUBLIC_URL:'https://vfixur-pc.vercel.app'}[key])};
  const sender:any={isConfigured:()=>true,send:jest.fn().mockRejectedValue(new Error('provider unavailable'))};
  users.find.mockResolvedValueOnce([{id:'one',role:Role.SUPER_ADMIN}]);
  const service=new NotificationsService(repo,users,settings,{send:jest.fn(async()=>{})} as any,sender);
  await expect(service.notifyAdmins('New booking','ticket')).resolves.toBeUndefined();
  expect(sender.send).toHaveBeenCalledWith({to:['hriday@vfixurpc.com'],subject:'VfixurPC: customer update',text:'New booking\n\nhttps://vfixur-pc.vercel.app/dashboard/service-requests/ticket'});
  expect(repo.save).toHaveBeenCalledTimes(1);
  expect(service.emailSettings()).toEqual({configured:true});
 });
});
