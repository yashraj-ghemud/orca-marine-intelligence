/**
 * IMD (India Meteorological Department) API Client
 * 
 * Provides access to:
 * - Current weather conditions
 * - Fishermen warnings
 * - Coastal and sea bulletins
 * - Cyclone tracking and warnings
 * - Marine forecasts
 */

export interface IMDWeatherData {
    temperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: string;
    pressure: number;
    visibility: number;
    timestamp: string;
}

export interface IMDFishermenWarning {
    id: string;
    region: string;
    severity: 'low' | 'medium' | 'high' | 'extreme';
    warning: string;
    warningHi: string;
    validFrom: string;
    validUntil: string;
    issueTime: string;
}

export interface IMDCycloneInfo {
    name: string;
    category: string;
    currentPosition: {
        lat: number;
        lng: number;
    };
    intensity: string;
    windSpeed: number;
    pressure: number;
    movement: string;
    forecast: Array<{
        time: string;
        position: {
            lat: number;
            lng: number;
        };
        intensity: string;
    }>;
    warningZones: Array<{
        name: string;
        severity: string;
    }>;
    lastUpdated: string;
}

export interface IMDCoastalBulletin {
    region: string;
    seaCondition: string;
    waveHeight: number;
    windCondition: string;
    advisory: string;
    advisoryHi: string;
    validFrom: string;
    validUntil: string;
}

export interface IMDMarineForecast {
    location: {
        lat: number;
        lng: number;
    };
    weather: IMDWeatherData;
    warnings: IMDFishermenWarning[];
    bulletin?: IMDCoastalBulletin;
    cyclone?: IMDCycloneInfo;
}

class IMDClient {
    private baseUrl: string;
    private apiKey: string;
    private version: string;

    constructor() {
        this.baseUrl = process.env.IMD_API_BASE_URL || 'https://api.imd.gov.in';
        this.apiKey = process.env.IMD_API_KEY || '';
        this.version = process.env.IMD_API_VERSION || 'v1';
    }

    /**
     * Get current weather data for a location
     */
    async getCurrentWeather(lat: number, lng: number): Promise<IMDWeatherData> {
        try {
            const response = await fetch(
                `${this.baseUrl}/${this.version}/weather/current?lat=${lat}&lon=${lng}&key=${this.apiKey}`,
                {
                    headers: {
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 1800 } // Cache for 30 minutes
                }
            );

            if (!response.ok) {
                throw new Error(`IMD Weather API error: ${response.status}`);
            }

            const data = await response.json();
            return this.transformWeatherData(data);
        } catch (error) {
            console.error('IMD weather fetch error:', error);
            throw error;
        }
    }

    /**
     * Get fishermen warnings for a region
     */
    async getFishermenWarnings(region: string): Promise<IMDFishermenWarning[]> {
        try {
            const response = await fetch(
                `${this.baseUrl}/${this.version}/warnings/fishermen?region=${region}&key=${this.apiKey}`,
                {
                    headers: {
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 3600 } // Cache for 1 hour
                }
            );

            if (!response.ok) {
                throw new Error(`IMD Fishermen Warning API error: ${response.status}`);
            }

            const data = await response.json();
            return this.transformFishermenWarnings(data);
        } catch (error) {
            console.error('IMD fishermen warnings fetch error:', error);
            throw error;
        }
    }

    /**
     * Get coastal and sea bulletin
     */
    async getCoastalBulletin(region: string): Promise<IMDCoastalBulletin> {
        try {
            const response = await fetch(
                `${this.baseUrl}/${this.version}/bulletins/coastal?region=${region}&key=${this.apiKey}`,
                {
                    headers: {
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 3600 } // Cache for 1 hour
                }
            );

            if (!response.ok) {
                throw new Error(`IMD Coastal Bulletin API error: ${response.status}`);
            }

            const data = await response.json();
            return this.transformCoastalBulletin(data);
        } catch (error) {
            console.error('IMD coastal bulletin fetch error:', error);
            throw error;
        }
    }

    /**
     * Get active cyclone information
     */
    async getActiveCyclones(): Promise<IMDCycloneInfo[]> {
        try {
            const response = await fetch(
                `${this.baseUrl}/${this.version}/cyclone/active?key=${this.apiKey}`,
                {
                    headers: {
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 1800 } // Cache for 30 minutes
                }
            );

            if (!response.ok) {
                throw new Error(`IMD Cyclone API error: ${response.status}`);
            }

            const data = await response.json();
            return this.transformCycloneData(data);
        } catch (error) {
            console.error('IMD cyclone fetch error:', error);
            throw error;
        }
    }

