@echo off
echo ===============================================
echo ORCA FREE PUBLIC APIs TEST
echo Testing LIVE data from Open-Meteo and NOAA
echo ===============================================
echo.

echo [1/4] Testing Open-Meteo Marine API (Wave Data)...
echo.
curl "https://marine-api.open-meteo.com/v1/marine?latitude=18.92&longitude=72.82&current=wave_height,wave_period,ocean_current_velocity&timezone=Asia/Kolkata"
echo.
echo.

echo [2/4] Testing Open-Meteo Weather API...
echo.
curl "https://api.open-meteo.com/v1/forecast?latitude=18.92&longitude=72.82&current=temperature_2m,wind_speed_10m&timezone=Asia/Kolkata"
echo.
echo.

echo [3/4] Testing ORCA INCOIS Adapter (Uses FREE APIs)...
echo.
curl -X POST http://localhost:3000/api/adapters/incois -H "Content-Type: application/json" -d "{\"regionId\":\"mumbai\"}"
echo.
echo.

echo [4/4] Testing ORCA Weather Adapter (Uses FREE APIs)...
echo.
curl -X POST http://localhost:3000/api/adapters/weather -H "Content-Type: application/json" -d "{\"regionId\":\"mumbai\"}"
echo.
echo.

echo ===============================================
echo Tests Complete!
echo.
echo If you see JSON responses with wave heights,
echo temperatures, and wind speeds - IT'S WORKING!
echo.
echo No API keys needed - All data is FREE! 🎉
echo ===============================================
pause
