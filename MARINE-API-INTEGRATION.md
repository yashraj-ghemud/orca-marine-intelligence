# ORCA Marine API Integration Guide

This document describes the comprehensive marine data API integration in ORCA, combining multiple authoritative sources for real-time ocean intelligence.

## 🌊 Integrated Data Sources

### 1. INCOIS (Indian National Centre for Ocean Information Services)

**Services Integrated:**
- Ocean State Forecast (OSF) - waves, currents, SST
- Potential Fishing Zones (PFZ)
- Wave forecasts and swell data
- Marine advisories

**Access:**
- Free for public visualization
- API access requires registration
- WMS/WFS services available for map layers

**Configuration:**
```env
INCOIS_API_KEY=your_api_key_here
INCOIS_BASE_URL=https://incois.gov.in/portal/datainfo
INCOIS_PFZ_API_URL=https://incois.gov.in/portal/osf/map.jsp
INCOIS_PFZ_WMS_URL=https://incois.gov.in/geoserver/wms
```

**Usage:**
```typescript
import { incoisClient } from '@/lib/api/incois';

// Get ocean state forecast
const forecast = await incoisClient.getOceanStateForecast(lat, lng);

// Get PFZ data for a region
const pfzZones = await incoisClient.getPFZData('mumbai');

// Get wave data
const waves = await incoisClient.getWaveData(lat, lng);
```

### 2. Copernicus Marine Service

**Services Integrated:**
- Historical ocean data (for ML training)
- Wave forecasts (significant height, period, direction)
- Ocean current forecasts
- Sea Surface Temperature (SST)
- Chlorophyll concentration

**Access:**
- Free account required
- Programmatic access via Marine Toolbox
- REST API and Python client available

**Configuration:**
```env
COPERNICUS_USERNAME=your_username
COPERNICUS_PASSWORD=your_password
COPERNICUS_API_URL=https://data.marine.copernicus.eu/api
```

**Usage:**
```typescript
import { copernicusClient } from '@/lib/api/copernicus';

// Get comprehensive forecast
const forecast = await copernicusClient.getForecast(lat, lng);

// Get specific data types
const waves = await copernicusClient.getWaveData(lat, lng);
const currents = await copernicusClient.getCurrentData(lat, lng);
const sst = await copernicusClient.getSSTData(lat, lng);
const chlorophyll = await copernicusClient.getChlorophyllData(lat, lng);

// Get historical data for ML training
const historical = await copernicusClient.getHistoricalData(
  lat, lng, 
  '2023-01-01', 
  '2024-01-01',
  ['waves', 'currents', 'sst']
);
```

### 3. IMD (India Meteorological Department)

**Services Integrated:**
- Current weather conditions
- Fishermen warnings
- Coastal and sea bulletins
- Cyclone tracking and warnings
- Marine forecasts

**Access:**
- Official API portal with free registration
- Real-time weather and cyclone data
- Multi-language support (English, Hindi)

**Configuration:**
```env
IMD_API_KEY=your_api_key_here
IMD_API_BASE_URL=https://api.imd.gov.in
IMD_API_VERSION=v1
```

**Usage:**
```typescript
import { imdClient } from '@/lib/api/imd';

// Get current weather
const weather = await imdClient.getCurrentWeather(lat, lng);

// Get fishermen warnings
const warnings = await imdClient.getFishermenWarnings('mumbai');

// Get coastal bulletin
const bulletin = await imdClient.getCoastalBulletin('kerala');

// Track active cyclones
const cyclones = await imdClient.getActiveCyclones();

// Get comprehensive marine forecast
const forecast = await imdClient.getMarineForecast(lat, lng, 'goa');
```

### 4. OpenWeatherMap (Supplementary)

**Services Integrated:**
- Additional weather data
- Wind forecasts
- Cloud cover and precipitation
- Extended forecasts

**Configuration:**
```env
OPENWEATHER_API_KEY=your_api_key_here
```

**Usage:**
```typescript
import { openWeatherClient } from '@/lib/api/openweather';

const data = await openWeatherClient.getCurrentWeather(lat, lng);
```

## 🔄 Data Aggregator

The `MarineDataAggregator` combines data from all sources intelligently:

```typescript
import { marineDataAggregator } from '@/lib/api/marine-data-aggregator';

// Get aggregated data from all sources
const data = await marineDataAggregator.getAggregatedData(
  lat, 
  lng, 
  'mumbai',
  {
    includePFZ: true,
    includeCyclone: true,
    timeout: 10000
  }
);

// Data includes quality indicators
console.log(data.quality);
// {
//   incoisAvailable: true,
//   copernicusAvailable: true,
//   imdAvailable: true,
//   overall: 'excellent'
// }
```

