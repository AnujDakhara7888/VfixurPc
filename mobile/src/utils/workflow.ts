import type { ServiceRequest, SRStatus } from '@/types';

type Stage = { label: string; statuses: SRStatus[]; detail: string };

const FIELD_SERVICES = new Set(['cctv', 'network', 'backup', 'custom', 'business']);

function fieldStages(category?: string): Stage[] | null {
  const shared: Record<string, Stage[]> = {
    cctv: [
      { label: 'Request received', statuses: ['REQUEST_RECEIVED'], detail: 'Your CCTV request has been received.' },
      { label: 'Site visit scheduled', statuses: ['PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED_AT_WORKSHOP'], detail: 'Our technician will visit at the confirmed time.' },
      { label: 'Site survey', statuses: ['DIAGNOSING', 'DIAGNOSED'], detail: 'Coverage, wiring and equipment needs are being assessed.' },
      { label: 'Proposal approval', statuses: ['QUOTATION_SHARED', 'QUOTE_APPROVED', 'QUOTE_REJECTED'], detail: 'Review the recommended setup and quotation.' },
      { label: 'Equipment & scheduling', statuses: ['PAYMENT_RECEIVED', 'AWAITING_PARTS'], detail: 'Equipment and installation timing are being arranged.' },
      { label: 'Installation in progress', statuses: ['UNDER_REPAIR'], detail: 'Your CCTV system is being installed or serviced.' },
      { label: 'Testing & handover', statuses: ['TESTING', 'REPAIR_COMPLETE', 'READY_FOR_HANDOVER', 'OUT_FOR_DELIVERY'], detail: 'Camera coverage, recording and access are being verified.' },
      { label: 'Completed', statuses: ['DELIVERED'], detail: 'Installation and handover are complete.' },
    ],
    network: [
      { label: 'Request received', statuses: ['REQUEST_RECEIVED'], detail: 'Your infrastructure request has been received.' },
      { label: 'Site assessment', statuses: ['PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED_AT_WORKSHOP', 'DIAGNOSING', 'DIAGNOSED'], detail: 'Layout, coverage, cabling and capacity are being assessed.' },
      { label: 'Design & quotation', statuses: ['QUOTATION_SHARED', 'QUOTE_APPROVED', 'QUOTE_REJECTED'], detail: 'Review the recommended infrastructure plan.' },
      { label: 'Equipment & scheduling', statuses: ['PAYMENT_RECEIVED', 'AWAITING_PARTS'], detail: 'Equipment and installation timing are being arranged.' },
      { label: 'Setup in progress', statuses: ['UNDER_REPAIR'], detail: 'Network infrastructure is being configured.' },
      { label: 'Connectivity testing', statuses: ['TESTING', 'REPAIR_COMPLETE', 'READY_FOR_HANDOVER', 'OUT_FOR_DELIVERY'], detail: 'Coverage, speed and security are being validated.' },
      { label: 'Completed', statuses: ['DELIVERED'], detail: 'Setup and handover are complete.' },
    ],
    backup: [
      { label: 'Request received', statuses: ['REQUEST_RECEIVED'], detail: 'Your backup and security request has been received.' },
      { label: 'Data & risk assessment', statuses: ['PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED_AT_WORKSHOP', 'DIAGNOSING', 'DIAGNOSED'], detail: 'Data volume, retention and recovery needs are being assessed.' },
      { label: 'Solution approval', statuses: ['QUOTATION_SHARED', 'QUOTE_APPROVED', 'QUOTE_REJECTED'], detail: 'Review the recommended protection plan.' },
      { label: 'Provisioning', statuses: ['PAYMENT_RECEIVED', 'AWAITING_PARTS'], detail: 'Storage, licenses and access are being prepared.' },
      { label: 'Backup configuration', statuses: ['UNDER_REPAIR'], detail: 'Backup and security controls are being configured.' },
      { label: 'Restore verification', statuses: ['TESTING', 'REPAIR_COMPLETE', 'READY_FOR_HANDOVER', 'OUT_FOR_DELIVERY'], detail: 'Backup integrity and recovery are being tested.' },
      { label: 'Completed', statuses: ['DELIVERED'], detail: 'Protection is active and handover is complete.' },
    ],
    custom: [
      { label: 'Requirements received', statuses: ['REQUEST_RECEIVED', 'PICKUP_SCHEDULED'], detail: 'Your custom PC requirements have been received.' },
      { label: 'Configuration review', statuses: ['PICKED_UP', 'RECEIVED_AT_WORKSHOP', 'DIAGNOSING', 'DIAGNOSED'], detail: 'Compatibility, performance and budget are being reviewed.' },
      { label: 'Build approval', statuses: ['QUOTATION_SHARED', 'QUOTE_APPROVED', 'QUOTE_REJECTED'], detail: 'Review the proposed configuration and quotation.' },
      { label: 'Parts procurement', statuses: ['PAYMENT_RECEIVED', 'AWAITING_PARTS'], detail: 'Approved components are being sourced.' },
      { label: 'Build in progress', statuses: ['UNDER_REPAIR'], detail: 'Your system is being assembled and configured.' },
      { label: 'Testing & handover', statuses: ['TESTING', 'REPAIR_COMPLETE', 'READY_FOR_HANDOVER', 'OUT_FOR_DELIVERY'], detail: 'Performance, thermals and stability are being verified.' },
      { label: 'Completed', statuses: ['DELIVERED'], detail: 'Your custom system is complete.' },
    ],
    business: [
      { label: 'Request received', statuses: ['REQUEST_RECEIVED'], detail: 'Your business IT request has been received.' },
      { label: 'IT assessment', statuses: ['PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED_AT_WORKSHOP', 'DIAGNOSING', 'DIAGNOSED'], detail: 'Your environment and support needs are being assessed.' },
      { label: 'Service plan approval', statuses: ['QUOTATION_SHARED', 'QUOTE_APPROVED', 'QUOTE_REJECTED'], detail: 'Review the proposed scope and quotation.' },
      { label: 'Resources & scheduling', statuses: ['PAYMENT_RECEIVED', 'AWAITING_PARTS'], detail: 'Resources and service timing are being arranged.' },
      { label: 'Implementation', statuses: ['UNDER_REPAIR'], detail: 'Approved IT work is in progress.' },
      { label: 'Validation & handover', statuses: ['TESTING', 'REPAIR_COMPLETE', 'READY_FOR_HANDOVER', 'OUT_FOR_DELIVERY'], detail: 'The solution and support handover are being validated.' },
      { label: 'Completed', statuses: ['DELIVERED'], detail: 'The requested IT work is complete.' },
    ],
  };
  return category ? shared[category] ?? null : null;
}

