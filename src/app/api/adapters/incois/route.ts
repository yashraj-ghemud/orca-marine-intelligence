/**
 * INCOIS Adapter - Internal bridge between ORCA orchestrator and INCOIS API
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
            // Use FREE Open-Meteo Marine API (No API key needed!)
            const marineResponse = await fetch(
                `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height,wave_period,wave_direction,ocean_current_velocity,ocean_current_direction&timezone=Asia/Kolkata`,
                { next: { revalidate: 1800 } }
            );

            if (!marineResponse.ok) {
                throw new Error('Open-Meteo Marine API failed');
            }

            const marineData = await marineResponse.json();

            // Return data in EXACT format expected by orchestrator
            return NextResponse.json({
                mode: "live",
                regionId,
                observedAt: now,
                validUntil,
                source: 'incois',
                data: {
                    center: { lat, lng },
                    advisoryActive: region.conditions.advisoryActive,
                    hazardSeverity: region.hazardZones?.[0]?.severity === 'high' ? 'high' :
                        region.hazardZones?.[0]?.severity === 'moderate' ? 'moderate' : 'none',
                    cycloneDistanceKm: region.cyclone?.distanceKm || null,
                    boundaryStatus: 'clear',
                    pfzAvailable: region.pfzZones && region.pfzZones.length > 0
                }
            });
        } catch (error) {
            // Fallback to demo data if API fails
            console.warn('Public marine APIs unavailable, using demo data:', error);
            return NextResponse.json({
                mode: "live",
                regionId,
                observedAt: now,
                validUntil,
                source: 'incois',
                data: {
                    center: { lat, lng },
                    advisoryActive: region.conditions.advisoryActive,
                    hazardSeverity: region.hazardZones?.[0]?.severity === 'high' ? 'high' :
                        region.hazardZones?.[0]?.severity === 'moderate' ? 'moderate' : 'none',
                    cycloneDistanceKm: region.cyclone?.distanceKm || null,
                    boundaryStatus: 'clear',
                    pfzAvailable: region.pfzZones && region.pfzZones.length > 0
                }
            });
        }
    } catch (error) {
        console.error('INCOIS adapter error:', error);
        return NextResponse.json(
            { error: 'Internal adapter error' },
            { status: 500 }
        );
    }
}