### Smart Features:

1. **Parallel Fetching**: All sources queried simultaneously
2. **Fallback Logic**: If one source fails, uses alternatives
3. **Data Prioritization**: INCOIS preferred for Indian waters
4. **Quality Assessment**: Tracks data availability and quality
5. **Timeout Protection**: Prevents hanging on slow APIs
6. **Error Resilience**: Continues with partial data if some sources fail

## 🚀 API Endpoints

### Marine Data API

**Base URL:** `/api/marine`

**Query Parameters:**
- `lat` (required): Latitude (-90 to 90)
- `lng` (required): Longitude (-180 to 180)
- `region` (optional): Region name (mumbai, goa, kerala, chennai)
- `source` (optional): Data source (incois, copernicus, imd, all)
- `type` (optional): Data type (forecast, waves, pfz, cyclone, weather)

**Examples:**

```bash
# Get aggregated forecast for Mumbai
GET /api/marine?lat=18.92&lng=72.82&region=mumbai

# Get INCOIS wave data
GET /api/marine?lat=18.92&lng=72.82&source=incois&type=waves

# Get PFZ data
GET /api/marine?region=kerala&type=pfz

# Get cyclone tracking
GET /api/marine?lat=18.92&lng=72.82&type=cyclone

# Get IMD warnings
GET /api/marine?region=goa&source=imd&type=warnings
```

**Response Format:**

```json
{
  "success": true,
  "data": {
    "location": { "lat": 18.92, "lng": 72.82, "region": "mumbai" },
    "timestamp": "2024-01-15T08:30:00Z",
    "waves": {
      "height": 3.2,
      "period": 9,
      "direction": "SW",
      "source": "incois"
    },
    "currents": {
      "speed": 1.8,
      "direction": "225",
      "source": "incois"
    },
    "sst": {
      "temperature": 28.6,
      "source": "copernicus"
    },
    "weather": {
      "temperature": 30.2,
      "humidity": 75,
      "windSpeed": 28,
      "windDirection": "SW",
      "visibility": 4
    },
    "warnings": [
      {
        "type": "fishermen",
        "severity": "high",
        "message": "Squally weather with wind speed 40-50 km/h likely",
        "messageHi": "40-50 किमी/घंटा तेज़ हवाएं संभव",
        "validUntil": "2024-01-15T18:00:00Z"
      }
    ],
    "pfzZones": [...],
    "cyclone": {...},
    "quality": {
      "incoisAvailable": true,
      "copernicusAvailable": true,
      "imdAvailable": true,
      "overall": "excellent"
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T08:30:00Z",
    "source": "all",
    "type": "forecast",
    "location": { "lat": 18.92, "lng": 72.82, "region": "mumbai" }
  }
}
```

## 📊 Data Types

### Wave Data
```typescript
{
  height: number;          // Significant wave height (m)
  period: number;          // Wave period (s)
  direction: string;       // Direction (N, NE, etc.)
  swellHeight?: number;    // Swell height (m)
  swellPeriod?: number;    // Swell period (s)
}
```

### Current Data
```typescript
{
  speed: number;          // Current speed (knots)
  direction: string;      // Direction
  eastward?: number;      // U component (m/s)
  northward?: number;     // V component (m/s)
}
```

### SST Data
```typescript
{
  temperature: number;    // Sea surface temperature (°C)
  depth?: number;         // Depth (m)
}
```

### PFZ Zone
```typescript
{
  id: string;
  latitude: number;
  longitude: number;
  sst: number;
  chlorophyll: number;
  potentialSpecies: string[];
  confidence: 'high' | 'medium' | 'low';
  distanceFromCoast?: number;
  accessibility?: 'easy' | 'moderate' | 'difficult';
}
```

### Cyclone Data
```typescript
{
  name: string;
  category: string;
  position: { lat: number; lng: number };
  distance: number;        // Distance from query point (km)
  bearing: string;         // Direction (N, NE, etc.)
  windSpeed: number;       // Wind speed (km/h)
  movement: string;        // Movement description
  forecast: Array<...>;    // Predicted track
}
```

## 🔧 Setup Instructions

### 1. Get API Keys

**INCOIS:**
1. Visit https://incois.gov.in
2. Register for data services
3. Request API access for OSF and PFZ data

