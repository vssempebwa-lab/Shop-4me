import type { Outlet } from '../types';

export const OFFICIAL_OUTLETS: Outlet[] = [
  {
    outlet_code: 'DEPOT-KAW-01',
    name: 'Kalerwe Market',
    hub_market: 'Kalerwe Market',
    division: 'Kawempe Division',
    distribution_areas: ['Kawempe', 'Mpererwe', 'Komamboga', 'Kisaasi'],
    is_active: true,
  },
  {
    outlet_code: 'DEPOT-NAK-02',
    name: 'Nakawa Market',
    hub_market: 'Nakawa Market',
    division: 'Nakawa Division',
    distribution_areas: ['Nakawa', 'Bugolobi', 'Luzira', 'Ntinda', 'Naguru'],
    is_active: true,
  },
  {
    outlet_code: 'DEPOT-CEN-03',
    name: 'Nakasero Market',
    hub_market: 'Nakasero Market',
    division: 'Kampala Central',
    distribution_areas: ['Kololo', 'Nakasero', 'Kamwokya', 'Old Kampala'],
    is_active: true,
  },
  {
    outlet_code: 'DEPOT-MAK-04',
    name: 'Kibuye Market',
    hub_market: 'Kibuye Market',
    division: 'Makindye Division',
    distribution_areas: ['Kibuye', 'Katwe', 'Kansanga', 'Kabalagala', 'Ggaba'],
    is_active: true,
  },
  {
    outlet_code: 'DEPOT-RUB-05',
    name: 'Mengo Market',
    hub_market: 'Mengo Market',
    division: 'Rubaga Division',
    distribution_areas: ['Mengo', 'Lungujja', 'Rubaga', 'Kasubi', 'Ndeeba'],
    is_active: true,
  },
];

export function formatOutletOption(outlet: Outlet) {
  return `${outlet.hub_market || outlet.name} (${outlet.outlet_code}) - ${outlet.division}`;
}

export function formatDistributionAreas(outlet?: Outlet | null) {
  if (!outlet?.distribution_areas?.length) return '';
  return outlet.distribution_areas.join(', ');
}

export function findOutletByCode(outlets: Outlet[], outletCode: string) {
  return outlets.find((outlet) => outlet.outlet_code === outletCode) ?? null;
}

export function suggestOutletFromText(outlets: Outlet[], ...values: Array<string | null | undefined>) {
  const searchText = values.filter(Boolean).join(' ').toLowerCase();
  if (!searchText) return outlets[0] ?? null;

  const codeMatch = outlets.find((outlet) => searchText.includes(outlet.outlet_code.toLowerCase()));
  if (codeMatch) return codeMatch;

  const exactAreaMatch = outlets.find((outlet) =>
    outlet.distribution_areas.some((area) => searchText.includes(area.toLowerCase())),
  );

  if (exactAreaMatch) return exactAreaMatch;

  const divisionMatch = outlets.find((outlet) => searchText.includes(outlet.division.toLowerCase()));
  if (divisionMatch) return divisionMatch;

  const hubMatch = outlets.find((outlet) =>
    searchText.includes((outlet.hub_market || outlet.name).toLowerCase()),
  );

  return hubMatch ?? outlets[0] ?? null;
}
