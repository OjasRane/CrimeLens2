export type MapDensityPoint = {
  coordinates: [number, number];
  weight: number;
};

export type MapMovementRoute = {
  id: string;
  label: string;
  inbound: number;
  outbound: number;
  from: { coordinates: [number, number] };
  to: { coordinates: [number, number] };
};

export const densitySeedPoints: MapDensityPoint[] = [
  { coordinates: [-87.6285, 41.884], weight: 8 },
  { coordinates: [-87.632, 41.879], weight: 5 },
  { coordinates: [-87.6231, 41.8822], weight: 3 },
  { coordinates: [-87.6198, 41.8894], weight: 7 },
  { coordinates: [-87.6142, 41.8757], weight: 10 },
  { coordinates: [-87.641, 41.8866], weight: 8 },
  { coordinates: [-87.6367, 41.8921], weight: 4 },
  { coordinates: [-87.61, 41.8695], weight: 9 },
  { coordinates: [-87.6465, 41.8786], weight: 6 },
  { coordinates: [-87.6391, 41.8738], weight: 5 },
  { coordinates: [-87.6287, 41.875], weight: 9 },
  { coordinates: [-87.6209, 41.8795], weight: 3 },
  { coordinates: [-87.6173, 41.8838], weight: 8 },
  { coordinates: [-87.6501, 41.882], weight: 6 },
  { coordinates: [-87.6338, 41.8905], weight: 7 },
  { coordinates: [-87.6117, 41.8724], weight: 5 },
  { coordinates: [-87.6261, 41.8912], weight: 4 },
  { coordinates: [-87.6429, 41.8847], weight: 7 },
];

export const movementRoutes: MapMovementRoute[] = [
  {
    id: "route-ada-archive",
    label: "Ada Cross / archive trace",
    inbound: 120,
    outbound: 28,
    from: { coordinates: [-87.6285, 41.884] },
    to: { coordinates: [-87.6142, 41.8757] },
  },
  {
    id: "route-ada-fire",
    label: "Evidence room / loading dock",
    inbound: 86,
    outbound: 42,
    from: { coordinates: [-87.6142, 41.8757] },
    to: { coordinates: [-87.61, 41.8695] },
  },
  {
    id: "route-marlowe-stairwell",
    label: "Night clerk stairwell loop",
    inbound: 64,
    outbound: 74,
    from: { coordinates: [-87.632, 41.879] },
    to: { coordinates: [-87.641, 41.8866] },
  },
  {
    id: "route-vale-ledger",
    label: "Ledger mismatch transfer",
    inbound: 144,
    outbound: 22,
    from: { coordinates: [-87.6231, 41.8822] },
    to: { coordinates: [-87.6429, 41.8847] },
  },
  {
    id: "route-market-canal",
    label: "Canal street movement",
    inbound: 78,
    outbound: 38,
    from: { coordinates: [-87.6338, 41.8905] },
    to: { coordinates: [-87.6391, 41.8738] },
  },
  {
    id: "route-viaduct-arcade",
    label: "Viaduct to arcade",
    inbound: 52,
    outbound: 80,
    from: { coordinates: [-87.6501, 41.882] },
    to: { coordinates: [-87.6198, 41.8894] },
  },
];
