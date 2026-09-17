/**
 * Copernicus Marine Service API Client
 * 
 * Provides access to:
 * - Historical ocean data
 * - Wave forecasts
 * - Current forecasts
 * - Sea Surface Temperature (SST)
 * - Chlorophyll concentration
 */

export interface CopernicusWaveData {
    significantWaveHeight: number;
    meanWavePeriod: number;
    meanWaveDirection: number;
    peakWavePeriod?: number;
    timestamp: string;
}

export interface CopernicusCurrentData {
    eastward: number; // u component (m/s)
    northward: number; // v component (m/s)
    speed: number;
    direction: number;
    timestamp: string;
}

export interface CopernicusSSTData {
    temperature: number;
    depth: number;
    timestamp: string;
}

export interface CopernicusChlorophyllData {
    concentration: number; // mg/m³
    depth: number;
    timestamp: string;
}

export interface CopernicusForecast {
    location: {
        lat: number;
        lng: number;
    };
    waves: CopernicusWaveData;
    currents: CopernicusCurrentData;
    sst: CopernicusSSTData;
    chlorophyll?: CopernicusChlorophyllData;
    validTime: string;
}

class CopernicusClient {
    private baseUrl: string;
    private username: string;
    private password: string;
    private token: string | null = null;

    constructor() {
        this.baseUrl = process.env.COPERNICUS_API_URL || 'https://data.marine.copernicus.eu/api';
        this.username = process.env.COPERNICUS_USERNAME || '';
        this.password = process.env.COPERNICUS_PASSWORD || '';
    }

    /**
     * Authenticate and get access token
     */
    private async authenticate(): Promise<string> {
        if (this.token) return this.token;

        try {
            const response = await fetch(`${this.baseUrl}/auth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: this.username,
                    password: this.password,
                }),
            });

            if (!response.ok) {
                throw new Error(`Copernicus auth error: ${response.status}`);
            }

            const data = await response.json();
            this.token = data.access_token;
            return this.token!;
        } catch (error) {
            console.error('Copernicus authentication error:', error);
            throw error;
        }
    }

    /**
     * Fetch ocean forecast data for a location
     */
    async getForecast(lat: number, lng: number, depth: number = 0): Promise<CopernicusForecast> {
        try {
            const token = await this.authenticate();

            // Using Copernicus Marine Toolbox REST API
            const response = await fetch(
                `${this.baseUrl}/forecast?latitude=${lat}&longitude=${lng}&depth=${depth}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 3600 } // Cache for 1 hour
                }
            );

            if (!response.ok) {
                throw new Error(`Copernicus API error: ${response.status}`);
            }

