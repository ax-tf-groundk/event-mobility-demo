const venueProfiles = {
  coex: {
    label: "COEX",
    publicAbsorption: 0.57,
    roadMinutes: 78,
    peak: "17:00-20:00",
    hubs: ["강남 호텔권", "명동 호텔권", "여의도 호텔권"],
  },
  ddp: {
    label: "DDP",
    publicAbsorption: 0.62,
    roadMinutes: 86,
    peak: "16:00-19:00",
    hubs: ["동대문 권역", "명동 호텔권", "강남 호텔권"],
  },
  kintex: {
    label: "KINTEX",
    publicAbsorption: 0.48,
    roadMinutes: 72,
    peak: "15:00-19:00",
    hubs: ["일산 권역", "김포공항 권역", "서울역 권역"],
  },
  bexco: {
    label: "BEXCO",
    publicAbsorption: 0.42,
    roadMinutes: 52,
    peak: "14:00-18:00",
    hubs: ["김해공항", "해운대 숙박권", "부산역"],
  },
};

const policyProfiles = {
  balanced: { label: "균형 운영", shuttleBias: 1, publicBias: 1, vipBias: 1 },
  shuttle: { label: "셔틀 보강", shuttleBias: 1.15, publicBias: 0.92, vipBias: 1 },
  public: { label: "대중교통 우선", shuttleBias: 0.82, publicBias: 1.08, vipBias: 1 },
  vip: { label: "VIP 분리 우선", shuttleBias: 1.08, publicBias: 0.95, vipBias: 1.25 },
};

const demandShape = [
  ["09:00", 0.08],
  ["11:00", 0.11],
  ["13:00", 0.13],
  ["15:00", 0.17],
  ["17:00", 0.23],
  ["19:00", 0.18],
  ["21:00", 0.1],
];

const formatter = new Intl.NumberFormat("ko-KR");
let publicDataSnapshot = null;

const datasetLabels = {
  station_ridership: "서울교통공사 역별승하차",
  bus_arrivals: "서울 버스도착",
  airport_parking_t1: "인천공항 T1 주차면",
  airport_rail_runs: "인천공항 공항철도",
  airport_shuttles: "인천공항 셔틀버스",
  airport_buses: "인천공항 버스",
  airport_passenger_forecast: "인천공항 승객예고",
  airport_scheduled_flights: "인천공항 정기운항",
  airport_flight_operations: "인천공항 운항현황",
};

