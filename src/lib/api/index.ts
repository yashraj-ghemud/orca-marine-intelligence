/**
 * ORCA Marine API Module
 * 
 * Centralized export for all marine data API clients
 */

// API Clients
export { incoisClient } from './incois';
export { copernicusClient } from './copernicus';
export { imdClient } from './imd';
export { openWeatherClient } from './openweather';

// Data Aggregator
export { marineDataAggregator } from './marine-data-aggregator';

// Types
export type {
    INCOISWaveData,
    INCOISCurrentData,
    INCOISSST,
    INCOISPFZZone,
    INCOISForecast
} from './incois';

export type {
    CopernicusWaveData,
    CopernicusCurrentData,
    CopernicusSSTData,
    CopernicusChlorophyllData,
    CopernicusForecast
} from './copernicus';

export type {
    IMDWeatherData,
    IMDFishermenWarning,
    IMDCycloneInfo,
    IMDCoastalBulletin,
    IMDMarineForecast
} from './imd';

export type {
    OpenWeatherMarineData
} from './openweather';

export type {
    AggregatedMarineData,
    FetchOptions
} from './marine-data-aggregator';