            const data = await response.json();
            return this.transformForecastData(data, lat, lng);
        } catch (error) {
            console.error('Copernicus forecast fetch error:', error);
            throw error;
        }
    }

    /**
     * Fetch wave data specifically
     */
    async getWaveData(lat: number, lng: number): Promise<CopernicusWaveData> {
        try {
            const token = await this.authenticate();

            const response = await fetch(
                `${this.baseUrl}/waves?latitude=${lat}&longitude=${lng}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 3600 }
                }
            );

            if (!response.ok) {
                throw new Error(`Copernicus Wave API error: ${response.status}`);
            }

            const data = await response.json();
            return {
                significantWaveHeight: data.VHM0 || data.significant_wave_height || 0,
                meanWavePeriod: data.VMDR || data.mean_wave_period || 0,
                meanWaveDirection: data.VMDR_SW1 || data.mean_wave_direction || 0,
                peakWavePeriod: data.VTPK || data.peak_wave_period,
                timestamp: data.time || new Date().toISOString()
            };
        } catch (error) {
            console.error('Copernicus wave data fetch error:', error);
            throw error;
        }
    }

    /**
     * Fetch current data
     */
    async getCurrentData(lat: number, lng: number, depth: number = 0): Promise<CopernicusCurrentData> {
        try {
            const token = await this.authenticate();

            const response = await fetch(
                `${this.baseUrl}/currents?latitude=${lat}&longitude=${lng}&depth=${depth}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 3600 }
                }
            );

            if (!response.ok) {
                throw new Error(`Copernicus Current API error: ${response.status}`);
            }

            const data = await response.json();
            const eastward = data.uo || data.u || 0;
            const northward = data.vo || data.v || 0;
            const speed = Math.sqrt(eastward ** 2 + northward ** 2);
            const direction = (Math.atan2(eastward, northward) * 180 / Math.PI + 360) % 360;

            return {
                eastward,
                northward,
                speed,
                direction,
                timestamp: data.time || new Date().toISOString()
            };
        } catch (error) {
            console.error('Copernicus current data fetch error:', error);
            throw error;
        }
    }

    /**
     * Fetch SST data
     */
    async getSSTData(lat: number, lng: number, depth: number = 0): Promise<CopernicusSSTData> {
        try {
            const token = await this.authenticate();

            const response = await fetch(
                `${this.baseUrl}/temperature?latitude=${lat}&longitude=${lng}&depth=${depth}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 3600 }
                }
            );

            if (!response.ok) {
                throw new Error(`Copernicus SST API error: ${response.status}`);
            }

            const data = await response.json();
            return {
                temperature: data.thetao || data.temperature || 0,
                depth,
                timestamp: data.time || new Date().toISOString()
            };
        } catch (error) {
            console.error('Copernicus SST data fetch error:', error);
            throw error;
        }
    }

    /**
     * Fetch chlorophyll data
     */
    async getChlorophyllData(lat: number, lng: number): Promise<CopernicusChlorophyllData> {
        try {
            const token = await this.authenticate();

            const response = await fetch(
                `${this.baseUrl}/biogeochemistry?latitude=${lat}&longitude=${lng}&variable=chlorophyll`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 21600 } // Cache for 6 hours
                }
            );

            if (!response.ok) {
                throw new Error(`Copernicus Chlorophyll API error: ${response.status}`);
            }

            const data = await response.json();
            return {
                concentration: data.chl || data.chlorophyll || 0,
                depth: 0,
                timestamp: data.time || new Date().toISOString()
            };
        } catch (error) {
            console.error('Copernicus chlorophyll data fetch error:', error);
            throw error;
        }
    }

    /**
     * Fetch historical data for training ML models
     */
    async getHistoricalData(
        lat: number,
        lng: number,
        startDate: string,
        endDate: string,
        variables: string[] = ['waves', 'currents', 'sst']
    ): Promise<any> {
        try {
            const token = await this.authenticate();

            const response = await fetch(
                `${this.baseUrl}/historical?latitude=${lat}&longitude=${lng}&start=${startDate}&end=${endDate}&variables=${variables.join(',')}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Copernicus Historical API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Copernicus historical data fetch error:', error);
            throw error;
        }
    }

    /**
     * Transform Copernicus API response to our format
     */
    private transformForecastData(data: any, lat: number, lng: number): CopernicusForecast {
        return {
            location: { lat, lng },
            waves: {
                significantWaveHeight: data.VHM0 || 0,
                meanWavePeriod: data.VMDR || 0,
                meanWaveDirection: data.VMDR_SW1 || 0,
                peakWavePeriod: data.VTPK,
                timestamp: data.time || new Date().toISOString()
            },
            currents: {
                eastward: data.uo || 0,
                northward: data.vo || 0,
                speed: Math.sqrt((data.uo || 0) ** 2 + (data.vo || 0) ** 2),
                direction: (Math.atan2(data.uo || 0, data.vo || 0) * 180 / Math.PI + 360) % 360,
                timestamp: data.time || new Date().toISOString()
            },
            sst: {
                temperature: data.thetao || 0,
                depth: 0,
                timestamp: data.time || new Date().toISOString()
            },
            chlorophyll: data.chl ? {
                concentration: data.chl,
                depth: 0,
                timestamp: data.time || new Date().toISOString()
            } : undefined,
            validTime: data.time || new Date().toISOString()
        };
    }
}

// Singleton instance
export const copernicusClient = new CopernicusClient();
