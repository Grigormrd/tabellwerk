/**
 * The SMARD series in the demo. Keys are our own ids; `filter` and `region`
 * are SMARD's. Energy is MWh per hour, prices EUR/MWh, as SMARD publishes
 * them in its hourly files.
 */
export interface SeriesDefinition {
  filter: number;
  region: "DE" | "DE-LU";
  label: string;
  /** Shorter text for the column header, when the label is long. */
  header?: string;
  unit: "EUR/MWh" | "MWh";
  /** Decimals kept in the recorded file: cents for prices, whole MWh for energy. */
  decimals: 0 | 2;
  group: "Market" | "Consumption" | "Renewable generation" | "Conventional generation";
}

export const SERIES = {
  price: {
    filter: 4169,
    region: "DE-LU",
    label: "Day-ahead price",
    header: "Price",
    unit: "EUR/MWh",
    decimals: 2,
    group: "Market",
  },
  load: {
    filter: 410,
    region: "DE",
    label: "Load",
    unit: "MWh",
    decimals: 0,
    group: "Consumption",
  },
  solar: {
    filter: 4068,
    region: "DE",
    label: "Solar",
    unit: "MWh",
    decimals: 0,
    group: "Renewable generation",
  },
  windOnshore: {
    filter: 4067,
    region: "DE",
    label: "Wind onshore",
    unit: "MWh",
    decimals: 0,
    group: "Renewable generation",
  },
  windOffshore: {
    filter: 1225,
    region: "DE",
    label: "Wind offshore",
    unit: "MWh",
    decimals: 0,
    group: "Renewable generation",
  },
  biomass: {
    filter: 4066,
    region: "DE",
    label: "Biomass",
    unit: "MWh",
    decimals: 0,
    group: "Renewable generation",
  },
  hydro: {
    filter: 1226,
    region: "DE",
    label: "Hydro",
    unit: "MWh",
    decimals: 0,
    group: "Renewable generation",
  },
  otherRenewables: {
    filter: 1228,
    region: "DE",
    label: "Other renewables",
    unit: "MWh",
    decimals: 0,
    group: "Renewable generation",
  },
  lignite: {
    filter: 1223,
    region: "DE",
    label: "Lignite",
    unit: "MWh",
    decimals: 0,
    group: "Conventional generation",
  },
  hardCoal: {
    filter: 4069,
    region: "DE",
    label: "Hard coal",
    unit: "MWh",
    decimals: 0,
    group: "Conventional generation",
  },
  gas: {
    filter: 4071,
    region: "DE",
    label: "Natural gas",
    unit: "MWh",
    decimals: 0,
    group: "Conventional generation",
  },
  nuclear: {
    filter: 1224,
    region: "DE",
    label: "Nuclear",
    unit: "MWh",
    decimals: 0,
    group: "Conventional generation",
  },
  pumpedStorage: {
    filter: 4070,
    region: "DE",
    label: "Pumped storage",
    unit: "MWh",
    decimals: 0,
    group: "Conventional generation",
  },
  otherConventional: {
    filter: 1227,
    region: "DE",
    label: "Other conventional",
    unit: "MWh",
    decimals: 0,
    group: "Conventional generation",
  },
} as const satisfies Record<string, SeriesDefinition>;

export type SeriesId = keyof typeof SERIES;

export const SERIES_IDS = Object.keys(SERIES) as SeriesId[];
