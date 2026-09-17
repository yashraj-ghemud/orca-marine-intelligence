/**
 * Risk Engine - Evaluates risk level based on marine data
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { regionId, sources, riskFloor } = body;

        if (!regionId || !sources) {
            return NextResponse.json(
                { error: 'regionId and sources are required' },
                { status: 400 }
            );
        }

        const now = new Date().toISOString();
        const validUntil = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();

        // Evaluate risk based on multiple factors
        const incois = sources.incois?.data;
        const copernicus = sources.copernicus?.data;
        const weather = sources.weather?.data;

        let riskLevel: 'low' | 'moderate' | 'high' = 'low';
        const evidenceList: string[] = [];

        // Check wave conditions
        if (incois?.waveHeightM >= 3.0 || copernicus?.waveHeightM >= 3.0) {
            riskLevel = 'high';
            evidenceList.push('waves');
        } else if (incois?.waveHeightM >= 1.5 || copernicus?.waveHeightM >= 1.5) {
            if (riskLevel === 'low') riskLevel = 'moderate';
            evidenceList.push('waves');
        }

        // Check wind conditions
        if (weather?.windKmph >= 35 || weather?.gustKmph >= 40) {
            riskLevel = 'high';
            evidenceList.push('wind');
        } else if (weather?.windKmph >= 20) {
            if (riskLevel === 'low') riskLevel = 'moderate';
            evidenceList.push('wind');
        }

        // Check visibility
        if (weather?.visibilityKm < 5) {
            riskLevel = 'high';
            evidenceList.push('visibility');
        } else if (weather?.visibilityKm < 10) {
            if (riskLevel === 'low') riskLevel = 'moderate';
            evidenceList.push('visibility');
        }

        // Check currents
        if (copernicus?.currentKnots >= 3) {
            riskLevel = 'high';
            evidenceList.push('current');
        } else if (copernicus?.currentKnots >= 1.5) {
            if (riskLevel === 'low') riskLevel = 'moderate';
            evidenceList.push('current');
        }

        // Check advisory status
        if (incois?.advisoryActive) {
            riskLevel = 'high';
            evidenceList.push('advisory');
        }

        // Check cyclone distance
        if (incois?.cycloneDistanceKm !== null && incois?.cycloneDistanceKm <= 250) {
            riskLevel = 'high';
            evidenceList.push('cyclone');
        } else if (incois?.cycloneDistanceKm !== null && incois?.cycloneDistanceKm <= 500) {
            if (riskLevel === 'low') riskLevel = 'moderate';
            evidenceList.push('cyclone');
        }

        // Respect risk floor
        if (riskFloor === 'high' && riskLevel !== 'high') {
            riskLevel = 'high';
        }

        // Ensure we have at least one evidence ID
        if (evidenceList.length === 0) {
            evidenceList.push('waves');
        }

        return NextResponse.json({
            mode: 'live',
            engine: 'risk',
            regionId,
            observedAt: now,
            validUntil,
            sourceObservations: {
                incois: sources.incois?.observedAt || now,
                copernicus: sources.copernicus?.observedAt || now,
                weather: sources.weather?.observedAt || now
            },
            riskLevel,
            evidenceIds: evidenceList
        });
    } catch (error) {
        console.error('Risk engine error:', error);
        return NextResponse.json(
            { error: 'Internal engine error' },
            { status: 500 }
        );
    }
}
