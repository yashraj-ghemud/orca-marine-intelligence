/**
 * INCOIS (Indian National Centre for Ocean Information Services) API Client
 * 
 * Provides access to:
 * - Ocean State Forecast (OSF) - waves, currents, SST
 * - Potential Fishing Zones (PFZ)
 * - Wave data and forecasts
 * - Marine advisories
 */

export interface INCOISWaveData {
    waveHeight: number;
    wavePeriod: number;
    waveDirection: string;
    swellHeight?: number;
    swellPeriod?: number;
    timestamp: string;
}

export interface INCOISCurrentData {
    speed: number;
    direction: string;
    timestamp: string;
}

export interface INCOISSST {
    temperature: number;
    timestamp: string;
}

export interface INCOISPFZZone {
    id: string;
    latitude: number;
    longitude: number;
    sst: number;
    chlorophyll: number;
    potentialSpecies: string[];
    forecastDate: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface INCOISForecast {
    location: {
        lat: number;
        lng: number;
    };
    waves: INCOISWaveData;
    currents: INCOISCurrentData;
    sst: INCOISSST;
    advisory?: string;
    validUntil: string;
}

class INCOISClient {
    private baseUrl: string;
    private apiKey: string;
    private pfzUrl: string;
    private wmsUrl: string;

    constructor() {
        this.baseUrl = process.env.INCOIS_BASE_URL || 'https://incois.gov.in/portal/datainfo';
        this.apiKey = process.env.INCOIS_API_KEY || '';
        this.pfzUrl = process.env.INCOIS_PFZ_API_URL || 'https://incois.gov.in/portal/osf/map.jsp';
        this.wmsUrl = process.env.INCOIS_PFZ_WMS_URL || 'https://incois.gov.in/geoserver/wms';
    }

    /**
     * Fetch Ocean State Forecast (OSF) data for a location
     */
    async getOceanStateForecast(lat: number, lng: number): Promise<INCOISForecast> {
        try {
            const response = await fetch(
                `${this.baseUrl}/osf?lat=${lat}&lon=${lng}&key=${this.apiKey}`,
                {
                    headers: {
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 3600 } // Cache for 1 hour
                }
            );

            if (!response.ok) {
                throw new Error(`INCOIS OSF API error: ${response.status}`);
            }

            const data = await response.json();
            return this.transformOSFData(data, lat, lng);
        } catch (error) {
            console.error('INCOIS OSF fetch error:', error);
            throw error;
        }
    }

    /**
     * Fetch Potential Fishing Zones (PFZ) data
     */
    async getPFZData(region: 'mumbai' | 'goa' | 'kerala' | 'chennai'): Promise<INCOISPFZZone[]> {
        try {
            // Region bounds mapping
            const regionBounds = {
                mumbai: { minLat: 18.0, maxLat: 20.5, minLng: 72.0, maxLng: 73.5 },
                goa: { minLat: 14.5, maxLat: 16.0, minLng: 73.0, maxLng: 74.5 },
                kerala: { minLat: 8.5, maxLat: 10.5, minLng: 75.0, maxLng: 76.5 },
                chennai: { minLat: 12.0, maxLat: 14.0, minLng: 80.0, maxLng: 81.5 }
            };

            const bounds = regionBounds[region];

            const response = await fetch(
                `${this.pfzUrl}/api/pfz?minLat=${bounds.minLat}&maxLat=${bounds.maxLat}&minLng=${bounds.minLng}&maxLng=${bounds.maxLng}&key=${this.apiKey}`,
                {
                    headers: {
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 21600 } // Cache for 6 hours
                }
            );

            if (!response.ok) {
                throw new Error(`INCOIS PFZ API error: ${response.status}`);
            }

            const data = await response.json();
            return this.transformPFZData(data);
        } catch (error) {
            console.error('INCOIS PFZ fetch error:', error);
            throw error;
        }
    }

    /**
     * Fetch wave forecast data
     */
    async getWaveData(lat: number, lng: number): Promise<INCOISWaveData> {
        try {
            const response = await fetch(
                `${this.baseUrl}/waves?lat=${lat}&lon=${lng}&key=${this.apiKey}`,
                {
                    headers: {
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 3600 }
                }
            );

            if (!response.ok) {
                throw new Error(`INCOIS Wave API error: ${response.status}`);
            }

            const data = await response.json();
            return {
                waveHeight: data.wave_height || 0,
                wavePeriod: data.wave_period || 0,
                waveDirection: data.wave_direction || 'N/A',
                swellHeight: data.swell_height,
                swellPeriod: data.swell_period,
                timestamp: data.timestamp || new Date().toISOString()
            };
        } catch (error) {
            console.error('INCOIS Wave data fetch error:', error);
            throw error;
        }
    }

    /**
     * Get WMS layer URL for map visualization
     */
    getWMSLayerUrl(layer: 'sst' | 'chlorophyll' | 'waves' | 'currents'): string {
        const layerMap = {
            sst: 'incois:sst',
            chlorophyll: 'incois:chlorophyll',
            waves: 'incois:wave_height',
            currents: 'incois:ocean_currents'
        };

        return `${this.wmsUrl}?service=WMS&version=1.3.0&request=GetMap&layers=${layerMap[layer]}&format=image/png&transparent=true`;
    }

    /**
     * Transform INCOIS OSF API response to our format
     */
    private transformOSFData(data: any, lat: number, lng: number): INCOISForecast {
        return {
            location: { lat, lng },
            waves: {
                waveHeight: data.wave_height || 0,
                wavePeriod: data.wave_period || 0,
                waveDirection: data.wave_direction || 'N/A',
                swellHeight: data.swell_height,
                swellPeriod: data.swell_period,
                timestamp: data.timestamp || new Date().toISOString()
            },
            currents: {
                speed: data.current_speed || 0,
                direction: data.current_direction || 'N/A',
                timestamp: data.timestamp || new Date().toISOString()
            },
            sst: {
                temperature: data.sst || 0,
                timestamp: data.timestamp || new Date().toISOString()
            },
            advisory: data.advisory,
            validUntil: data.valid_until || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
    }

    /**
     * Transform INCOIS PFZ API response to our format
     */
    private transformPFZData(data: any): INCOISPFZZone[] {
        if (!data.pfz_zones || !Array.isArray(data.pfz_zones)) {
            return [];
        }

        return data.pfz_zones.map((zone: any, index: number) => ({
            id: `pfz-incois-${index}`,
            latitude: zone.lat || zone.latitude,
            longitude: zone.lon || zone.lng || zone.longitude,
            sst: zone.sst || 0,
            chlorophyll: zone.chlorophyll || zone.chl || 0,
            potentialSpecies: zone.species || zone.potential_species || [],
            forecastDate: zone.forecast_date || zone.date || new Date().toISOString(),
            confidence: zone.confidence || 'medium'
        }));
    }
}

// Singleton instance
export const incoisClient = new INCOISClient();
