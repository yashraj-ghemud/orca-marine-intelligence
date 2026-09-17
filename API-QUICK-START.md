# 🚀 ORCA Marine API - Quick Start Guide

## Overview

ORCA now integrates **real marine data** from multiple authoritative sources:

- ✅ **INCOIS** - Ocean State Forecast, PFZ, Wave data
- ✅ **Copernicus Marine** - Historical data, forecasts, SST, chlorophyll
- ✅ **IMD** - Weather, warnings, cyclone tracking
- ✅ **OpenWeatherMap** - Additional weather data

## Quick Setup (5 Minutes)

### 1. Get API Keys (Free)

**INCOIS** (Indian Ocean Data)
```
🔗 https://incois.gov.in
📝 Register → Request API Access → Get Key
```

**Copernicus Marine** (Global Ocean Data)
```
🔗 https://data.marine.copernicus.eu
📝 Create Account (Free) → Note Username & Password
```

**IMD** (Weather & Cyclones)
```
🔗 IMD API Portal
📝 Register → Generate API Key
```

**OpenWeatherMap** (Supplementary Weather)
```
🔗 https://openweathermap.org/api
📝 Sign Up → Get Free Key (1000 calls/day)
```

### 2. Configure `.env`

```env
# INCOIS
INCOIS_API_KEY=your_incois_key_here

# Copernicus
COPERNICUS_USERNAME=your_username
COPERNICUS_PASSWORD=your_password

# IMD
IMD_API_KEY=your_imd_key_here

# OpenWeatherMap
OPENWEATHER_API_KEY=your_openweather_key_here
```

### 3. Test Integration

```bash
# Start server
npm run dev

# Visit test page
http://localhost:3000/api/test-marine

# Or test API directly
curl "http://localhost:3000/api/marine?lat=18.92&lng=72.82&region=mumbai"
```

## Usage Examples

### 1. In React Components (Hook)

```typescript
import { useMarineData } from '@/hooks/useMarineData';

function MyComponent() {
  const { data, loading, error } = useMarineData(18.92, 72.82, {
    region: 'mumbai',
    autoFetch: true,
    refreshInterval: 300000 // Refresh every 5 minutes
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Wave Height: {data?.waves.height}m</h2>
      <h2>SST: {data?.sst.temperature}°C</h2>
      <h2>Wind: {data?.weather.windSpeed} km/h</h2>
    </div>
  );
}
```

### 2. Direct API Calls

```typescript
// Get complete forecast
const response = await fetch(
  '/api/marine?lat=18.92&lng=72.82&region=mumbai'
);
const { data } = await response.json();

// Get specific data types
const waves = await fetch('/api/marine?lat=18.92&lng=72.82&type=waves');
const pfz = await fetch('/api/marine?region=kerala&type=pfz');
const cyclone = await fetch('/api/marine?lat=18.92&lng=72.82&type=cyclone');
```

### 3. Using Individual Clients

```typescript
import { incoisClient, imdClient, copernicusClient } from '@/lib/api';

// INCOIS Ocean State Forecast
const osf = await incoisClient.getOceanStateForecast(18.92, 72.82);

// IMD Fishermen Warnings
const warnings = await imdClient.getFishermenWarnings('mumbai');

// Copernicus Wave Data
const waves = await copernicusClient.getWaveData(18.92, 72.82);
```

### 4. Aggregated Data (Recommended)

```typescript
import { marineDataAggregator } from '@/lib/api';

// Get data from all sources with intelligent fallback
const data = await marineDataAggregator.getAggregatedData(
  18.92,  // latitude
  72.82,  // longitude
  'mumbai', // region
  {
    includePFZ: true,
    includeCyclone: true,
    timeout: 10000
  }
);

// Check data quality
console.log(data.quality.overall); // 'excellent' | 'good' | 'fair' | 'poor'
```

## API Endpoints

### GET `/api/marine`

**Parameters:**

| Param | Required | Values | Description |
|-------|----------|--------|-------------|
| `lat` | ✅ | -90 to 90 | Latitude |
| `lng` | ✅ | -180 to 180 | Longitude |
| `region` | ❌ | mumbai, goa, kerala, chennai | Region name |
| `source` | ❌ | all, incois, copernicus, imd | Data source |
| `type` | ❌ | forecast, waves, pfz, cyclone, weather | Data type |

**Examples:**

```bash
# Complete forecast for Mumbai
/api/marine?lat=18.92&lng=72.82&region=mumbai

# Only wave data
/api/marine?lat=18.92&lng=72.82&type=waves

# PFZ zones for Kerala
/api/marine?region=kerala&type=pfz

# INCOIS data only
/api/marine?lat=18.92&lng=72.82&source=incois

# Cyclone tracking
/api/marine?lat=18.92&lng=72.82&type=cyclone
```

## Data Structure

