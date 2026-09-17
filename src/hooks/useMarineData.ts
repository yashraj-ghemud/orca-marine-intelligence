/**
 * React Hook for Marine Data
 * 
 * Provides easy access to marine data in React components
 */

import { useState, useEffect, useCallback } from 'react';
import type { AggregatedMarineData } from '@/lib/api';

interface UseMarineDataOptions {
    region?: string;
    source?: 'all' | 'incois' | 'copernicus' | 'imd';
    type?: 'forecast' | 'waves' | 'pfz' | 'cyclone' | 'weather';
    autoFetch?: boolean;
    refreshInterval?: number; // in milliseconds
}

interface UseMarineDataReturn {
    data: AggregatedMarineData | null;
    loading: boolean;
    error: Error | null;
    fetch: (lat: number, lng: number) => Promise<void>;
    refetch: () => Promise<void>;
    clear: () => void;
}

/**
 * Hook to fetch and manage marine data
 */
export function useMarineData(
    lat?: number,
    lng?: number,
    options: UseMarineDataOptions = {}
): UseMarineDataReturn {
    const {
        region = 'mumbai',
        source = 'all',
        type = 'forecast',
        autoFetch = true,
        refreshInterval
    } = options;

    const [data, setData] = useState<AggregatedMarineData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
        lat !== undefined && lng !== undefined ? { lat, lng } : null
    );

    const fetchData = useCallback(async (latitude: number, longitude: number) => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                lat: latitude.toString(),
                lng: longitude.toString(),
                region,
                source,
                type
            });

            const response = await fetch(`/api/marine?${params}`);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Unknown error');
            }

            setData(result.data);
            setCoords({ lat: latitude, lng: longitude });
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch marine data'));
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [region, source, type]);

    const refetch = useCallback(async () => {
        if (coords) {
            await fetchData(coords.lat, coords.lng);
        }
    }, [coords, fetchData]);

    const clear = useCallback(() => {
        setData(null);
        setError(null);
        setCoords(null);
    }, []);

    // Auto-fetch on mount if coordinates are provided. The fetch is started
    // after the effect body returns (and abandoned if the inputs change
    // first), so the effect itself never sets state synchronously.
    useEffect(() => {
        if (!autoFetch || lat === undefined || lng === undefined) return;
        let cancelled = false;
        const run = async () => {
            await Promise.resolve();
            if (!cancelled) await fetchData(lat, lng);
        };
        void run();
        return () => { cancelled = true; };
    }, [lat, lng, autoFetch, fetchData]);

    // Set up refresh interval if specified
    useEffect(() => {
        if (refreshInterval && coords) {
            const interval = setInterval(() => {
                refetch();
            }, refreshInterval);

            return () => clearInterval(interval);
        }
    }, [refreshInterval, coords, refetch]);

    return {
        data,
        loading,
        error,
        fetch: fetchData,
        refetch,
        clear
    };
}

/**
 * Hook for fetching wave data specifically
 */
export function useWaveData(lat?: number, lng?: number, options: Omit<UseMarineDataOptions, 'type'> = {}) {
    return useMarineData(lat, lng, { ...options, type: 'waves' });
}

/**
 * Hook for fetching PFZ data
 */
export function usePFZData(region: string, options: Omit<UseMarineDataOptions, 'type' | 'region'> = {}) {
    return useMarineData(undefined, undefined, { ...options, region, type: 'pfz', autoFetch: true });
}

/**
 * Hook for fetching cyclone data
 */
export function useCycloneData(lat?: number, lng?: number, options: Omit<UseMarineDataOptions, 'type'> = {}) {
    return useMarineData(lat, lng, { ...options, type: 'cyclone' });
}

/**
 * Hook for fetching weather data
 */
export function useWeatherData(lat?: number, lng?: number, options: Omit<UseMarineDataOptions, 'type'> = {}) {
    return useMarineData(lat, lng, { ...options, type: 'weather', source: 'imd' });
}
