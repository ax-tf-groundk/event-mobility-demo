# API Integration Notes

## Received API Approvals

The following API approvals and documentation URLs have been provided by the project owner. The actual service key must stay outside the public repository.

| No. | Dataset ID | Source API | Documentation URL | Env var |
|---:|---|---|---|---|
| 1 | `station_ridership` | Seoul Metro station boarding/alighting count | https://www.data.go.kr/data/15143845/openapi.do | `PUBLIC_DATA_SERVICE_KEY` |
| 2 | `bus_arrivals` | Seoul bus arrival information lookup | https://www.data.go.kr/data/15000314/openapi.do | `PUBLIC_DATA_SERVICE_KEY` |
| 3 | `airport_parking_t1` | Incheon Airport T1 parking space status | https://www.data.go.kr/data/15107228/openapi.do | `PUBLIC_DATA_SERVICE_KEY` |
| 4 | `airport_rail_runs` | Incheon Airport airport railroad operation info | https://www.data.go.kr/data/15098226/openapi.do | `PUBLIC_DATA_SERVICE_KEY` |
| 5 | `airport_shuttles` | Incheon Airport shuttle bus info | https://www.data.go.kr/data/15098224/openapi.do | `PUBLIC_DATA_SERVICE_KEY` |
| 6 | `airport_buses` | Incheon Airport bus info | https://www.data.go.kr/data/15095045/openapi.do | `PUBLIC_DATA_SERVICE_KEY` |
| 7 | `airport_passenger_forecast` | Incheon Airport passenger forecast by departure/arrival hall | https://www.data.go.kr/data/15095066/openapi.do | `PUBLIC_DATA_SERVICE_KEY` |
| 8 | `airport_scheduled_flights` | Incheon Airport scheduled passenger flights for tourism platforms | https://www.data.go.kr/data/15143060/openapi.do | `PUBLIC_DATA_SERVICE_KEY` |
| 9 | `airport_flight_operations` | Incheon Airport passenger flight operation detail | https://www.data.go.kr/data/15112968/openapi.do | `PUBLIC_DATA_SERVICE_KEY` |

## Confirmed Metadata

| Dataset ID | Provider | Format | Update cycle | Notes |
|---|---|---|---|---|
| `airport_flight_operations` | Incheon International Airport Corporation | JSON + XML | Real-time | Provides passenger departure/arrival flight operation status from D-3 to D+6. |
| `airport_scheduled_flights` | Incheon International Airport Corporation | JSON + XML | Real-time | Provides seasonal scheduled passenger flight data for travel/tourism platforms. |
| `airport_shuttles` | Incheon International Airport Corporation | JSON + XML | Real-time | Includes shuttle arrival prediction and departure time functions. |
| `station_ridership` | Seoul Metro | JSON + XML | Real-time / daily recent data | Provides station-level boarding and alighting counts; recent one-week window noted on data.go.kr. |

## Security Rule

Do not call authenticated public APIs directly from the GitHub Pages frontend. Even public-data service keys should be treated as deploy-time secrets because browser requests expose query parameters and source code.

Use one of these patterns:

1. API proxy server
2. Serverless function
3. Scheduled data collector that stores sanitized JSON snapshots

For the current GitHub Pages demo, the safest next step is a scheduled collector or a lightweight proxy that reads keys from environment variables and returns normalized, key-free JSON to the frontend.

## Required Spec Fields

For each API, collect:

- Base URL
- Operation path
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

## First Connector Target

Start with `airport_flight_operations`, `airport_passenger_forecast`, and `airport_buses` because they directly support the event-arrival demand model.
