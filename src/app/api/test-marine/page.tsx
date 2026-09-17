'use client';

/**
 * Marine API Test Page
 * 
 * Interactive test page for marine data APIs
 */

import { useState } from 'react';

export default function TestMarinePage() {
    const [lat, setLat] = useState('18.92');
    const [lng, setLng] = useState('72.82');
    const [region, setRegion] = useState('mumbai');
    const [source, setSource] = useState('all');
    const [type, setType] = useState('forecast');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const testAPI = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const params = new URLSearchParams({
                lat,
                lng,
                region,
                source,
                type
            });

            const response = await fetch(`/api/marine?${params}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }

            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const presets = {
        mumbai: { lat: '18.92', lng: '72.82', region: 'mumbai' },
        goa: { lat: '15.42', lng: '73.78', region: 'goa' },
        kerala: { lat: '9.70', lng: '75.50', region: 'kerala' },
        chennai: { lat: '13.20', lng: '80.42', region: 'chennai' }
    };

    const loadPreset = (preset: keyof typeof presets) => {
        setLat(presets[preset].lat);
        setLng(presets[preset].lng);
        setRegion(presets[preset].region);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui' }}>
            <h1 style={{ marginBottom: '2rem' }}>🌊 ORCA Marine API Test</h1>

            <div style={{
                background: '#f5f5f5',
                padding: '1.5rem',
                borderRadius: '8px',
                marginBottom: '2rem'
            }}>
                <h2 style={{ marginTop: 0 }}>Configuration</h2>

                <div style={{ marginBottom: '1rem' }}>
                    <strong>Quick Presets:</strong>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {Object.keys(presets).map(preset => (
                            <button
                                key={preset}
                                onClick={() => loadPreset(preset as keyof typeof presets)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    background: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                {preset.charAt(0).toUpperCase() + preset.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                            <strong>Latitude:</strong>
                        </label>
                        <input
                            type="text"
                            value={lat}
                            onChange={(e) => setLat(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #ddd'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                            <strong>Longitude:</strong>
                        </label>
                        <input
                            type="text"
                            value={lng}
                            onChange={(e) => setLng(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #ddd'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                            <strong>Region:</strong>
                        </label>
                        <select
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #ddd'
                            }}
                        >
                            <option value="mumbai">Mumbai</option>
                            <option value="goa">Goa</option>
                            <option value="kerala">Kerala</option>
                            <option value="chennai">Chennai</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                            <strong>Source:</strong>
                        </label>
                        <select
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #ddd'
                            }}
                        >
                            <option value="all">All Sources (Aggregated)</option>
                            <option value="incois">INCOIS</option>
                            <option value="copernicus">Copernicus</option>
                            <option value="imd">IMD</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                            <strong>Data Type:</strong>
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #ddd'
                            }}
                        >
                            <option value="forecast">Full Forecast</option>
                            <option value="waves">Waves Only</option>
                            <option value="pfz">PFZ Zones</option>
                            <option value="cyclone">Cyclone Data</option>
                            <option value="weather">Weather Only</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={testAPI}
                    disabled={loading}
                    style={{
                        marginTop: '1rem',
                        padding: '0.75rem 2rem',
                        background: loading ? '#ccc' : '#124E78',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                        fontWeight: 'bold'
                    }}
                >
                    {loading ? 'Loading...' : 'Test API'}
                </button>
            </div>

            {error && (
                <div style={{
                    background: '#fee',
                    border: '1px solid #fcc',
                    padding: '1rem',
                    borderRadius: '4px',
                    marginBottom: '1rem',
                    color: '#c00'
                }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {result && (
                <div>
                    <h2>Result</h2>

                    {result.data?.quality && (
                        <div style={{
                            background: result.data.quality.overall === 'excellent' ? '#e8f5e9' :
                                result.data.quality.overall === 'good' ? '#fff9c4' :
                                    result.data.quality.overall === 'fair' ? '#ffe0b2' : '#ffcdd2',
                            padding: '1rem',
                            borderRadius: '4px',
                            marginBottom: '1rem'
                        }}>
                            <strong>Data Quality: {result.data.quality.overall.toUpperCase()}</strong>
                            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem' }}>
                                <li>INCOIS: {result.data.quality.incoisAvailable ? '✅' : '❌'}</li>
                                <li>Copernicus: {result.data.quality.copernicusAvailable ? '✅' : '❌'}</li>
                                <li>IMD: {result.data.quality.imdAvailable ? '✅' : '❌'}</li>
                            </ul>
                        </div>
                    )}

                    <pre style={{
                        background: '#1e1e1e',
                        color: '#d4d4d4',
                        padding: '1rem',
                        borderRadius: '4px',
                        overflow: 'auto',
                        maxHeight: '600px'
                    }}>
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}

            <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: '#e3f2fd',
                borderRadius: '4px'
            }}>
                <h3 style={{ marginTop: 0 }}>ℹ️ Note</h3>
                <p style={{ margin: 0 }}>
                    This is a test interface for the ORCA Marine API integration.
                    Configure your API keys in the <code>.env</code> file to get real data.
                    Currently displaying mock/demo data until API keys are configured.
                </p>
            </div>
        </div>
    );
}
