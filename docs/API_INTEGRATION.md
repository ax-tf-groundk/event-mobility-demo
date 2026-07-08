# API Integration Notes

## Received API Approvals

The following API approvals have been provided by the project owner. The actual service key must stay outside the public repository.

| No. | API | Env var |
|---:|---|---|
| 1 | 역별승하차인원 | `PUBLIC_DATA_SERVICE_KEY` |
| 2 | 버스도착정보 | `PUBLIC_DATA_SERVICE_KEY` |
| 3 | T1 주차면 현황 정보 | `PUBLIC_DATA_SERVICE_KEY` |
| 4 | 공항철도 운행 정보 | `PUBLIC_DATA_SERVICE_KEY` |
| 5 | 공항 셔틀버스 정보 | `PUBLIC_DATA_SERVICE_KEY` |
| 6 | 공항 버스 정보 | `PUBLIC_DATA_SERVICE_KEY` |
| 7 | 공항 승객예고 출입국장별 | `PUBLIC_DATA_SERVICE_KEY` |
| 8 | 공항 정기운항편조회(관광플랫폼용) | `PUBLIC_DATA_SERVICE_KEY` |
| 9 | 공항 여객기운항상세조회서비스 | `PUBLIC_DATA_SERVICE_KEY` |

## Security Rule

Do not call authenticated public APIs directly from the GitHub Pages frontend. Even public-data service keys should be treated as deploy-time secrets because browser requests expose query parameters and source code.

Use one of these patterns:

1. API proxy server
2. Serverless function
3. Scheduled data collector that stores sanitized JSON snapshots

For the current GitHub Pages demo, the safest next step is a scheduled collector or a lightweight proxy that reads keys from environment variables and returns normalized, key-free JSON to the frontend.

## Required Spec Fields

For each API, collect:

- Documentation URL
- Base URL
- HTTP method
- Auth parameter name
- Required request parameters
- Optional request parameters
- Sample request without the real key
- Sample response
- Rate limits
- Update frequency
- Response format: XML, JSON, or both

## Suggested Normalized Datasets

| Dataset | Purpose |
|---|---|
| `station_ridership` | Estimate venue-area rail demand and historical station load |
| `bus_arrivals` | Estimate local bus access and real-time arrival reliability |
| `airport_parking_t1` | Estimate airport-side parking pressure |
| `airport_rail_runs` | Estimate airport rail capacity and schedule gaps |
| `airport_shuttles` | Estimate terminal-side circulation support |
| `airport_buses` | Estimate airport bus capacity by route |
| `airport_passenger_forecast` | Estimate time-window arrival/departure demand |
| `airport_scheduled_flights` | Forecast event-week flight concentration |
| `airport_flight_operations` | Monitor operational delay and live flight state |

