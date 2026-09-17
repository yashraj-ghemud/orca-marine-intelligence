/**
 * Marine Data Aggregator
 * 
 * Combines data from multiple sources (INCOIS, Copernicus, IMD)
 * to provide comprehensive marine intelligence
 */

import { incoisClient, type INCOISForecast, type INCOISPFZZone } from './incois';
import { copernicusClient, type CopernicusForecast } from './copernicus';
import { imdClient, type IMDMarineForecast } from './imd';

export interface AggregatedMarineData {
    location: {
        lat: number;
        lng: number;
        region: string;
    };
    timestamp: string;

    // Wave data (combined from INCOIS and Copernicus)
    waves: {
        height: number;
        period: number;
        direction: string;
        swellHeight?: number;
        swellPeriod?: number;
        source: 'incois' | 'copernicus' | 'combined';
    };

    // Current data
    currents: {
        speed: number;
        direction: string;
        source: 'incois' | 'copernicus';
    };

    // Sea Surface Temperature
    sst: {
        temperature: number;
        source: 'incois' | 'copernicus';
    };

    // Chlorophyll
    chlorophyll?: {
        concentration: number;
        source: 'incois' | 'copernicus';
    };

    // Weather conditions (from IMD)
    weather: {
        temperature: number;
        humidity: number;
        windSpeed: number;
        windDirection: string;
        visibility: number;
    };

    // Warnings and advisories
    warnings: Array<{
        type: 'fishermen' | 'cyclone' | 'wave' | 'weather';
        severity: 'low' | 'medium' | 'high' | 'extreme';
        message: string;
        messageHi: string;
        validUntil: string;
    }>;

    // PFZ data
    pfzZones?: INCOISPFZZone[];

    // Cyclone info
    cyclone?: {
        name: string;
        category: string;
        position: { lat: number; lng: number };
        distance: number;
        bearing: string;
        windSpeed: number;
    };

    // Data quality indicators
    quality: {
        incoisAvailable: boolean;
        copernicusAvailable: boolean;
        imdAvailable: boolean;
        overall: 'excellent' | 'good' | 'fair' | 'poor';
    };
}

export interface FetchOptions {
    includeHistorical?: boolean;
    includePFZ?: boolean;
    includeCyclone?: boolean;
    timeout?: number;
}

class MarineDataAggregator {
    /**
     * Fetch and combine data from all available sources
     */
    async getAggregatedData(
        lat: number,
        lng: number,
        region: string,
        options: FetchOptions = {}
    ): Promise<AggregatedMarineData> {
        const {
            includePFZ = true,
            includeCyclone = true,
            timeout = 10000
        } = options;

        // Fetch data from all sources in parallel with timeout
        const results = await Promise.allSettled([
            this.fetchWithTimeout(() => incoisClient.getOceanStateForecast(lat, lng), timeout),
            this.fetchWithTimeout(() => copernicusClient.getForecast(lat, lng), timeout),
            this.fetchWithTimeout(() => imdClient.getMarineForecast(lat, lng, region), timeout),
            includePFZ ? this.fetchWithTimeout(() => incoisClient.getPFZData(region as any), timeout) : Promise.resolve(null)
        ]);

        const [incoisResult, copernicusResult, imdResult, pfzResult] = results;

        // Extract successful results
        const incoisData = incoisResult.status === 'fulfilled' ? incoisResult.value : null;
        const copernicusData = copernicusResult.status === 'fulfilled' ? copernicusResult.value : null;
        const imdData = imdResult.status === 'fulfilled' ? imdResult.value : null;
        const pfzData = pfzResult.status === 'fulfilled' ? pfzResult.value : null;

        // Combine and prioritize data
        return this.combineData(lat, lng, region, {
            incois: incoisData,
            copernicus: copernicusData,
            imd: imdData,
            pfz: pfzData
        });
    }

    /**
     * Get real-time wave data (fastest sources first)
     */
    async getWaveData(lat: number, lng: number) {
        try {
            // Try INCOIS first (usually faster for Indian waters)
            const incoisWaves = await incoisClient.getWaveData(lat, lng);
            return {
                ...incoisWaves,
                source: 'incois' as const
            };
        } catch (error) {
            console.warn('INCOIS wave data unavailable, trying Copernicus:', error);

            try {
                // Fallback to Copernicus
                const copernicusWaves = await copernicusClient.getWaveData(lat, lng);
                return {
                    waveHeight: copernicusWaves.significantWaveHeight,
                    wavePeriod: copernicusWaves.meanWavePeriod,
                    waveDirection: copernicusWaves.meanWaveDirection.toString(),
                    timestamp: copernicusWaves.timestamp,
                    source: 'copernicus' as const
                };
            } catch (copernicusError) {
                console.error('Both wave data sources failed:', copernicusError);
                throw new Error('Wave data unavailable from all sources');
            }
        }
    }

