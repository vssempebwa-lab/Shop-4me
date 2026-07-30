import type { Depot } from '../types';

export const OFFICIAL_DEPOTS: Depot[] = [
  {
    depot_code: 'DEPOT-KAW-01',
    name: 'Kalerwe Market',
    hub_market: 'Kalerwe Market',
    division: 'Kawempe Division',
    distribution_areas: ['Kawempe', 'Mpererwe', 'Komamboga', 'Kisaasi'],
    is_active: true,
  },
  {
    depot_code: 'DEPOT-NAK-02',
    name: 'Nakawa Market',
    hub_market: 'Nakawa Market',
    division: 'Nakawa Division',
    distribution_areas: ['Nakawa', 'Bugolobi', 'Luzira', 'Ntinda', 'Naguru'],
    is_active: true,
  },
  {
    depot_code: 'DEPOT-CEN-03',
    name: 'Nakasero Market',
    hub_market: 'Nakasero Market',
    division: 'Kampala Central',
    distribution_areas: ['Kololo', 'Nakasero', 'Kamwokya', 'Old Kampala'],
    is_active: true,
  },
  {
    depot_code: 'DEPOT-MAK-04',
    name: 'Kibuye Market',
    hub_market: 'Kibuye Market',
    division: 'Makindye Division',
    distribution_areas: ['Kibuye', 'Katwe', 'Kansanga', 'Kabalagala', 'Ggaba'],
    is_active: true,
  },
  {
    depot_code: 'DEPOT-RUB-05',
    name: 'Mengo Market',
    hub_market: 'Mengo Market',
    division: 'Rubaga Division',
    distribution_areas: ['Mengo', 'Lungujja', 'Rubaga', 'Kasubi', 'Ndeeba'],
    is_active: true,
  },
];

export function formatDepotOption(depot: Depot) {
  return `${depot.hub_market || depot.name} (${depot.depot_code}) - ${depot.division}`;
}

export function formatDistributionAreas(depot?: Depot | null) {
  if (!depot?.distribution_areas?.length) return '';
  return depot.distribution_areas.join(', ');
}

export function findDepotByCode(depots: Depot[], depotCode: string) {
  return depots.find((depot) => depot.depot_code === depotCode) ?? null;
}

export function suggestDepotFromText(depots: Depot[], ...values: Array<string | null | undefined>) {
  const searchText = values.filter(Boolean).join(' ').toLowerCase();
  if (!searchText) return depots[0] ?? null;

  const codeMatch = depots.find((depot) => searchText.includes(depot.depot_code.toLowerCase()));
  if (codeMatch) return codeMatch;

  const exactAreaMatch = depots.find((depot) =>
    depot.distribution_areas.some((area) => searchText.includes(area.toLowerCase())),
  );

  if (exactAreaMatch) return exactAreaMatch;

  const divisionMatch = depots.find((depot) => searchText.includes(depot.division.toLowerCase()));
  if (divisionMatch) return divisionMatch;

  const hubMatch = depots.find((depot) =>
    searchText.includes((depot.hub_market || depot.name).toLowerCase()),
  );

  return hubMatch ?? depots[0] ?? null;
}