export function requestProgressTitle(sr: ServiceRequest) {
  return FIELD_SERVICES.has(sr.serviceCategory ?? '') ? 'Project progress' : 'Repair progress';
}

export function requestStages(sr: ServiceRequest) {
  const pickup = !sr.serviceMode || sr.serviceMode === 'PICKUP';
  const carryIn = sr.serviceMode === 'CARRY_IN';
  const consultation = sr.serviceMode === 'CONSULTATION';
  const collection = carryIn || sr.handoverMethod === 'CUSTOMER_COLLECTION';
  const stages: Stage[] = fieldStages(sr.serviceCategory) ?? [
    { label: 'Request received', statuses: ['REQUEST_RECEIVED', 'PICKUP_SCHEDULED'], detail: 'Your request has been received.' },
    ...(pickup || carryIn ? [{ label: pickup ? 'Device collected' : 'Device received', statuses: pickup ? ['PICKED_UP', 'RECEIVED_AT_WORKSHOP'] : ['RECEIVED_AT_WORKSHOP'], detail: pickup ? 'Your device has been collected.' : 'Your device is at the workshop.' } as Stage] : []),
    { label: consultation ? 'Requirements discussed' : 'Diagnosis complete', statuses: ['DIAGNOSING', 'DIAGNOSED'], detail: consultation ? 'Your requirements are being reviewed.' : 'Our technicians are checking the issue.' },
    { label: 'Quote approval', statuses: ['QUOTATION_SHARED', 'QUOTE_APPROVED', 'QUOTE_REJECTED'], detail: 'Review and decide on the repair quote.' },
    { label: consultation ? 'Service in progress' : 'Repair in progress', statuses: ['PAYMENT_RECEIVED', 'AWAITING_PARTS', 'UNDER_REPAIR'], detail: consultation ? 'Work is in progress.' : 'Our team is working on your device.' },
    ...(!consultation ? [{ label: 'Testing', statuses: ['TESTING', 'REPAIR_COMPLETE'], detail: 'Final quality checks are completed here.' } as Stage] : []),
    { label: collection ? 'Collection' : pickup ? 'Return to customer' : 'Completion', statuses: ['READY_FOR_HANDOVER', 'OUT_FOR_DELIVERY'], detail: collection ? 'Your device will be ready to collect.' : pickup ? 'Your device will be returned to you.' : 'The service will be completed.' },
    { label: 'Completed', statuses: ['DELIVERED'], detail: 'This request is complete.' },
  ];
  const history = [...(sr.statusHistory ?? [])].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const found = stages.findIndex(stage => stage.statuses.includes(sr.status));
  const currentIndex = found < 0 ? 0 : found;
  return stages.map((stage, index) => {
    const event = [...history].reverse().find(item => stage.statuses.includes(item.toStatus));
    const recorded = !!event || stage.statuses.includes(sr.status);
    return { ...stage, state: sr.status === 'CANCELLED' && index === currentIndex ? 'cancelled' : sr.status === 'DELIVERED' || (recorded && index < currentIndex) ? 'complete' : index === currentIndex ? 'current' : 'future', at: event?.createdAt, note: event?.notes };
  });
}
