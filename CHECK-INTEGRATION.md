# ✅ ORCA Integration Checklist

## Quick Verification Guide

Use this to verify everything is properly integrated.

## 1️⃣ Check Configuration (.env)

Open `.env` and verify these lines exist:

```env
✅ ORCA_INCOIS_ADAPTER_URL=http://localhost:3000/api/adapters/incois
✅ ORCA_COPERNICUS_ADAPTER_URL=http://localhost:3000/api/adapters/copernicus
✅ ORCA_WEATHER_ADAPTER_URL=http://localhost:3000/api/adapters/weather
✅ RISK_ENGINE_URL=http://localhost:3000/api/engines/risk
✅ GEOSPATIAL_ENGINE_URL=http://localhost:3000/api/engines/geospatial
✅ ROUTE_ENGINE_URL=http://localhost:3000/api/engines/route
```

**Status:** ✅ Already configured

## 2️⃣ Check Files Exist

### API Clients
```
✅ src/lib/api/incois.ts
✅ src/lib/api/copernicus.ts
✅ src/lib/api/imd.ts
✅ src/lib/api/openweather.ts
✅ src/lib/api/marine-data-aggregator.ts
✅ src/lib/api/index.ts
```

### Adapters (Bridge to APIs)
```
✅ src/app/api/adapters/incois/route.ts
✅ src/app/api/adapters/copernicus/route.ts
✅ src/app/api/adapters/weather/route.ts
```

### Engines (Risk Assessment)
```
✅ src/app/api/engines/risk/route.ts
✅ src/app/api/engines/geospatial/route.ts
✅ src/app/api/engines/route/route.ts
```

### Public APIs
```
✅ src/app/api/marine/route.ts
✅ src/app/api/test-marine/page.tsx
```

### React Hooks
```
✅ src/hooks/useMarineData.ts
```

## 3️⃣ Start Server

```bash
npm run dev
```

**Expected Output:**
```
✓ Ready in 2.5s
○ Local:        http://localhost:3000
○ Environments: .env
```

## 4️⃣ Test Endpoints

### A. Health Check
```bash
curl http://localhost:3000/api/orca
```

**Expected:** JSON with `"status": "ok"` and `"liveConfigured": true`

### B. INCOIS Adapter
```bash
curl -X POST http://localhost:3000/api/adapters/incois ^
  -H "Content-Type: application/json" ^
  -d "{\"regionId\":\"mumbai\"}"
```

**Expected:** JSON with `"source": "incois"` and wave data

### C. Risk Engine
```bash
curl -X POST http://localhost:3000/api/engines/risk ^
  -H "Content-Type: application/json" ^
  -d "{\"regionId\":\"mumbai\",\"sources\":{},\"riskFloor\":\"moderate\"}"
```

**Expected:** JSON with `"engine": "risk"` and `"riskLevel"`

### D. Public Marine API
```bash
curl "http://localhost:3000/api/marine?lat=18.92&lng=72.82&region=mumbai"
```

**Expected:** JSON with marine data from all sources

## 5️⃣ Test Chat Interface

### Open Browser
```
http://localhost:3000
```

### Try These Queries

1. **Safety Check:**
   ```
   "Is it safe for fishing today?"
   ```
   **Expected:** Response with verdict, risk level, and evidence

2. **Conditions:**
   ```
   "What are the conditions near Mumbai?"
   ```
   **Expected:** Wave height, wind, temperature data

3. **Hazards:**
   ```
   "Any hazards near Kerala?"
   ```
   **Expected:** Hazard assessment

4. **Route:**
   ```
   "Plan a route from Vizhinjam to Kochi"
   ```
   **Expected:** Route safety assessment

### Check Response Format

The response should include:
- ✅ Verdict (e.g., "CAUTION_ADVISED")
- ✅ Risk level (moderate/high)
- ✅ Evidence list with sources
- ✅ Explanation ("Why this result?")
- ✅ Agent contributions

## 6️⃣ Test Interface

### Open Test Page
```
http://localhost:3000/api/test-marine
```

### Verify Features
- [ ] Regional presets work (Mumbai, Goa, Kerala, Chennai)
- [ ] Can change coordinates
- [ ] Source selection works (all/incois/copernicus/imd)
- [ ] Type selection works (forecast/waves/pfz/cyclone)
- [ ] JSON response displays
- [ ] Data quality indicator shows

## 7️⃣ Check Live Mode Status

### In Chat Interface

