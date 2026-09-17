# 🚀 Quick Start: ORCA with Live Marine Data

## 🎯 What You Have Now

ORCA now includes **real marine data integration** with 4 major sources:
- ✅ INCOIS (Indian Ocean data)
- ✅ Copernicus Marine (Global ocean data)  
- ✅ IMD (Weather & cyclones)
- ✅ OpenWeatherMap (Additional weather)

## ⚡ 5-Minute Setup

### Step 1: Choose Your Mode

#### Option A: Demo Mode (No Setup)
```bash
npm run dev
```
- Uses simulated data
- No API keys needed
- All features work
- Perfect for testing UI

#### Option B: Live Data Mode (Recommended)
Get real marine data from authoritative sources!

### Step 2: Get Free API Keys

**INCOIS** (5 min)
```
🔗 https://incois.gov.in
📝 Register → Request API Access
```

**Copernicus** (5 min)
```
🔗 https://marine.copernicus.eu
📝 Create Free Account
```

**IMD** (5 min)
```
🔗 IMD API Portal  
📝 Register → Generate Key
```

**OpenWeatherMap** (2 min)
```
🔗 https://openweathermap.org/api
📝 Sign Up → Get Free Key
```

### Step 3: Configure `.env`

Open `.env` and add your keys:

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

### Step 4: Start Server

```bash
npm run dev
```

### Step 5: Test Integration

Visit: **http://localhost:3000/api/test-marine**

✅ Try different regions  
✅ Test data sources  
✅ Check data quality  
✅ View JSON responses  

## 🎨 Usage Examples

### In React Components

```typescript
import { useMarineData } from '@/hooks/useMarineData';

function MyComponent() {
  const { data, loading, error } = useMarineData(18.92, 72.82, {
    region: 'mumbai',
    autoFetch: true,
    refreshInterval: 300000 // 5 min
  });

  return (
    <div>
      <h2>Wave: {data?.waves.height}m</h2>
      <h2>SST: {data?.sst.temperature}°C</h2>
      <p>Quality: {data?.quality.overall}</p>
    </div>
  );
}
```

### API Calls

```bash
# Complete forecast
curl "http://localhost:3000/api/marine?lat=18.92&lng=72.82&region=mumbai"

# Wave data
curl "http://localhost:3000/api/marine?lat=18.92&lng=72.82&type=waves"

# PFZ zones
curl "http://localhost:3000/api/marine?region=kerala&type=pfz"
```

### TypeScript Client

```typescript
import { marineDataAggregator } from '@/lib/api';

const data = await marineDataAggregator.getAggregatedData(
  18.92,  // latitude
  72.82,  // longitude
  'mumbai' // region
);

console.log(data.waves.height);
console.log(data.quality.overall);
```

## 📊 What Data You Get

```typescript
{
  waves: {
    height: 3.2,        // meters
    period: 9,          // seconds
    direction: "SW",
    source: "incois"
  },
  currents: {
    speed: 1.8,         // knots
    direction: "225"
  },
  sst: {
    temperature: 28.6   // °C
  },
  weather: {
    temperature: 30.2,
    windSpeed: 28,
    visibility: 4
  },
  warnings: [...],
  pfzZones: [...],
  cyclone: {...},
  quality: {
    overall: "excellent"
  }
}
```

## 🗂️ File Structure

```
New Files:
├── src/lib/api/                     # API clients
│   ├── incois.ts
│   ├── copernicus.ts
│   ├── imd.ts
│   ├── openweather.ts
│   ├── marine-data-aggregator.ts
│   └── index.ts
├── src/hooks/
│   └── useMarineData.ts             # React hooks
├── src/app/api/
│   ├── marine/route.ts              # API endpoint
│   └── test-marine/page.tsx         # Test page
└── Documentation/
    ├── README-API.md
    ├── API-QUICK-START.md
    ├── MARINE-API-INTEGRATION.md
    └── IMPLEMENTATION-COMPLETE.md
```

## 🎯 Quick Commands

```bash
# Start dev server
npm run dev

# Test API
curl "localhost:3000/api/marine?lat=18.92&lng=72.82&region=mumbai"

# View test page
open http://localhost:3000/api/test-marine
```

## 📚 Documentation

| File | Purpose |
|------|---------|
| **README-API.md** | Main overview |
| **API-QUICK-START.md** | Setup guide |
| **MARINE-API-INTEGRATION.md** | Full technical docs |
| **IMPLEMENTATION-COMPLETE.md** | What was built |

## 🔧 Integration Steps

### 1. Replace Mock Data (Easy)

In `src/lib/mock-orca.ts`:

```typescript
import { marineDataAggregator } from './api/marine-data-aggregator';

// Instead of mock data:
const data = await marineDataAggregator.getAggregatedData(
  lat, lng, region
);
```

### 2. Add to Chat (Simple)

```typescript
const { data } = useMarineData(
  region.center.lat,
  region.center.lng,
  { region: region.id }
);
```

### 3. Show Quality Badge (Nice)

```typescript
{data && (
  <Badge variant={data.quality.overall}>
    {data.quality.overall}
  </Badge>
)}
```

## ✅ Verification Checklist

After setup, verify:
- [ ] Server starts without errors
- [ ] `/api/test-marine` page loads
- [ ] Can select different regions
- [ ] Data quality shows "excellent" or "good"
- [ ] JSON response displays properly
- [ ] All 4 sources show as available

## 🐛 Troubleshooting

**Server won't start?**
```bash
# Check Node version
node --version  # Should be 20.9+

# Reinstall dependencies
rm -rf node_modules
npm ci
```

**API returns errors?**
- Check API keys in `.env`
- Verify keys are valid
- Check API service status
- Look at quality indicators

**No data returned?**
- Check if running in demo mode
- Verify coordinates are valid
- Look at console errors
- Test with `/api/test-marine`

## 💡 Pro Tips

1. **Use Test Page** - Always test new API keys here first
2. **Check Quality** - Look at `data.quality.overall`
3. **Cache Data** - Implement caching to reduce API calls
4. **Monitor Usage** - Keep track of rate limits
5. **Start Simple** - Use aggregated endpoint first

## 🌟 Next Steps

### Now (5 minutes)
1. ✅ Get API keys
2. ✅ Add to `.env`
3. ✅ Test on `/api/test-marine`

### Soon (1 hour)
1. ⏳ Replace mock data in chat
2. ⏳ Add loading states
3. ⏳ Show data quality badges

### Later (1 week)
1. ⏳ Add WMS layers to map
2. ⏳ Show real PFZ zones
3. ⏳ Display cyclone tracks

## 📞 Need Help?

1. Check documentation files
2. Use `/api/test-marine` to debug
3. Look at console errors
4. Verify API keys are correct

## 🎊 You're Ready!

You now have:
- ✅ Real marine data APIs
- ✅ Smart aggregation
- ✅ React hooks
- ✅ REST endpoints
- ✅ Test interface
- ✅ Full documentation

**Start building!** 🚀

---

**Demo Mode:** No setup needed, simulated data  
**Live Mode:** 15 min setup, real authoritative data

Choose your mode and dive in! 🌊
