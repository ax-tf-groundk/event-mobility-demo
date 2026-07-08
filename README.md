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
