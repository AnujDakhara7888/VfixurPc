'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Megaphone, Plus, Save, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const blank = () => ({
  title: '', shortDescription: '', offerType: 'FIXED_DISCOUNT', discountValue: 150,
  maximumDiscountCap: 150, minimumBillingAmount: 999, eligibleServiceCategories: [],
  eligibleCustomerSegment: 'ALL_CUSTOMERS', inactiveDays: 90,
  startAt: new Date().toISOString().slice(0, 16), expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
  promoCode: '', active: false, usageLimitPerCustomer: 1, deepLinkDestination: 'offer', ctaLabel: 'Book Now',
  pushTitle: 'Up to ₹150 OFF on your next repair', pushBody: 'Book your next Vfixurpc repair through the app and save up to ₹150 on eligible services.',
  whatsappTemplateName: '', whatsappLanguage: 'en', whatsappParameters: ['{{name}}', '{{title}}', '{{code}}'],
});
const categories = ['laptop','desktop','mac','data','upgrade','virus','network','cctv','backup','custom','business'];
const editableOfferFields = [
  'title', 'shortDescription', 'offerType', 'discountValue', 'maximumDiscountCap',
  'minimumBillingAmount', 'eligibleServiceCategories', 'eligibleCustomerSegment',
  'inactiveDays', 'promoCode', 'active', 'usageLimitPerCustomer',
  'deepLinkDestination', 'ctaLabel', 'pushTitle', 'pushBody',
  'whatsappTemplateName', 'whatsappLanguage', 'whatsappParameters',
] as const;

function offerPayload(draft: any) {
  const payload = Object.fromEntries(editableOfferFields.map(field => [field, draft[field]]));
  return {
    ...payload,
    startAt: new Date(draft.startAt).toISOString(),
    expiresAt: new Date(draft.expiresAt).toISOString(),
  };
}

