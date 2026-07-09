# Event Mobility Control Demo

Demo URL: https://ax-tf-groundk.github.io/event-mobility-demo/

Static GitHub Pages demo for an airport-to-city event mobility consulting MVP.

## API Handoff

You can share API specifications in the working thread. For API keys, do not commit them to this public repository. Use local `.env` files for development and GitHub Secrets for hosted/API-backed deployments.

Current integration notes: [`docs/API_INTEGRATION.md`](docs/API_INTEGRATION.md)

Copy `.env.example` to `.env` locally and put real keys only in `.env`.

## Public Data Collector

This repo includes a GitHub Actions collector:

- Workflow: `.github/workflows/collect-public-data.yml`
- Script: `scripts/collect-public-data.mjs`
- Output: `public-data/latest.json`

Set the repository secret `PUBLIC_DATA_SERVICE_KEY`, then run **Collect public mobility data** from GitHub Actions. The frontend should read only the generated JSON snapshot, never the API key.

## Decision engine

The demo converts the sanitized API snapshot into explainable decision signals:

- ICN passenger forecast changes the hourly demand curve and peak window.
- Flight delays, airport congestion, and venue-area station pressure increase risk and reserve buses.
- Airport railroad punctuality and airport bus route coverage adjust estimated public-transport absorption.
- Every adjustment is freshness-weighted and accompanied by a confidence score that discounts partial API pages.

The original scenario calculation remains visible as a baseline. The **API 의사결정 영향** panel shows the difference between that baseline and the API-adjusted recommendation.

### Arrival wave forecast

The country-mix inputs are normalized to 100% and mapped to IATA origin airports. Seasonal ICN arrival schedules are filtered by weekday, code-share duplicates are removed, and a 75-minute immigration/baggage lag is applied before producing the expected airport-exit wave. Flight counts are used as weights because the public schedule API does not expose booked passenger counts.

### Event-day forecast

The P50/P90 forecast combines a weekday and monthly baseline proxy with venue travel characteristics, event attendance, VIP demand, current API risk signals, and the selected special factor. It is an explainable scenario forecast, not a trained historical traffic model yet. Accuracy will improve as the collector accumulates historical road-speed, traffic-volume, weather, and event observations.

To set the secret manually:

1. Open `Settings` in the GitHub repository.
2. Go to `Secrets and variables` -> `Actions`.
3. Create a new repository secret named `PUBLIC_DATA_SERVICE_KEY`.
4. Paste the public-data service key.
5. Run `Actions` -> `Collect public mobility data` -> `Run workflow`.

Recommended fields to share for each API:

- Provider and API name
- Documentation URL
- Base URL
- Auth method
- Sample request
- Sample response
- Rate limits
- Issued key name, without exposing the key in committed files

## What this demo shows

- Event condition input
- Mock public API connector layer
- Airport demand and transit capacity simulation
- Shuttle bus requirement estimation
- Consulting-style AI report draft

## Public API connectors to replace mock data

1. Incheon International Airport OpenAPI
   - Passenger flight operation detail
   - Scheduled passenger flight lookup
   - Passenger forecast by arrival/departure
   - Airport bus information
   - Shuttle bus information
   - Airport rail information
   - Parking status
   - Taxi dispatch information
2. ITS National Transport Information Center
   - Traffic speed
   - Incidents
   - CCTV
   - Standard node-link
3. Seoul Open Data Plaza
   - Bus arrivals and stops
   - Subway arrivals
   - Station ridership
   - Public parking
   - Living population and mobility
4. KMA weather API
   - Forecast
   - Weather warnings

## GitHub Pages

This project is static. Push it to a GitHub repository and enable GitHub Pages with GitHub Actions, or use the included workflow.