    /**
     * Get PFZ data with enrichment
     */
    async getEnrichedPFZData(region: string) {
        const pfzZones = await incoisClient.getPFZData(region as any);

        // Enrich with additional data if needed
        return pfzZones.map(zone => ({
            ...zone,
            distanceFromCoast: this.calculateDistanceFromCoast(zone.latitude, zone.longitude, region),
            accessibility: this.assessAccessibility(zone, region)
        }));
    }

    /**
     * Get cyclone tracking data
     */
    async getCycloneData(lat: number, lng: number) {
        try {
            const cyclones = await imdClient.getActiveCyclones();

            if (cyclones.length === 0) {
                return null;
            }

            // Find nearest cyclone
            const nearest = cyclones.reduce((closest, current) => {
                const currentDist = this.haversineDistance(
                    lat, lng,
                    current.currentPosition.lat, current.currentPosition.lng
                );
                const closestDist = this.haversineDistance(
                    lat, lng,
                    closest.currentPosition.lat, closest.currentPosition.lng
                );
                return currentDist < closestDist ? current : closest;
            });

            const distance = this.haversineDistance(
                lat, lng,
                nearest.currentPosition.lat, nearest.currentPosition.lng
            );

            return {
                name: nearest.name,
                category: nearest.category,
                position: nearest.currentPosition,
                distance,
                bearing: this.calculateBearing(lat, lng, nearest.currentPosition.lat, nearest.currentPosition.lng),
                windSpeed: nearest.windSpeed,
                movement: nearest.movement,
                forecast: nearest.forecast
            };
        } catch (error) {
            console.error('Cyclone data fetch error:', error);
            return null;
        }
    }

    /**
     * Combine data from multiple sources
     */
    private combineData(
        lat: number,
        lng: number,
        region: string,
        sources: {
            incois: INCOISForecast | null;
            copernicus: CopernicusForecast | null;
            imd: IMDMarineForecast | null;
            pfz: INCOISPFZZone[] | null;
        }
    ): AggregatedMarineData {
        const { incois, copernicus, imd, pfz } = sources;

        // Determine data quality
        const quality = this.assessDataQuality(
            !!incois,
            !!copernicus,
            !!imd
        );

        // Combine wave data (prefer INCOIS for Indian waters)
        const waves = incois?.waves || copernicus?.waves ? {
            height: incois?.waves?.waveHeight || copernicus?.waves?.significantWaveHeight || 0,
            period: incois?.waves?.wavePeriod || copernicus?.waves?.meanWavePeriod || 0,
            direction: incois?.waves?.waveDirection || copernicus?.waves?.meanWaveDirection?.toString() || 'N/A',
            swellHeight: incois?.waves?.swellHeight,
            swellPeriod: incois?.waves?.swellPeriod,
            source: (incois?.waves ? 'incois' : 'copernicus') as 'incois' | 'copernicus' | 'combined'
        } : {
            height: 0,
            period: 0,
            direction: 'N/A',
            source: 'combined' as const
        };

        // Combine current data
        const currents = incois?.currents || copernicus?.currents ? {
            speed: incois?.currents?.speed || copernicus?.currents?.speed || 0,
            direction: incois?.currents?.direction || copernicus?.currents?.direction?.toString() || 'N/A',
            source: (incois?.currents ? 'incois' : 'copernicus') as 'incois' | 'copernicus'
        } : {
            speed: 0,
            direction: 'N/A',
            source: 'incois' as const
        };

        // Combine SST data
        const sst = incois?.sst || copernicus?.sst ? {
            temperature: incois?.sst?.temperature || copernicus?.sst?.temperature || 0,
            source: (incois?.sst ? 'incois' : 'copernicus') as 'incois' | 'copernicus'
        } : {
            temperature: 0,
            source: 'incois' as const
        };

        // Combine warnings
        const warnings = this.combineWarnings(incois, imd);

        // Prepare cyclone data
        const cyclone = imd?.cyclone ? {
            name: imd.cyclone.name,
            category: imd.cyclone.category,
            position: imd.cyclone.currentPosition,
            distance: this.haversineDistance(lat, lng, imd.cyclone.currentPosition.lat, imd.cyclone.currentPosition.lng),
            bearing: this.calculateBearing(lat, lng, imd.cyclone.currentPosition.lat, imd.cyclone.currentPosition.lng),
            windSpeed: imd.cyclone.windSpeed
        } : undefined;

        return {
            location: { lat, lng, region },
            timestamp: new Date().toISOString(),
            waves,
            currents,
            sst,
            chlorophyll: copernicus?.chlorophyll ? {
                concentration: copernicus.chlorophyll.concentration,
                source: 'copernicus'
            } : undefined,
            weather: imd?.weather ? {
                temperature: imd.weather.temperature,
                humidity: imd.weather.humidity,
                windSpeed: imd.weather.windSpeed,
                windDirection: imd.weather.windDirection,
                visibility: imd.weather.visibility
            } : {
                temperature: 0,
                humidity: 0,
                windSpeed: 0,
                windDirection: 'N/A',
                visibility: 0
            },
            warnings,
            pfzZones: pfz || undefined,
            cyclone,
            quality
        };
    }

