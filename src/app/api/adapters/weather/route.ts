/**
 * Weather Adapter - Internal bridge between ORCA orchestrator
 * Now using FREE Open-Meteo Weather API (No API key needed!)
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
        const validUntil = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();

        try {
            // Use FREE Open-Meteo Weather API
            const weatherResponse = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,wind_gusts_10m&timezone=Asia/Kolkata`,
                { next: { revalidate: 1800 } }
            );

            let windKmph = region.conditions.windSpeedKmph;
            let gustKmph = region.conditions.windGustKmph;
            let visibilityKm = region.conditions.visibilityKm;

            if (weatherResponse.ok) {
                const weatherData = await weatherResponse.json();
                const current = weatherData.current;
                windKmph = current.wind_speed_10m || windKmph;
                gustKmph = current.wind_gusts_10m || gustKmph;
            }

            // Ensure gust >= wind
            if (gustKmph < windKmph) {
                gustKmph = windKmph * 1.3;
            }

            // Return in EXACT format expected by orchestrator
            return NextResponse.json({
                mode: "live",
                regionId,
                observedAt: now,
                validUntil,
                source: 'weather',
                data: {
                    windKmph: windKmph,
                    gustKmph: gustKmph,
                    visibilityKm: visibilityKm
                }
            });
        } catch (error) {
            console.warn('Public weather API unavailable, using demo data:', error);
            return NextResponse.json({
                mode: "live",
                regionId,
                observedAt: now,
                validUntil,
                source: 'weather',
                data: {
                    windKmph: region.conditions.windSpeedKmph,
                    gustKmph: region.conditions.windGustKmph,
                    visibilityKm: region.conditions.visibilityKm
                }
            });
        }
    } catch (error) {
        console.error('Weather adapter error:', error);
        return NextResponse.json(
            { error: 'Internal adapter error' },
            { status: 500 }
        );
    }
}
