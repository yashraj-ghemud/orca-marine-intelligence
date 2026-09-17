/**
 * Geospatial Engine - Evaluates territorial boundaries and zones
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { regionId, sources } = body;

        if (!regionId || !sources) {
            return NextResponse.json(
                { error: 'regionId and sources are required' },
                { status: 400 }
            );
        }

        const now = new Date().toISOString();
        const validUntil = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();

        // Geospatial assessment - in real implementation would check actual boundaries
        const incois = sources.incois?.data;

        const boundaryStatus = incois?.boundaryStatus || 'clear';

        let riskLevel: 'low' | 'moderate' | 'high' = 'low';
        const evidenceList: string[] = ['boundary'];

        if (boundaryStatus === 'restricted') {
            riskLevel = 'high';
        } else if (boundaryStatus === 'unknown') {
            riskLevel = 'moderate';
        }

        // Check hazards
        if (incois?.hazardSeverity === 'severe') {
            riskLevel = 'high';
            evidenceList.push('hazards');
        } else if (incois?.hazardSeverity === 'high' || incois?.hazardSeverity === 'moderate') {
            if (riskLevel === 'low') riskLevel = 'moderate';
            evidenceList.push('hazards');
        }

        // Check cyclone proximity
        if (incois?.cycloneDistanceKm !== null && incois?.cycloneDistanceKm <= 100) {
            riskLevel = 'high';
            evidenceList.push('cyclone');
        } else if (incois?.cycloneDistanceKm !== null && incois?.cycloneDistanceKm <= 300) {
            if (riskLevel === 'low') riskLevel = 'moderate';
            evidenceList.push('cyclone');
        }

        return NextResponse.json({
            mode: 'live',
            engine: 'geospatial',
            regionId,
            observedAt: now,
            validUntil,
            sourceObservations: {
                incois: sources.incois?.observedAt || now,
                copernicus: sources.copernicus?.observedAt || now,
                weather: sources.weather?.observedAt || now
            },
            riskLevel,
            boundaryStatus,
            evidenceIds: evidenceList
        });
    } catch (error) {
        console.error('Geospatial engine error:', error);
        return NextResponse.json(
            { error: 'Internal engine error' },
            { status: 500 }
        );
    }
}
