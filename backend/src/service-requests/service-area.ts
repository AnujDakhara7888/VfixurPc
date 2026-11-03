import { BadRequestException } from '@nestjs/common';

export const SERVICE_AREA_LOCALITIES = [
  'Irla',
  'Vile Parle East',
  'Vile Parle West',
  'Juhu',
  'Santacruz East',
  'Santacruz West',
  'Andheri East',
  'Andheri West',
  'DN Nagar',
  'Versova',
  'Lokhandwala',
  'Khar',
  'Kalina',
  'Vakola',
  'Bandra East',
  'Bandra West',
  'Jogeshwari East',
  'Jogeshwari West',
  'Oshiwara',
  'Goregaon East',
  'Goregaon West',
  'Malad East',
  'Malad West',
  'Bangur Nagar',
  'Aarey',
  'BKC',
  'Kurla',
  'Marol',
  'Saki Naka',
  'Chandivali',
  'Powai',
  'Ghatkopar East',
  'Ghatkopar West',
  'Vikhroli',
  'Chembur',
  'Mahim',
  'Dharavi',
  'Sion',
  'Matunga',
  'Dadar East',
  'Dadar West',
  'Wadala',
  'Kandivali East',
  'Kandivali West',
  'Charkop',
  'Borivali East',
  'Borivali West',
  'Prabhadevi',
  'Worli',
  'Lower Parel',
  'Parel',
  'Sewri',
] as const;

const LOCALITY_ALIASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Vile Parle East', ['vile parle east', 'vileparle east']],
  ['Vile Parle West', ['vile parle west', 'vileparle west']],
  ['Santacruz East', ['santacruz east', 'santa cruz east']],
  ['Santacruz West', ['santacruz west', 'santa cruz west']],
  ['DN Nagar', ['dn nagar', 'd n nagar']],
  ['Lokhandwala', ['lokhandwala']],
  ['BKC', ['bkc', 'bandra kurla complex']],
  ['Saki Naka', ['saki naka', 'sakinaka']],
  ['Bangur Nagar', ['bangur nagar', 'bangur']],
  ...SERVICE_AREA_LOCALITIES
    .filter(locality => !['Vile Parle East', 'Vile Parle West', 'Santacruz East', 'Santacruz West', 'DN Nagar', 'Lokhandwala', 'BKC', 'Saki Naka', 'Bangur Nagar'].includes(locality))
    .map(locality => [locality, [locality.toLowerCase()]] as const),
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findServiceAreaLocality(address: string): string | null {
  const normalized = ` ${normalize(address)} `;
  if (normalized.length < 5) return null;
  for (const [locality, aliases] of LOCALITY_ALIASES) {
    if (aliases.some(alias => normalized.includes(` ${normalize(alias)} `))) return locality;
  }
  return null;
}

export function isInServiceArea(address: string): boolean {
  return !!findServiceAreaLocality(address);
}

export function assertInServiceArea(address: string) {
  if (!isInServiceArea(address)) {
    throw new BadRequestException(
      'Pickup and delivery are unavailable at this address. Choose workshop drop-off or contact VfixurPC support.',
    );
  }
}