    /**
     * Combine warnings from different sources
     */
    private combineWarnings(
        incois: INCOISForecast | null,
        imd: IMDMarineForecast | null
    ) {
        const warnings: AggregatedMarineData['warnings'] = [];

        // Add IMD fishermen warnings
        if (imd?.warnings) {
            warnings.push(...imd.warnings.map(w => ({
                type: 'fishermen' as const,
                severity: w.severity,
                message: w.warning,
                messageHi: w.warningHi,
                validUntil: w.validUntil
            })));
        }

        // Add INCOIS advisory as warning if exists
        if (incois?.advisory) {
            warnings.push({
                type: 'wave' as const,
                severity: 'medium' as const,
                message: incois.advisory,
                messageHi: incois.advisory, // Would need translation
                validUntil: incois.validUntil
            });
        }

        // Add cyclone warning if exists
        if (imd?.cyclone) {
            warnings.push({
                type: 'cyclone' as const,
                severity: 'extreme' as const,
                message: `Cyclone ${imd.cyclone.name} active - ${imd.cyclone.movement}`,
                messageHi: `चक्रवात ${imd.cyclone.name} सक्रिय`,
                validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
        }

        return warnings;
    }

    /**
     * Assess overall data quality
     */
    private assessDataQuality(
        incoisAvailable: boolean,
        copernicusAvailable: boolean,
        imdAvailable: boolean
    ): AggregatedMarineData['quality'] {
        const availableCount = [incoisAvailable, copernicusAvailable, imdAvailable].filter(Boolean).length;

        let overall: 'excellent' | 'good' | 'fair' | 'poor';
        if (availableCount === 3) overall = 'excellent';
        else if (availableCount === 2) overall = 'good';
        else if (availableCount === 1) overall = 'fair';
        else overall = 'poor';

        return {
            incoisAvailable,
            copernicusAvailable,
            imdAvailable,
            overall
        };
    }

    /**
     * Fetch with timeout
     */
    private async fetchWithTimeout<T>(
        fetchFn: () => Promise<T>,
        timeout: number
    ): Promise<T> {
        return Promise.race([
            fetchFn(),
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
        ]);
    }

    /**
     * Calculate haversine distance between two points
     */
    private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Calculate bearing between two points
     */
    private calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): string {
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
        const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
        const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        return directions[Math.round(bearing / 22.5) % 16];
    }

    /**
     * Calculate distance from coast (simplified)
     */
    private calculateDistanceFromCoast(lat: number, lng: number, region: string): number {
        // Simplified calculation - in production, use actual coastline data
        const coastlineApprox = {
            mumbai: { lat: 18.92, lng: 72.82 },
            goa: { lat: 15.42, lng: 73.81 },
            kerala: { lat: 9.7, lng: 75.8 },
            chennai: { lat: 13.2, lng: 80.27 }
        };

        const coast = coastlineApprox[region as keyof typeof coastlineApprox] || { lat, lng };
        return this.haversineDistance(lat, lng, coast.lat, coast.lng);
    }

    /**
     * Assess PFZ accessibility
     */
    private assessAccessibility(zone: INCOISPFZZone, region: string): 'easy' | 'moderate' | 'difficult' {
        const distanceFromCoast = this.calculateDistanceFromCoast(zone.latitude, zone.longitude, region);

        if (distanceFromCoast < 20) return 'easy';
        if (distanceFromCoast < 50) return 'moderate';
        return 'difficult';
    }
}

// Singleton instance
export const marineDataAggregator = new MarineDataAggregator();