export default function OffersPage() {
  const qc = useQueryClient();
  const { data = [], isError } = useQuery({ queryKey: ['offers-admin'], queryFn: () => api.get('/offers/admin').then(r => r.data) });
  const [draft, setDraft] = useState<any>(); const [busy, setBusy] = useState(false);
  const update = (key: string, value: any) => setDraft((d: any) => ({ ...d, [key]: value }));
  async function save() {
    setBusy(true);
    try {
      const payload = offerPayload(draft);
      draft.id ? await api.patch('/offers/' + draft.id, payload) : await api.post('/offers', payload);
      await qc.invalidateQueries({ queryKey: ['offers-admin'] }); toast.success('Offer saved'); setDraft(undefined);
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Could not save offer'); } finally { setBusy(false); }
  }
  async function send(id: string, channels: ('PUSH'|'WHATSAPP')[]) {
    if (!confirm(`Send this offer by ${channels.join(' + ')} to eligible customers who opted in? The weekly frequency limit will be enforced.`)) return;
    setBusy(true); try { const { data: result } = await api.post(`/offers/${id}/send`, { channels }); toast.success(`Push ${result.pushSent}; WhatsApp ${result.whatsappSent}; ${result.skippedFrequency} frequency-limited`); }
    catch (e: any) { toast.error(e.response?.data?.message ?? 'Campaign could not be sent'); } finally { setBusy(false); }
  }
  return <div className="p-4 sm:p-8 max-w-6xl mx-auto">
    <div className="flex items-center justify-between mb-7"><div><p className="text-xs font-bold text-blue-700 uppercase">Customer re-engagement</p><h1 className="text-2xl font-bold">Offers & campaigns</h1><p className="text-sm text-gray-500 mt-1">You control every offer. Saving never sends a notification; use Send now when the audience and timing are ready.</p></div><button onClick={() => setDraft(blank())} className="flex items-center gap-2 bg-brand-800 text-white px-4 py-3 rounded-lg"><Plus size={18}/>New offer</button></div>
    {isError && <p>Could not load offers.</p>}
    <div className="grid lg:grid-cols-[340px_1fr] gap-6">
      <div className="space-y-3">{data.map((offer:any)=><button key={offer.id} onClick={()=>setDraft({...blank(),...offer,startAt:offer.startAt.slice(0,16),expiresAt:offer.expiresAt.slice(0,16)})} className={`w-full text-left bg-white border rounded-lg p-4 hover:border-blue-300 ${draft?.id === offer.id ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}><div className="flex justify-between gap-2"><span className="font-bold">{offer.title}</span><span className={`text-xs font-bold ${offer.active?'text-green-700':'text-gray-400'}`}>{offer.active?'ACTIVE':'DRAFT'}</span></div><p className="text-sm text-gray-500 mt-2 line-clamp-2">{offer.shortDescription}</p><p className="text-xs text-gray-400 mt-3">Expires {new Date(offer.expiresAt).toLocaleDateString('en-IN')}</p></button>)}</div>
      {draft ? <section className="bg-white border rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-center"><Megaphone className="text-blue-700"/><h2 className="text-xl font-bold flex-1">{draft.id?'Edit offer':'New offer'}</h2>{draft.id&&<><button disabled={busy||!draft.active} onClick={()=>send(draft.id,['PUSH'])} className="flex gap-2 border px-3 py-2 rounded-lg disabled:opacity-40"><Send size={17}/>Send push</button><button disabled={busy||!draft.active||!draft.whatsappTemplateName} onClick={()=>send(draft.id,['WHATSAPP'])} className="flex gap-2 border px-3 py-2 rounded-lg disabled:opacity-40"><Send size={17}/>Send WhatsApp</button></>}<button disabled={busy} onClick={save} className="flex gap-2 bg-brand-800 text-white px-3 py-2 rounded-lg"><Save size={17}/>Save</button></div>
        <Field label="Offer title"><input value={draft.title} onChange={e=>update('title',e.target.value)}/></Field>
        <Field label="One-line benefit"><input value={draft.shortDescription} onChange={e=>update('shortDescription',e.target.value)}/></Field>
        <div className="grid sm:grid-cols-3 gap-3"><Field label="Type"><select value={draft.offerType} onChange={e=>update('offerType',e.target.value)}>{['FIXED_DISCOUNT','PERCENTAGE','FREE_ADD_ON','CONSULTATION'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Discount value"><input type="number" value={draft.discountValue} onChange={e=>update('discountValue',+e.target.value)}/></Field><Field label="Maximum benefit"><select value={draft.maximumDiscountCap} onChange={e=>update('maximumDiscountCap',+e.target.value)}><option value={0}>None</option><option value={150}>₹150</option><option value={250}>₹250</option></select></Field></div>
        <div className="grid sm:grid-cols-3 gap-3"><Field label="Minimum bill"><input type="number" value={draft.minimumBillingAmount} onChange={e=>update('minimumBillingAmount',+e.target.value)}/></Field><Field label="Customer segment"><select value={draft.eligibleCustomerSegment} onChange={e=>update('eligibleCustomerSegment',e.target.value)}>{['ALL_CUSTOMERS','RETURNING_CUSTOMERS','INACTIVE_CUSTOMERS'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Usage per customer"><input type="number" min="1" value={draft.usageLimitPerCustomer} onChange={e=>update('usageLimitPerCustomer',+e.target.value)}/></Field></div>
        <div className="grid sm:grid-cols-2 gap-3"><Field label="Starts"><input type="datetime-local" value={draft.startAt} onChange={e=>update('startAt',e.target.value)}/></Field><Field label="Expires"><input type="datetime-local" value={draft.expiresAt} onChange={e=>update('expiresAt',e.target.value)}/></Field></div>
        <fieldset><legend className="text-sm font-semibold mb-2">Eligible services (none means all)</legend><div className="flex flex-wrap gap-3">{categories.map(c=><label key={c} className="text-sm flex gap-2"><input type="checkbox" checked={draft.eligibleServiceCategories.includes(c)} onChange={()=>update('eligibleServiceCategories',draft.eligibleServiceCategories.includes(c)?draft.eligibleServiceCategories.filter((x:string)=>x!==c):[...draft.eligibleServiceCategories,c])}/>{c}</label>)}</div></fieldset>
        <div className="grid sm:grid-cols-2 gap-3"><Field label="Customer promo code"><input required placeholder="e.g. SAVE150" value={draft.promoCode||''} onChange={e=>update('promoCode',e.target.value.toUpperCase())}/></Field><Field label="Button label"><input value={draft.ctaLabel} onChange={e=>update('ctaLabel',e.target.value)}/></Field></div>
        <Field label="Push title"><input value={draft.pushTitle} onChange={e=>update('pushTitle',e.target.value)}/></Field><Field label="Push message"><textarea rows={3} value={draft.pushBody} onChange={e=>update('pushBody',e.target.value)}/></Field>
        <div className="border-t pt-4"><h3 className="font-bold">WhatsApp template (optional)</h3><p className="text-sm text-gray-500 mt-1 mb-3">Uses an approved MSG91 marketing template and only contacts customers who opted in.</p><div className="grid sm:grid-cols-2 gap-3"><Field label="Approved template name"><input value={draft.whatsappTemplateName||''} onChange={e=>update('whatsappTemplateName',e.target.value)}/></Field><Field label="Language code"><input value={draft.whatsappLanguage||'en'} onChange={e=>update('whatsappLanguage',e.target.value)}/></Field></div><Field label="Template values (one per line; supports {{name}}, {{title}}, {{code}})"><textarea rows={4} value={(draft.whatsappParameters||[]).join('\n')} onChange={e=>update('whatsappParameters',e.target.value.split('\n').map(x=>x.trim()).filter(Boolean))}/></Field></div>
        <label className="flex items-center gap-3 font-semibold"><input type="checkbox" checked={draft.active} onChange={e=>update('active',e.target.checked)}/>Active and visible to eligible customers</label>
      </section>:<div className="border border-dashed rounded-lg flex items-center justify-center min-h-80 text-gray-400">Choose an offer or create one</div>}
    </div>
  </div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block text-sm font-semibold">{label}<span className="block mt-1 [&>*]:w-full [&>*]:border [&>*]:rounded-lg [&>*]:p-2 [&>*]:font-normal">{children}</span></label>}