**Copernicus Marine:**
1. Register at https://data.marine.copernicus.eu
2. Create free account
3. Note username and password for API access
4. Install Copernicus Marine Toolbox (optional): `pip install copernicusmarine`

**IMD:**
1. Visit IMD API Portal
2. Register for free account
3. Generate API key
4. Review rate limits and usage policy

**OpenWeatherMap:**
1. Sign up at https://openweathermap.org/api
2. Get free API key (1000 calls/day)
3. Upgrade for Marine Weather API if needed

### 2. Configure Environment

Copy API keys to `.env`:

```bash
# INCOIS
INCOIS_API_KEY=your_key_here
INCOIS_BASE_URL=https://incois.gov.in/portal/datainfo
INCOIS_PFZ_API_URL=https://incois.gov.in/portal/osf/map.jsp
INCOIS_PFZ_WMS_URL=https://incois.gov.in/geoserver/wms

# Copernicus
COPERNICUS_USERNAME=your_username
COPERNICUS_PASSWORD=your_password
COPERNICUS_API_URL=https://data.marine.copernicus.eu/api

# IMD
IMD_API_KEY=your_key_here
IMD_API_BASE_URL=https://api.imd.gov.in
IMD_API_VERSION=v1

# OpenWeatherMap
OPENWEATHER_API_KEY=your_key_here
```

### 3. Install Dependencies

No additional dependencies required - uses native `fetch` API.

### 4. Test Integration

```bash
# Start development server
npm run dev

# Test API endpoint
curl "http://localhost:3000/api/marine?lat=18.92&lng=72.82&region=mumbai"
```

## 🎯 Integration with ORCA Chat

To integrate real API data into the chat interface:

1. **Replace Mock Data**: Update `src/lib/mock-orca.ts` to call real APIs
2. **Update Store**: Modify Zustand store to handle live data
3. **Add Loading States**: Show loading indicators during API calls
4. **Handle Errors**: Display user-friendly error messages
5. **Cache Responses**: Implement caching to reduce API calls

Example integration in orchestrator:

```typescript
// src/lib/server/orchestrator.ts
import { marineDataAggregator } from './api/marine-data-aggregator';

export async function orchestrate(body: any, options: any) {
  // Detect location from query
  const { lat, lng, region } = extractLocation(body.query);
  
  // Fetch real marine data
  const marineData = await marineDataAggregator.getAggregatedData(
    lat, lng, region
  );
  
  // Process and generate response
  // ...
}
```

## 📈 Rate Limits & Caching

**Recommended Caching Strategy:**

- Weather data: 30 minutes
- Wave/Current forecasts: 1 hour
- PFZ data: 6 hours
- Cyclone tracking: 30 minutes
- Historical data: 24 hours

**Rate Limits:**

- INCOIS: Check service documentation
- Copernicus: Generally unlimited for registered users
- IMD: Check API portal for limits
- OpenWeatherMap Free: 1000 calls/day

## 🔒 Security Notes

- Never commit API keys to version control
- Use environment variables for all secrets
- Implement API key rotation policy
- Monitor usage to detect anomalies
- Use HTTPS for all API calls
- Validate and sanitize all input data

## 🐛 Troubleshooting

**Problem: API calls timing out**
- Increase timeout in aggregator options
- Check network connectivity
- Verify API service status

**Problem: Authentication errors**
- Verify API keys are correct
- Check if keys have expired
- Ensure proper URL encoding

**Problem: Missing data**
- Check API service coverage for the region
- Verify coordinates are within valid range
- Check quality indicators in response

**Problem: Rate limit exceeded**
- Implement request caching
- Use aggregator with longer timeout
- Consider upgrading API plan

## 📚 Additional Resources

- [INCOIS Services](https://incois.gov.in)
- [Copernicus Marine Documentation](https://help.marine.copernicus.eu/)
- [IMD Services](https://mausam.imd.gov.in/)
- [OpenWeatherMap API Docs](https://openweathermap.org/api)

## 🚦 Next Steps

1. ✅ API clients created
2. ✅ Data aggregator implemented
3. ✅ API endpoints exposed
4. ⏳ Replace mock data in chat
5. ⏳ Add real-time updates
6. ⏳ Implement WebSocket for live data
7. ⏳ Add historical data visualization
8. ⏳ Integrate ML predictions

---

**Note**: This integration provides a production-ready foundation for real marine data. Adjust caching strategies and error handling based on your specific requirements and API service terms.
