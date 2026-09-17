/**
 * Route Engine - Evaluates route safety and viability
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { regionId, sources, annotations, riskFloor } = body;

        if (!regionId || !sources) {
            return NextResponse.json(
                { error: 'regionId and sources are required' },
                { status: 400 }
            );
        }

        const now = new Date().toISOString();
        const validUntil = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();

        // Route assessment
        const incois = sources.incois?.data;
        const copernicus = sources.copernicus?.data;
        const weather = sources.weather?.data;

        let routeStatus: 'not_evaluated' | 'blocked' | 'insufficient_context' = 'not_evaluated';
        let riskLevel: 'low' | 'moderate' | 'high' = 'low';
        const evidenceList: string[] = [];

        // Determine if we have enough context
        const hasWaveData = (incois?.waveHeightM !== undefined && incois?.waveHeightM !== null) ||
            (copernicus?.waveHeightM !== undefined && copernicus?.waveHeightM !== null);
        const hasWindData = weather?.windKmph !== undefined && weather?.windKmph !== null;

        if (!hasWaveData || !hasWindData) {
            routeStatus = 'insufficient_context';
            riskLevel = 'moderate';
            evidenceList.push('waves', 'wind');
        } else {
            // Evaluate route with available data
            routeStatus = 'not_evaluated';

            // Check for blocking conditions
            if (incois?.waveHeightM >= 4.0 || copernicus?.waveHeightM >= 4.0) {
                routeStatus = 'blocked';
                riskLevel = 'high';
                evidenceList.push('waves');
            } else if (incois?.waveHeightM >= 3.0 || copernicus?.waveHeightM >= 3.0) {
                riskLevel = 'moderate';
                evidenceList.push('waves');
            }

            if (weather?.windKmph >= 50) {
                routeStatus = 'blocked';
                riskLevel = 'high';
                evidenceList.push('wind');
            } else if (weather?.windKmph >= 35) {
                if (riskLevel !== 'high') riskLevel = 'moderate';
                evidenceList.push('wind');
            }

            if (weather?.visibilityKm < 2) {
                routeStatus = 'blocked';
                riskLevel = 'high';
                evidenceList.push('visibility');
            } else if (weather?.visibilityKm < 5) {
                if (riskLevel !== 'high') riskLevel = 'moderate';
                evidenceList.push('visibility');
            }

            if (incois?.advisoryActive) {
                if (routeStatus === 'not_evaluated') routeStatus = 'blocked';
                riskLevel = 'high';
                evidenceList.push('advisory');
            }

            if (incois?.cycloneDistanceKm !== null && incois?.cycloneDistanceKm < 100) {
                routeStatus = 'blocked';
                riskLevel = 'high';
                evidenceList.push('cyclone');
            } else if (incois?.cycloneDistanceKm !== null && incois?.cycloneDistanceKm < 250) {
                if (riskLevel !== 'high') riskLevel = 'moderate';
                evidenceList.push('cyclone');
            }

            // Respect risk floor
            if (riskFloor === 'high' && riskLevel !== 'high') {
                riskLevel = 'high';
            }
        }

        // Ensure we have at least one evidence ID
        if (evidenceList.length === 0) {
            evidenceList.push('waves');
        }

        return NextResponse.json({
            mode: 'live',
            engine: 'route',
            regionId,
            observedAt: now,
            validUntil,
            sourceObservations: {
                incois: sources.incois?.observedAt || now,
                copernicus: sources.copernicus?.observedAt || now,
                weather: sources.weather?.observedAt || now
            },
            riskLevel,
            routeStatus,
            evidenceIds: evidenceList
        });
    } catch (error) {
        console.error('Route engine error:', error);
        return NextResponse.json(
            { error: 'Internal engine error' },
            { status: 500 }
        );
    }
}
