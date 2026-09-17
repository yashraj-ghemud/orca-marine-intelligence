@echo off
echo =========================================
echo ORCA Live Mode Test Script
echo =========================================
echo.

echo Testing INCOIS Adapter...
curl -X POST http://localhost:3000/api/adapters/incois -H "Content-Type: application/json" -d "{\"regionId\":\"mumbai\"}"
echo.
echo.

echo Testing Copernicus Adapter...
curl -X POST http://localhost:3000/api/adapters/copernicus -H "Content-Type: application/json" -d "{\"regionId\":\"mumbai\"}"
echo.
echo.

echo Testing Weather Adapter...
curl -X POST http://localhost:3000/api/adapters/weather -H "Content-Type: application/json" -d "{\"regionId\":\"mumbai\"}"
echo.
echo.

echo Testing Risk Engine...
curl -X POST http://localhost:3000/api/engines/risk -H "Content-Type: application/json" -d "{\"regionId\":\"mumbai\",\"sources\":{},\"riskFloor\":\"moderate\"}"
echo.
echo.

echo Testing ORCA Health Endpoint...
curl http://localhost:3000/api/orca
echo.
echo.

echo =========================================
echo All tests complete!
echo If you see JSON responses above, the system is working!
echo =========================================
pause