```typescript
{
  success: true,
  data: {
    location: { lat: 18.92, lng: 72.82, region: "mumbai" },
    timestamp: "2024-01-15T08:30:00Z",
    
    // Wave conditions
    waves: {
      height: 3.2,        // meters
      period: 9,          // seconds
      direction: "SW",
      source: "incois"
    },
    
    // Ocean currents
    currents: {
      speed: 1.8,         // knots
      direction: "225",
      source: "incois"
    },
    
    // Sea temperature
    sst: {
      temperature: 28.6,  // °C
      source: "copernicus"
    },
    
    // Weather
    weather: {
      temperature: 30.2,
      humidity: 75,
      windSpeed: 28,
      windDirection: "SW",
      visibility: 4
    },
    
    // Warnings
    warnings: [
      {
        type: "fishermen",
        severity: "high",
        message: "Squally weather...",
        messageHi: "तेज़ हवाएं...",
        validUntil: "2024-01-15T18:00:00Z"
      }
    ],
    
    // Fishing zones
    pfzZones: [...],
    
    // Active cyclones
    cyclone: {...},
    
    // Data quality
    quality: {
      incoisAvailable: true,
      copernicusAvailable: true,
      imdAvailable: true,
      overall: "excellent"
    }
  }
}
```

## React Hooks

### `useMarineData`

Main hook for fetching marine data:

```typescript
const { data, loading, error, fetch, refetch, clear } = useMarineData(
  lat,
  lng,
  {
    region: 'mumbai',
    source: 'all',
    type: 'forecast',
    autoFetch: true,
    refreshInterval: 300000
  }
);
```

### Specialized Hooks

```typescript
// Wave data only
const { data } = useWaveData(18.92, 72.82);

// PFZ zones
const { data } = usePFZData('kerala');

// Cyclone tracking
const { data } = useCycloneData(18.92, 72.82);

// Weather only
const { data } = useWeatherData(18.92, 72.82);
```

## Integration with Chat

Replace mock data in orchestrator:

```typescript
// src/lib/server/orchestrator.ts
import { marineDataAggregator } from './api/marine-data-aggregator';

export async function orchestrate(body: any, options: any) {
  const { lat, lng, region } = extractLocationFromQuery(body.query);
  
  // Fetch real data
  const marineData = await marineDataAggregator.getAggregatedData(
    lat, lng, region
  );
  
  // Use real data in response generation
  const response = await generateResponse(body.query, marineData);
  
  return response;
}
```

## Caching Strategy

**Recommended cache durations:**

- Weather data: 30 minutes
- Wave forecasts: 1 hour
- PFZ data: 6 hours
- Cyclone tracking: 30 minutes
- Historical data: 24 hours

Implement in Next.js:

```typescript
fetch(url, {
  next: { revalidate: 3600 } // 1 hour
});
```

## Error Handling

The aggregator provides resilient error handling:

```typescript
const data = await marineDataAggregator.getAggregatedData(...);

// Check quality
if (data.quality.overall === 'poor') {
  console.warn('Limited data available');
}

// Fallback to mock data if needed
const finalData = data.quality.overall !== 'poor' 
  ? data 
  : mockMarineData;
```

## Rate Limits

**Free Tier Limits:**

- INCOIS: Check service documentation
- Copernicus: Generally unlimited for registered users
- IMD: Check API portal
- OpenWeatherMap: 1000 calls/day

**Tips:**
- Implement caching
- Use aggregator to minimize calls
- Consider upgrading for production use

## Troubleshooting

### API Keys Not Working

```bash
# Check if keys are loaded
echo $INCOIS_API_KEY

# Restart dev server after adding keys
npm run dev
```

### CORS Errors

All API calls go through `/api/marine` route (server-side), so no CORS issues.

### Timeout Errors

```typescript
// Increase timeout
const data = await marineDataAggregator.getAggregatedData(
  lat, lng, region,
  { timeout: 20000 } // 20 seconds
);
```

### Missing Data

Check quality indicators:

```typescript
if (!data.quality.incoisAvailable) {
  console.warn('INCOIS data unavailable');
}
```

## Testing

Test page: `http://localhost:3000/api/test-marine`

Features:
- ✅ Interactive parameter testing
- ✅ Regional presets
- ✅ Data quality indicators
- ✅ JSON response viewer

## Production Checklist

- [ ] Configure all API keys in production `.env`
- [ ] Set up caching strategy
- [ ] Implement rate limiting
- [ ] Add monitoring for API calls
- [ ] Set up error alerts
- [ ] Test with real coordinates
- [ ] Verify data quality thresholds
- [ ] Document API key rotation policy

## Resources

- 📖 [Full Integration Guide](./MARINE-API-INTEGRATION.md)
- 🔗 [INCOIS Services](https://incois.gov.in)
- 🔗 [Copernicus Marine](https://marine.copernicus.eu)
- 🔗 [IMD](https://mausam.imd.gov.in)
- 🔗 [OpenWeatherMap](https://openweathermap.org)

## Next Steps

1. ✅ Get API keys
2. ✅ Configure `.env`
3. ✅ Test with `/api/test-marine`
4. ⏳ Replace mock data in chat
5. ⏳ Add real-time updates
6. ⏳ Implement historical data viz
7. ⏳ Add ML predictions

---

**Need Help?** Check `MARINE-API-INTEGRATION.md` for detailed documentation.