Look for these indicators:

✅ **Working:** Response includes real data with sources
✅ **Working:** Evidence drawer shows data timestamps
✅ **Working:** "Live backend response" message appears
✅ **Working:** No "Live mode is not configured" error

❌ **Not Working:** Error message appears
❌ **Not Working:** Only demo data shown
❌ **Not Working:** Adapters fail to respond

## 8️⃣ Verify Data Flow

### Check Console Logs

When you send a chat message, you should see:

```
Calling adapter: incois
Adapter response: success
Calling adapter: copernicus  
Adapter response: success
Calling adapter: weather
Adapter response: success
Calling engine: risk
Engine response: success
```

### Check Network Tab

In browser DevTools → Network, you should see:

```
POST /api/orca (200 OK)
  └─ Calls to:
      POST /api/adapters/incois (200 OK)
      POST /api/adapters/copernicus (200 OK)
      POST /api/adapters/weather (200 OK)
      POST /api/engines/risk (200 OK)
      POST /api/engines/geospatial (200 OK)
      POST /api/engines/route (200 OK)
```

## 9️⃣ Test Fallback Behavior

### Without External API Keys

The system should:
- ✅ Still work (use demo data)
- ✅ Return valid responses
- ✅ Not crash or error
- ✅ Indicate data source in response

### With Invalid API Keys

The system should:
- ✅ Log warning to console
- ✅ Fall back to demo data
- ✅ Continue operating
- ✅ Return responses

## 🔟 Final Verification

### ✅ Complete Checklist

- [ ] Server starts without errors
- [ ] `.env` has all required URLs
- [ ] All adapter files exist
- [ ] All engine files exist
- [ ] Health endpoint returns `liveConfigured: true`
- [ ] Adapters respond with data
- [ ] Engines respond with assessments
- [ ] Public API works
- [ ] Chat responds to queries
- [ ] No "Live mode not configured" error
- [ ] Evidence includes data sources
- [ ] Test page works
- [ ] Fallback works without API keys

### ✅ If All Checked

**🎉 Congratulations! Your ORCA integration is working perfectly!**

### ❌ If Any Failed

**Check these:**

1. **Server not starting?**
   - Run `npm ci` to reinstall dependencies
   - Check Node.js version (need 20.9+)
   - Look for syntax errors in new files

2. **Adapters not responding?**
   - Check file paths are correct
   - Verify `.env` URLs point to `localhost:3000`
   - Check for TypeScript errors

3. **Chat shows error?**
   - Check browser console for details
   - Verify all required env vars are set
   - Check network tab for failed requests

4. **Fallback not working?**
   - Verify `mock-marine-data.ts` exists
   - Check import paths in adapter files
   - Look for errors in console

## 📊 Success Indicators

### Console Output (Good)
```
✓ Compiled successfully
✓ Ready on http://localhost:3000
```

### Console Output (Bad)
```
✗ Error: Cannot find module
✗ Module not found
✗ Syntax error
```

### Chat Response (Good)
```json
{
  "mode": "live",
  "status": "ok",
  "response": {
    "verdict": "CAUTION_ADVISED",
    "riskLevel": "high",
    "evidence": [...]
  }
}
```

### Chat Response (Bad)
```json
{
  "status": "error",
  "error": {
    "code": "CONFIG_MISSING",
    "message": "Live mode is not configured"
  }
}
```

## 🎯 Quick Test Script

Run this batch file to test everything:

```bash
test-live-mode.bat
```

**Expected:** JSON responses from all endpoints

## 📞 Troubleshooting Commands

### Check Server Status
```bash
curl http://localhost:3000/api/orca
```

### Test Individual Adapter
```bash
curl -X POST http://localhost:3000/api/adapters/incois ^
  -H "Content-Type: application/json" ^
  -d "{\"regionId\":\"mumbai\"}"
```

### Check Logs
Look at terminal where `npm run dev` is running for error messages.

### Clear Cache
```bash
rm -rf .next
npm run dev
```

## 🎊 Final Status

If all checks pass:

✅ **API Clients:** Working  
✅ **Adapters:** Operational  
✅ **Engines:** Functional  
✅ **Chat Integration:** Complete  
✅ **Fallback System:** Active  
✅ **Documentation:** Comprehensive  

**Your ORCA platform is READY FOR USE! 🚀🌊**

---

**Next Step:** Start using it! Open http://localhost:3000 and ask ORCA anything about marine conditions!