const sampleFieldPriority = [
  "pasngDe",
  "pasngHr",
  "lineNm",
  "stnNm",
  "rideNope",
  "gffNope",
  "parklotno",
  "parkzoneno",
  "parklanecode",
  "carstatus",
  "carindate",
  "terno",
  "drvDt",
  "trnNo",
  "stnCd",
  "planArrvDttm",
  "planDptrDttm",
  "trnClsfNm",
  "flightId",
  "airline",
  "airport",
  "airportCode",
  "estimatedDateTime",
  "scheduleDateTime",
  "terminalid",
  "remark",
  "routeId",
  "stopId",
  "predTimes",
  "busnumber",
  "area",
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function payloadItems(result) {
  const data = result.payload?.data;
  const body = data?.response?.body || data?.body || {};
  const items = body.items?.item || body.items || [];
  if (Array.isArray(items)) return items;
  return items ? [items] : [];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCompactDateTime(value) {
  const text = String(value || "");
  if (!/^\d{12,14}$/.test(text)) return null;
  return new Date(
    Number(text.slice(0, 4)),
    Number(text.slice(4, 6)) - 1,
    Number(text.slice(6, 8)),
    Number(text.slice(8, 10)),
    Number(text.slice(10, 12)),
    Number(text.slice(12, 14) || 0)
  );
}

function findResult(datasetId, operationId) {
  return publicDataSnapshot?.results?.find(
    (entry) => entry.datasetId === datasetId && (!operationId || entry.operationId === operationId)
  );
}

function resultItems(datasetId, operationId) {
  const result = findResult(datasetId, operationId);
  return result?.status === "ok" ? payloadItems(result) : [];
}

function resultTotal(datasetId, operationId) {
  return numeric(findResult(datasetId, operationId)?.summary?.totalCount);
}

function resultSampleRatio(datasetId, operationId) {
  const result = findResult(datasetId, operationId);
  const total = numeric(result?.summary?.totalCount);
  const items = numeric(result?.summary?.itemCount) || payloadItems(result || {}).length;
  return total > 0 ? clamp(items / total, 0, 1) : items > 0 ? 1 : 0;
}

function buildPublicDataSignals(venueKey) {
  if (!publicDataSnapshot) {
    return {
      active: false,
      confidence: 0,
      supplyModifier: 1,
      riskDelta: 0,
      reserveRatio: 0.15,
      peakWindow: null,
      demandShape,
      signals: [],
    };
  }

  const generatedAt = new Date(publicDataSnapshot.generatedAt);
  const ageHours = Math.max(0, (Date.now() - generatedAt.getTime()) / 36e5);
  const freshness = clamp(Math.round(100 - Math.max(0, ageHours - 2) * 1.5), 25, 100);
  const freshnessWeight = freshness / 100;

  const forecast = resultItems("airport_passenger_forecast", "get_passenger_announcement");
  const forecastDate = forecast[0]?.adate;
  const forecastDay = forecast.filter((item) => !forecastDate || item.adate === forecastDate);
  const hourlyArrivals = forecastDay.map((item) => ({
    label: String(item.atime || "").replace("_", ":"),
    value: numeric(item.t1egsum1) + numeric(item.t2egsum1),
  }));
  const totalForecastArrivals = hourlyArrivals.reduce((sum, item) => sum + item.value, 0);
  const peakArrival = hourlyArrivals.reduce(
    (peak, item) => (item.value > peak.value ? item : peak),
    { label: "", value: 0 }
  );
  const hourlyAverage = totalForecastArrivals / Math.max(1, hourlyArrivals.length);
  const arrivalPressure = clamp((peakArrival.value / Math.max(1, hourlyAverage) - 1) / 2.2, 0, 1);

  const forecastGroups = [];
  for (let index = 0; index < hourlyArrivals.length; index += 3) {
    const group = hourlyArrivals.slice(index, index + 3);
    const start = String(index).padStart(2, "0");
    const end = String(Math.min(index + 3, 24)).padStart(2, "0");
    forecastGroups.push([`${start}-${end}`, group.reduce((sum, item) => sum + item.value, 0)]);
  }
  const groupedTotal = forecastGroups.reduce((sum, [, count]) => sum + count, 0);
  const apiDemandShape =
    groupedTotal > 0 ? forecastGroups.map(([label, count]) => [label, count / groupedTotal]) : demandShape;

  const flights = resultItems("airport_flight_operations", "get_passenger_arrivals").filter(
    (item) => String(item.codeshare || "").toLowerCase() !== "slave"
  );
  const flightDelays = flights
    .map((item) => {
      const scheduled = parseCompactDateTime(item.scheduleDateTime);
      const estimated = parseCompactDateTime(item.estimatedDateTime);
      return scheduled && estimated ? Math.max(0, (estimated - scheduled) / 60000) : null;
    })
    .filter((delay) => delay !== null);
  const delayRatio = flightDelays.filter((delay) => delay >= 15).length / Math.max(1, flightDelays.length);
  const averageDelay = flightDelays.reduce((sum, delay) => sum + delay, 0) / Math.max(1, flightDelays.length);

  const railRuns = resultItems("airport_rail_runs", "get_airport_railroad");
  const railDelays = railRuns
    .map((item) => {
      const planned = parseCompactDateTime(item.planArrvDttm);
      const actual = parseCompactDateTime(item.accomArrvDttm);
      return planned && actual ? Math.max(0, (actual - planned) / 60000) : null;
    })
    .filter((delay) => delay !== null);
  const railOnTimeRatio =
    railDelays.length > 0
      ? railDelays.filter((delay) => delay <= 3).length / railDelays.length
      : 0.85;

  const airportBusRoutes =
    resultTotal("airport_buses", "get_airport_bus_info") ||
    resultItems("airport_buses", "get_airport_bus_info").length;

  const parking = resultItems("airport_parking_t1", "get_park_location_data");
  const parkingActiveRatio =
    parking.length > 0
      ? parking.filter((item) => String(item.carstatus || "").toUpperCase() === "Y").length / parking.length
      : 0;

  const stationRows = venueKey === "coex" ? resultItems("station_ridership", "get_station_passenger_counts") : [];
  const stationByHour = stationRows.reduce((hours, item) => {
    const hour = String(item.pasngHr || "");
    hours[hour] = (hours[hour] || 0) + numeric(item.rideNope) + numeric(item.gffNope);
    return hours;
  }, {});
  const stationVolumes = Object.values(stationByHour);
  const stationAverage =
    stationVolumes.reduce((sum, count) => sum + count, 0) / Math.max(1, stationVolumes.length);
  const stationPeak = stationVolumes.length ? Math.max(...stationVolumes) : 0;
  const stationPressure = stationVolumes.length
    ? clamp((stationPeak / Math.max(1, stationAverage) - 1) / 1.5, 0, 1)
    : 0;

  const successfulInputs = [
    forecastDay.length > 0,
    flightDelays.length > 0,
    railDelays.length > 0,
    airportBusRoutes > 0,
    parking.length > 0,
    venueKey !== "coex" || stationRows.length > 0,
  ].filter(Boolean).length;
  const coverage = successfulInputs / 6;
  const relevantSampleRatios = [
    resultSampleRatio("airport_passenger_forecast", "get_passenger_announcement"),
    resultSampleRatio("airport_flight_operations", "get_passenger_arrivals"),
    resultSampleRatio("airport_rail_runs", "get_airport_railroad"),
    resultSampleRatio("airport_buses", "get_airport_bus_info"),
    resultSampleRatio("airport_parking_t1", "get_park_location_data"),
  ];
  if (venueKey === "coex") {
    relevantSampleRatios.push(resultSampleRatio("station_ridership", "get_station_passenger_counts"));
  }
  const sampleCoverage =
    relevantSampleRatios.reduce((sum, ratio) => sum + ratio, 0) / Math.max(1, relevantSampleRatios.length);
  const confidence = Math.round(
    (coverage * 0.45 + freshnessWeight * 0.25 + sampleCoverage * 0.3) * 100
  );

  const rawSupplyModifier =
    1 +
    clamp((airportBusRoutes - 25) / 400, -0.03, 0.045) +
    clamp((railOnTimeRatio - 0.85) * 0.18, -0.055, 0.027) -
    arrivalPressure * 0.045 -
    delayRatio * 0.035 -
    stationPressure * 0.035;
  const supplyModifier = 1 + (clamp(rawSupplyModifier, 0.86, 1.08) - 1) * freshnessWeight;
  const riskDelta = Math.round(
    (arrivalPressure * 7 +
      delayRatio * 8 +
      parkingActiveRatio * 2 +
      stationPressure * 5 +
      Math.max(0, 0.85 - railOnTimeRatio) * 16) *
      freshnessWeight
  );
  const reserveRatio = clamp(0.15 + (delayRatio * 0.06 + arrivalPressure * 0.04) * freshnessWeight, 0.15, 0.25);

  const signals = [
    {
      label: "입국 수요 집중",
      value: `${formatter.format(Math.round(peakArrival.value))}명 / ${peakArrival.label || "-"}`,
      note: `승객예고 ${hourlyArrivals.length}개 시간대, 일 합계 ${formatter.format(Math.round(totalForecastArrivals))}명`,
      impact: `위험도 +${Math.round(arrivalPressure * 7 * freshnessWeight)}`,
      tone: arrivalPressure > 0.45 ? "negative" : "neutral",
      strength: Math.round(arrivalPressure * 100),
      category: "DEMAND PRESSURE",
    },
    {
      label: "항공 도착 지연",
      value: `${Math.round(delayRatio * 100)}% 지연`,
      note: `마스터편 표본 ${flightDelays.length}편, 평균 ${averageDelay.toFixed(1)}분`,
      impact: `위험도 +${Math.round(delayRatio * 8 * freshnessWeight)}`,
      tone: delayRatio > 0.25 ? "negative" : "neutral",
      strength: Math.round(clamp(delayRatio / 0.5, 0, 1) * 100),
      category: "FLIGHT RELIABILITY",
    },
    {
      label: "공항철도 정시성",
      value: `${Math.round(railOnTimeRatio * 100)}%`,
      note: `도착실적이 있는 운행 표본 ${railDelays.length}건`,
      impact: railOnTimeRatio >= 0.85 ? "수용력 상향" : "수용력 하향",
      tone: railOnTimeRatio >= 0.85 ? "positive" : "negative",
      strength: Math.round(railOnTimeRatio * 100),
      category: "RAIL SUPPLY",
    },
    {
      label: "공항버스 공급망",
      value: `${formatter.format(airportBusRoutes)}개 노선`,
      note: "공개 API의 전체 노선 수 기준",
      impact: airportBusRoutes >= 25 ? "수용력 상향" : "수용력 하향",
      tone: airportBusRoutes >= 25 ? "positive" : "negative",
      strength: Math.round(clamp(airportBusRoutes / 50, 0, 1) * 100),
      category: "BUS COVERAGE",
    },
    {
      label: "T1 주차면 상태",
      value: `Y ${Math.round(parkingActiveRatio * 100)}%`,
      note: `주차면 표본 ${parking.length}건의 상태 코드 비율`,
      impact: `위험도 +${Math.round(parkingActiveRatio * 2 * freshnessWeight)}`,
      tone: parkingActiveRatio > 0.8 ? "negative" : "neutral",
      strength: Math.round(parkingActiveRatio * 100),
      category: "CURBSIDE PRESSURE",
    },
  ];

  if (venueKey === "coex" && stationRows.length > 0) {
    signals.push({
      label: "행사장 인근 혼잡",
      value: `피크 ${formatter.format(Math.round(stationPeak))}명`,
      note: `삼성역 수집 표본 ${stationRows.length}건의 시간대 상대 혼잡`,
      impact: `위험도 +${Math.round(stationPressure * 5 * freshnessWeight)}`,
      tone: stationPressure > 0.4 ? "negative" : "neutral",
      strength: Math.round(stationPressure * 100),
      category: "VENUE CONGESTION",
    });
  }

  return {
    active: true,
    confidence,
    freshness,
    ageHours,
    sampleCoverage,
    supplyModifier,
    riskDelta,
    reserveRatio,
    peakWindow: peakArrival.label || null,
    demandShape: apiDemandShape,
    signals,
  };
}

function sampleEntries(item) {
  if (!item) return [];
  const priorityEntries = sampleFieldPriority
    .filter((key) => item[key] !== undefined && item[key] !== null && item[key] !== "")
    .map((key) => [key, item[key]]);
  const fallbackEntries = Object.entries(item).filter(
    ([key, value]) => !sampleFieldPriority.includes(key) && value !== undefined && value !== null && value !== ""
  );
  return [...priorityEntries, ...fallbackEntries].slice(0, 6);
}

function value(id) {
  return document.getElementById(id).value;
}

function numberValue(id) {
  return Number(value(id));
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function calculate() {
  const eventName = value("eventName").trim() || "Untitled Event";
  const venueKey = value("venue");
  const venue = venueProfiles[venueKey];
  const policy = policyProfiles[value("policy")];
  const attendees = Math.max(100, numberValue("attendees"));
  const vip = Math.max(0, numberValue("vip"));
  const foreignRatio = numberValue("foreignRatio") / 100;
  const airportRatio = numberValue("airportRatio") / 100;

  const airportDemand = Math.round(attendees * airportRatio);
  const foreignAirportDemand = Math.round(airportDemand * foreignRatio);
  const baselinePublicCapacity = Math.round(
    airportDemand * venue.publicAbsorption * policy.publicBias * (foreignRatio > 0.4 ? 0.92 : 1)
  );
  const apiSignals = buildPublicDataSignals(venueKey);
  const publicCapacity = Math.min(
    airportDemand,
    Math.round(baselinePublicCapacity * apiSignals.supplyModifier)
  );
  const baseShuttleDemand = Math.max(0, airportDemand - publicCapacity);
  const shuttleDemand = Math.round(baseShuttleDemand * policy.shuttleBias + vip * 1.15);
  const serviceSeatsPerBus = 45 * 0.88;
  const tripFactor = venue.roadMinutes > 80 ? 1.15 : venue.roadMinutes < 60 ? 0.82 : 1;
  const baselineShuttleDemand = Math.round(
    Math.max(0, airportDemand - baselinePublicCapacity) * policy.shuttleBias + vip * 1.15
  );
  const baselineBusCount = Math.ceil((baselineShuttleDemand / serviceSeatsPerBus) * tripFactor * 1.15);
  const busCount = Math.ceil(
    (shuttleDemand / serviceSeatsPerBus) * tripFactor * (1 + apiSignals.reserveRatio)
  );
  const baselineRiskScore = Math.min(
    96,
    Math.round(34 + foreignRatio * 28 + airportRatio * 20 + vip / 12 + (venue.roadMinutes - 55) * 0.25)
  );
  const riskScore = Math.min(99, baselineRiskScore + apiSignals.riskDelta);
  const hubCount = venue.hubs.length;

  return {
    eventName,
    venue,
    policy,
    attendees,
    vip,
    foreignRatio,
    airportRatio,
    airportDemand,
    foreignAirportDemand,
    baselinePublicCapacity,
    publicCapacity,
    shuttleDemand,
    baselineBusCount,
    busCount,
    baselineRiskScore,
    riskScore,
    hubCount,
    apiSignals,
  };
}

function renderBars(model) {
  const shape = model.apiSignals.demandShape;
  const maxDemand = Math.max(...shape.map(([, ratio]) => model.airportDemand * ratio));
  const bars = shape
    .map(([time, ratio]) => {
      const demand = Math.round(model.airportDemand * ratio);
      const width = Math.max(7, Math.round((demand / maxDemand) * 100));
      const color = demand > maxDemand * 0.8 ? "var(--red)" : demand > maxDemand * 0.6 ? "var(--amber)" : "var(--blue)";
      return `
        <div class="bar-row">
          <strong>${time}</strong>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%; background:${color}"></div></div>
          <span>${formatter.format(demand)}</span>
        </div>
      `;
    })
    .join("");

  document.getElementById("demandBars").innerHTML = bars;
}

function renderPlan(model) {
  const reservePercent = Math.round(model.apiSignals.reserveRatio * 100);
  const items = [
    ["공항 직행", `${model.venue.hubs[0]} 중심으로 ${model.busCount}대 규모 셔틀 슬롯을 배정합니다.`],
    ["권역 환승", `${model.venue.hubs.join(", ")} 거점에 집결 안내와 순환 셔틀을 배치합니다.`],
    ["VIP 동선", `VIP ${formatter.format(model.vip)}명은 일반 참가자 승하차장과 분리해 예비차를 상시 대기시킵니다.`],
    ["리스크 대응", `입국 집중도와 항공 지연 신호를 반영해 예비차 ${reservePercent}%와 안내 인력 증원을 적용합니다.`],
  ];

  document.getElementById("planList").innerHTML = items
    .map(([title, body]) => `<div class="plan-item"><strong>${title}</strong><span>${body}</span></div>`)
    .join("");
}

function renderReport(model) {
  const publicGap = Math.max(0, model.airportDemand - model.publicCapacity);
  const foreignPercent = Math.round(model.foreignRatio * 100);
  const airportPercent = Math.round(model.airportRatio * 100);
  const riskLabel = model.riskScore >= 75 ? "높은" : model.riskScore >= 58 ? "중간 이상의" : "관리 가능한";
  const capacityChange = model.publicCapacity - model.baselinePublicCapacity;
  const snapshotNote = model.apiSignals.active
    ? `<p>공공 API 신뢰도는 <strong>${model.apiSignals.confidence}%</strong>입니다. API 신호로 대중교통 수용 추정치를 기준값 대비 <strong>${capacityChange >= 0 ? "+" : ""}${formatter.format(
        capacityChange
      )}명</strong>, 위험도를 <strong>+${model.apiSignals.riskDelta}점</strong> 조정했습니다. 스냅샷은 ${new Date(
        publicDataSnapshot.generatedAt
      ).toLocaleString("ko-KR")}에 생성됐습니다.</p>`
    : `<p>현재 화면은 데모 계산값을 사용합니다. GitHub Actions 수집기가 실행되면 공공 API 스냅샷을 읽어 보조 지표로 반영합니다.</p>`;

  document.getElementById("report").innerHTML = `
    <p><strong>${model.eventName}</strong>은 ${model.venue.label} 접근 행사로, 전체 참가자 ${formatter.format(
      model.attendees
    )}명 중 약 ${formatter.format(model.airportDemand)}명이 인천공항을 이용하는 시나리오입니다.</p>
    <p>외국인 비율 ${foreignPercent}%, 공항 이용 비율 ${airportPercent}% 조건에서는 현재 공공교통망으로 약 ${formatter.format(
      model.publicCapacity
    )}명 수준을 흡수할 수 있으며, 약 ${formatter.format(publicGap)}명은 별도 수송 대책이 필요합니다.</p>
    <p>권장안은 ${model.venue.hubs.join(", ")}를 환승 거점으로 삼아 공항 직행 셔틀과 시내 순환 셔틀을 분리하는 방식입니다. 현재 조건에서는 ${formatter.format(
      model.busCount
    )}대 규모의 셔틀 운영안이 필요하며, 리스크 수준은 ${riskLabel} 편입니다.</p>
    ${snapshotNote}
  `;
}

function renderDecisionSignals(model) {
  const container = document.getElementById("decisionSignals");
  const confidence = document.getElementById("decisionConfidence");
  const demandSource = document.getElementById("demandSource");
  if (!container || !confidence || !demandSource) return;

  if (!model.apiSignals.active) {
    confidence.textContent = "baseline only";
    demandSource.textContent = "scenario baseline";
    container.innerHTML = `<div class="empty-state">스냅샷이 없어 행사 입력값과 고정 기준만 사용합니다.</div>`;
    return;
  }

  confidence.textContent = `confidence ${model.apiSignals.confidence}%`;
  demandSource.textContent = "ICN passenger forecast";
  const capacityDelta = model.publicCapacity - model.baselinePublicCapacity;
  const busDelta = model.busCount - model.baselineBusCount;
  const capacityWidth = clamp(
    Math.round((Math.abs(capacityDelta) / Math.max(1, model.baselinePublicCapacity)) * 1000),
    6,
    100
  );
  const riskWidth = clamp(Math.round((model.apiSignals.riskDelta / 15) * 100), 6, 100);
  const busWidth = clamp(Math.round((Math.abs(busDelta) / 8) * 100), 6, 100);
  const samplePercent = Math.round(model.apiSignals.sampleCoverage * 100);
  const signalRows = model.apiSignals.signals
    .map((signal) => {
      const signalColor =
        signal.tone === "negative" ? "var(--coral)" : signal.tone === "neutral" ? "var(--amber)" : "var(--green)";
      return `
        <div class="signal-row">
          <div class="signal-copy">
            <span>${escapeHtml(signal.category || "PUBLIC DATA SIGNAL")}</span>
            <strong>${escapeHtml(signal.label)} · ${escapeHtml(signal.value)}</strong>
            <small>${escapeHtml(signal.note)}</small>
          </div>
          <div class="signal-viz" style="--signal-color:${signalColor}">
            <div><span>SIGNAL</span><strong>${escapeHtml(signal.impact)}</strong></div>
            <div class="signal-track"><i style="width:${clamp(signal.strength || 0, 4, 100)}%"></i></div>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="decision-overview">
      <div class="confidence-module">
        <div class="radial-gauge" style="--value:${model.apiSignals.confidence}">
          <div><strong>${model.apiSignals.confidence}</strong><span>MODEL CONFIDENCE</span></div>
        </div>
        <p class="confidence-note">표본 커버리지 ${samplePercent}% · 최신성 ${model.apiSignals.freshness}%</p>
      </div>
      <div class="impact-metrics">
        <div class="impact-metric" style="--signal-color:var(--green)">
          <span>대중교통 수용 변화</span>
          <strong>${capacityDelta >= 0 ? "+" : ""}${formatter.format(capacityDelta)}명</strong>
          <div class="impact-track"><i style="width:${capacityWidth}%"></i></div>
          <small>SCENARIO BASELINE 대비</small>
        </div>
        <div class="impact-metric" style="--signal-color:var(--coral)">
          <span>운영 위험도 변화</span>
          <strong>+${model.apiSignals.riskDelta}점</strong>
          <div class="impact-track"><i style="width:${riskWidth}%"></i></div>
          <small>DEMAND + DISRUPTION 신호</small>
        </div>
        <div class="impact-metric" style="--signal-color:var(--amber)">
          <span>필요 차량 변화</span>
          <strong>${busDelta >= 0 ? "+" : ""}${formatter.format(busDelta)}대</strong>
          <div class="impact-track"><i style="width:${busWidth}%"></i></div>
          <small>예비차 포함 권고안</small>
        </div>
      </div>
    </div>
    <div class="signal-matrix">${signalRows}</div>
  `;
}

function renderSnapshotStatus() {
  const status = document.getElementById("snapshotStatus");
  const summary = document.getElementById("collectorSummary");

  if (!status) return;

  if (!publicDataSnapshot) {
    status.innerHTML = `<i class="warn"></i> Snapshot pending`;
    if (summary) {
      summary.textContent = "GitHub Actions 수집기를 실행하면 최신 공공 API 스냅샷이 표시됩니다.";
    }
    renderPublicDataDetails();
    return;
  }

  const counts = publicDataSnapshot.results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});
  const ok = counts.ok || 0;
  const skipped = counts.skipped || 0;
  const failed = (counts.http_error || 0) + (counts.fetch_error || 0);

  status.innerHTML = `<i class="${failed > 0 ? "warn" : "ok"}"></i> Snapshot ${ok} ok`;
  if (summary) {
    summary.textContent = `최근 수집: ${new Date(publicDataSnapshot.generatedAt).toLocaleString(
      "ko-KR"
    )} / 성공 ${ok}, 건너뜀 ${skipped}, 실패 ${failed}`;
  }
  renderPublicDataDetails();
}

function renderPublicDataDetails() {
  const container = document.getElementById("publicDataDetails");
  if (!container) return;

  if (!publicDataSnapshot?.results?.length) {
    container.innerHTML = `<div class="empty-state">아직 수집된 API 스냅샷이 없습니다.</div>`;
    return;
  }

  const cards = publicDataSnapshot.results
    .map((result) => {
      const items = payloadItems(result);
      const sample = sampleEntries(items[0]);
      const statusClass = result.status === "ok" ? "ok" : result.status === "skipped" ? "skipped" : "failed";
      const totalCount = result.summary?.totalCount ?? "-";
      const itemCount = result.summary?.itemCount ?? items.length ?? "-";
      const reason = result.reason || result.error || result.summary?.resultMsg || "";
      const sampleHtml =
        sample.length > 0
          ? `<dl class="sample-grid">${sample
              .map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`)
              .join("")}</dl>`
          : `<div class="empty-state">${escapeHtml(reason || "샘플 item이 없습니다.")}</div>`;

      return `
        <div class="snapshot-card">
          <div class="snapshot-card-header">
            <div class="snapshot-title">
              <strong>${escapeHtml(datasetLabels[result.datasetId] || result.datasetId)}</strong>
              <span>${escapeHtml(result.operationId)}</span>
            </div>
            <span class="snapshot-badge ${statusClass}">${escapeHtml(result.status)}</span>
          </div>
          <div class="snapshot-meta">
            <span>items ${escapeHtml(itemCount)}</span>
            <span>total ${escapeHtml(totalCount)}</span>
            <span>code ${escapeHtml(result.summary?.resultCode ?? "-")}</span>
          </div>
          ${sampleHtml}
        </div>
      `;
    })
    .join("");

  container.innerHTML = cards;
}

async function loadPublicDataSnapshot() {
  try {
    const response = await fetch("public-data/latest.json", { cache: "no-store" });
    if (!response.ok) return;
    publicDataSnapshot = await response.json();
    renderSnapshotStatus();
    render();
  } catch {
    renderSnapshotStatus();
  }
}

function render() {
  setText("foreignRatioValue", value("foreignRatio"));
  setText("airportRatioValue", value("airportRatio"));

  const model = calculate();

  setText("title", model.eventName);
  setText("mapVenue", model.venue.label);
  setText("airportDemand", formatter.format(model.airportDemand));
  setText("publicCapacity", formatter.format(model.publicCapacity));
  setText("shuttleDemand", formatter.format(model.shuttleDemand));
  setText("peakWindow", model.apiSignals.peakWindow || model.venue.peak);
  setText("riskScore", model.riskScore);
  setText("busCount", formatter.format(model.busCount));
  setText("hubCount", model.hubCount);

  setText(
    "peakCopy",
    model.apiSignals.active
      ? "인천공항 승객예고에서 가장 입국 수요가 집중된 시간대"
      : `${model.venue.label} 접근과 공항 입국 처리 시간이 겹치는 구간`
  );
  setText("riskCopy", model.riskScore >= 75 ? "항공 집중, 환승 복잡도, VIP 분리 필요도 높음" : "대중교통 보완 시 안정 운영 가능");
  setText(
    "busCopy",
    `45인승, 탑승률 88%, 예비차 ${Math.round(model.apiSignals.reserveRatio * 100)}% 기준`
  );
  setText("hubCopy", `${model.venue.hubs.join(", ")} 권역 운영`);

  renderBars(model);
  renderDecisionSignals(model);
  renderPlan(model);
  renderReport(model);
}

document.getElementById("analyzeBtn").addEventListener("click", render);
document.querySelectorAll("input, select").forEach((el) => el.addEventListener("input", render));

render();
loadPublicDataSnapshot();
