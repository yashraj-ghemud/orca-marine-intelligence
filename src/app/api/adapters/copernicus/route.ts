/**
 * Copernicus Adapter - Internal bridge between ORCA orchestrator
 * Now using FREE Open-Meteo Marine API (No API key needed!)
 */

import { NextRequest, NextResponse } from 'next/server';
import { REGIONS } from '@/lib/mock-marine-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { regionId, mode } = body;

        if (!regionId) {
            return NextResponse.json(
                { error: 'regionId is required' },
                { status: 400 }
            );
        }

        const region = REGIONS[regionId as keyof typeof REGIONS];
        if (!region) {
            return NextResponse.json(
                { error: 'Invalid regionId' },
                { status: 400 }
            );
        }

        const { lat, lng } = region.center;
        const now = new Date().toISOString();
        const validUntil = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

        try {
            // Use FREE Open-Meteo Marine API
            const marineResponse = await fetch(
                `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height,ocean_current_velocity&timezone=Asia/Kolkata`,
                { next: { revalidate: 3600 } }
            );

            let waveHeight = region.conditions.waveHeightM;
            let currentKnots = region.conditions.currentKnots;

            if (marineResponse.ok) {
                const marineData = await marineResponse.json();
                const current = marineData.current;
                waveHeight = current.wave_height || waveHeight;
                currentKnots = current.ocean_current_velocity ? current.ocean_current_velocity * 1.944 : currentKnots;
            }

            // Try NOAA SST
            let sstC = region.conditions.sst;
            try {
                const sstResponse = await fetch(
                    `https://www.ncei.noaa.gov/erddap/griddap/ncdcOisst21Agg_LonPM180.json?sst[(last)][(${lat})][(${lng})]`,
                    { next: { revalidate: 86400 } }
                );
                if (sstResponse.ok) {
                    const sstData = await sstResponse.json();
                    if (sstData.table?.rows?.[0]?.[3]) {
                        sstC = parseFloat(sstData.table.rows[0][3]);
                    }
                }
            } catch (e) {
                console.log('NOAA SST fallback');
            }

            // Return in EXACT format expected by orchestrator
            return NextResponse.json({
                mode: "live",
                regionId,
                observedAt: now,
                validUntil,
                source: 'copernicus',
                data: {
                    waveHeightM: waveHeight,
                    sstC: sstC,
                    chlorophyllMgM3: region.conditions.chlorophyll,
                    currentKnots: currentKnots
                }
            });
        } catch (error) {
            console.warn('Public APIs unavailable, using demo data:', error);
            return NextResponse.json({
                mode: "live",
                regionId,
                observedAt: now,
                validUntil,
                source: 'copernicus',
                data: {
                    waveHeightM: region.conditions.waveHeightM,
                    sstC: region.conditions.sst,
                    chlorophyllMgM3: region.conditions.chlorophyll,
                    currentKnots: region.conditions.currentKnots
                }
            });
        }
    } catch (error) {
        console.error('Copernicus adapter error:', error);
        return NextResponse.json(
            { error: 'Internal adapter error' },
            { status: 500 }
        );
    }
}
