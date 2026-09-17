/**
 * Marine Data API Endpoint
 * 
 * Provides access to aggregated marine data from multiple sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { marineDataAggregator } from '@/lib/api/marine-data-aggregator';
import { incoisClient } from '@/lib/api/incois';
import { copernicusClient } from '@/lib/api/copernicus';
import { imdClient } from '@/lib/api/imd';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/marine
 * Query params:
 * - lat: latitude
 * - lng: longitude
 * - region: region name (mumbai, goa, kerala, chennai)
 * - source: specific source (incois, copernicus, imd, all)
 * - type: data type (forecast, waves, pfz, cyclone, weather)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const lat = parseFloat(searchParams.get('lat') || '0');
        const lng = parseFloat(searchParams.get('lng') || '0');
        const region = searchParams.get('region') || 'mumbai';
        const source = searchParams.get('source') || 'all';
        const type = searchParams.get('type') || 'forecast';

        // Validate coordinates
        if (lat === 0 && lng === 0) {
            return NextResponse.json(
                { error: 'Invalid coordinates. Please provide lat and lng parameters.' },
                { status: 400 }
            );
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return NextResponse.json(
                { error: 'Coordinates out of range.' },
                { status: 400 }
            );
        }

        let data;

        // Route to specific data source or aggregated data
        switch (source) {
            case 'incois':
                data = await handleINCOISRequest(lat, lng, region, type);
                break;

            case 'copernicus':
                data = await handleCopernicusRequest(lat, lng, type);
                break;

            case 'imd':
                data = await handleIMDRequest(lat, lng, region, type);
                break;

            case 'all':
            default:
                data = await handleAggregatedRequest(lat, lng, region, type);
                break;
        }

        return NextResponse.json({
            success: true,
            data,
            metadata: {
                timestamp: new Date().toISOString(),
                source,
                type,
                location: { lat, lng, region }
            }
        });

    } catch (error) {
        console.error('Marine API error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
                metadata: {
                    timestamp: new Date().toISOString()
                }
            },
            { status: 500 }
        );
    }
}

/**
 * Handle INCOIS specific requests
 */
async function handleINCOISRequest(lat: number, lng: number, region: string, type: string) {
    switch (type) {
        case 'waves':
            return await incoisClient.getWaveData(lat, lng);

        case 'pfz':
            return await incoisClient.getPFZData(region as any);

        case 'forecast':
        default:
            return await incoisClient.getOceanStateForecast(lat, lng);
    }
}

/**
 * Handle Copernicus specific requests
 */
async function handleCopernicusRequest(lat: number, lng: number, type: string) {
    switch (type) {
        case 'waves':
            return await copernicusClient.getWaveData(lat, lng);

        case 'currents':
            return await copernicusClient.getCurrentData(lat, lng);

        case 'sst':
            return await copernicusClient.getSSTData(lat, lng);

        case 'chlorophyll':
            return await copernicusClient.getChlorophyllData(lat, lng);

        case 'forecast':
        default:
            return await copernicusClient.getForecast(lat, lng);
    }
}

/**
 * Handle IMD specific requests
 */
async function handleIMDRequest(lat: number, lng: number, region: string, type: string) {
    switch (type) {
        case 'weather':
            return await imdClient.getCurrentWeather(lat, lng);

        case 'warnings':
            return await imdClient.getFishermenWarnings(region);

        case 'bulletin':
            return await imdClient.getCoastalBulletin(region);

        case 'cyclone':
            return await imdClient.getActiveCyclones();

        case 'forecast':
        default:
            return await imdClient.getMarineForecast(lat, lng, region);
    }
}

/**
 * Handle aggregated requests from all sources
 */
async function handleAggregatedRequest(lat: number, lng: number, region: string, type: string) {
    switch (type) {
        case 'waves':
            return await marineDataAggregator.getWaveData(lat, lng);

        case 'pfz':
            return await marineDataAggregator.getEnrichedPFZData(region);

        case 'cyclone':
            return await marineDataAggregator.getCycloneData(lat, lng);

        case 'forecast':
        default:
            return await marineDataAggregator.getAggregatedData(lat, lng, region, {
                includePFZ: true,
                includeCyclone: true
            });
    }
}