    /**
     * Get cyclone track and cone
     */
    async getCycloneTrack(cycloneId: string): Promise<IMDCycloneInfo> {
        try {
            const response = await fetch(
                `${this.baseUrl}/${this.version}/cyclone/track/${cycloneId}?key=${this.apiKey}`,
                {
                    headers: {
                        'Accept': 'application/json',
                    },
                    next: { revalidate: 1800 }
                }
            );

            if (!response.ok) {
                throw new Error(`IMD Cyclone Track API error: ${response.status}`);
            }

            const data = await response.json();
            return this.transformCycloneTrackData(data);
        } catch (error) {
            console.error('IMD cyclone track fetch error:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive marine forecast
     */
    async getMarineForecast(lat: number, lng: number, region: string): Promise<IMDMarineForecast> {
        try {
            const [weather, warnings, bulletin, cyclones] = await Promise.all([
                this.getCurrentWeather(lat, lng),
                this.getFishermenWarnings(region),
                this.getCoastalBulletin(region).catch(() => undefined),
                this.getActiveCyclones().catch(() => [])
            ]);

            return {
                location: { lat, lng },
                weather,
                warnings,
                bulletin,
                cyclone: cyclones.length > 0 ? cyclones[0] : undefined
            };
        } catch (error) {
            console.error('IMD marine forecast fetch error:', error);
            throw error;
        }
    }

    /**
     * Transform IMD weather data to our format
     */
    private transformWeatherData(data: any): IMDWeatherData {
        return {
            temperature: data.temp || data.temperature || 0,
            humidity: data.humidity || 0,
            windSpeed: data.wind_speed || data.windSpeed || 0,
            windDirection: data.wind_direction || data.windDirection || 'N/A',
            pressure: data.pressure || 0,
            visibility: data.visibility || 0,
            timestamp: data.timestamp || data.time || new Date().toISOString()
        };
    }

    /**
     * Transform fishermen warnings data
     */
    private transformFishermenWarnings(data: any): IMDFishermenWarning[] {
        if (!data.warnings || !Array.isArray(data.warnings)) {
            return [];
        }

        return data.warnings.map((warning: any, index: number) => ({
            id: warning.id || `warning-${index}`,
            region: warning.region || 'Unknown',
            severity: this.mapSeverity(warning.severity),
            warning: warning.warning || warning.message || '',
            warningHi: warning.warning_hi || warning.message_hi || '',
            validFrom: warning.valid_from || warning.validFrom || new Date().toISOString(),
            validUntil: warning.valid_until || warning.validUntil || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            issueTime: warning.issue_time || warning.issueTime || new Date().toISOString()
        }));
    }

    /**
     * Transform coastal bulletin data
     */
    private transformCoastalBulletin(data: any): IMDCoastalBulletin {
        return {
            region: data.region || 'Unknown',
            seaCondition: data.sea_condition || data.seaCondition || 'Unknown',
            waveHeight: data.wave_height || data.waveHeight || 0,
            windCondition: data.wind_condition || data.windCondition || 'Unknown',
            advisory: data.advisory || data.message || '',
            advisoryHi: data.advisory_hi || data.message_hi || '',
            validFrom: data.valid_from || data.validFrom || new Date().toISOString(),
            validUntil: data.valid_until || data.validUntil || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
    }

    /**
     * Transform cyclone data
     */
    private transformCycloneData(data: any): IMDCycloneInfo[] {
        if (!data.cyclones || !Array.isArray(data.cyclones)) {
            return [];
        }

        return data.cyclones.map((cyclone: any) => this.transformCycloneTrackData(cyclone));
    }

    /**
     * Transform cyclone track data
     */
    private transformCycloneTrackData(data: any): IMDCycloneInfo {
        return {
            name: data.name || 'Unknown',
            category: data.category || data.type || 'Unknown',
            currentPosition: {
                lat: data.lat || data.latitude || 0,
                lng: data.lon || data.lng || data.longitude || 0
            },
            intensity: data.intensity || 'Unknown',
            windSpeed: data.wind_speed || data.windSpeed || 0,
            pressure: data.pressure || 0,
            movement: data.movement || 'Unknown',
            forecast: (data.forecast || data.track || []).map((point: any) => ({
                time: point.time || point.timestamp,
                position: {
                    lat: point.lat || point.latitude || 0,
                    lng: point.lon || point.lng || point.longitude || 0
                },
                intensity: point.intensity || 'Unknown'
            })),
            warningZones: (data.warning_zones || data.warningZones || []).map((zone: any) => ({
                name: zone.name || zone.region,
                severity: zone.severity || 'medium'
            })),
            lastUpdated: data.last_updated || data.lastUpdated || new Date().toISOString()
        };
    }

    /**
     * Map severity levels
     */
    private mapSeverity(severity: string): 'low' | 'medium' | 'high' | 'extreme' {
        const severityMap: Record<string, 'low' | 'medium' | 'high' | 'extreme'> = {
            'low': 'low',
            'moderate': 'medium',
            'medium': 'medium',
            'high': 'high',
            'severe': 'high',
            'extreme': 'extreme',
            'very_high': 'extreme'
        };

        return severityMap[severity?.toLowerCase()] || 'medium';
    }
}

// Singleton instance
export const imdClient = new IMDClient();
