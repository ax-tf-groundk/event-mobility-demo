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
  const venue = venueProfiles[value("venue")];
  const policy = policyProfiles[value("policy")];
  const attendees = Math.max(100, numberValue("attendees"));
  const vip = Math.max(0, numberValue("vip"));
  const foreignRatio = numberValue("foreignRatio") / 100;
  const airportRatio = numberValue("airportRatio") / 100;

  const airportDemand = Math.round(attendees * airportRatio);
  const foreignAirportDemand = Math.round(airportDemand * foreignRatio);
  const publicCapacity = Math.round(
    airportDemand * venue.publicAbsorption * policy.publicBias * (foreignRatio > 0.4 ? 0.92 : 1)
  );
  const baseShuttleDemand = Math.max(0, airportDemand - publicCapacity);
  const shuttleDemand = Math.round(baseShuttleDemand * policy.shuttleBias + vip * 1.15);
  const serviceSeatsPerBus = 45 * 0.88;
  const tripFactor = venue.roadMinutes > 80 ? 1.15 : venue.roadMinutes < 60 ? 0.82 : 1;
  const busCount = Math.ceil((shuttleDemand / serviceSeatsPerBus) * tripFactor * 1.15);
  const riskScore = Math.min(
    96,
    Math.round(34 + foreignRatio * 28 + airportRatio * 20 + vip / 12 + (venue.roadMinutes - 55) * 0.25)
  );
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
    publicCapacity,
    shuttleDemand,
    busCount,
    riskScore,
    hubCount,
  };
}

function renderBars(model) {
  const maxDemand = Math.max(...demandShape.map(([, ratio]) => model.airportDemand * ratio));
  const bars = demandShape
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
  const items = [
    ["공항 직행", `${model.venue.hubs[0]} 중심으로 ${model.busCount}대 규모 셔틀 슬롯을 배정합니다.`],
    ["권역 환승", `${model.venue.hubs.join(", ")} 거점에 집결 안내와 순환 셔틀을 배치합니다.`],
    ["VIP 동선", `VIP ${formatter.format(model.vip)}명은 일반 참가자 승하차장과 분리해 예비차를 상시 대기시킵니다.`],
    ["리스크 대응", `도로 돌발, 항공 지연, 우천 발생 시 예비차 15%와 안내 인력 증원을 적용합니다.`],
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
  const snapshotNote = publicDataSnapshot
    ? `<p>최근 공공 API 스냅샷은 <strong>${new Date(publicDataSnapshot.generatedAt).toLocaleString("ko-KR")}</strong>에 생성됐습니다. 현재 수집 결과는 분석 보조 신호로 사용하며, 키는 브라우저에 노출되지 않습니다.</p>`
    : `<p>현재 화면은 데모 계산값을 사용합니다. GitHub Actions 수집기가 실행되면 공공 API 스냅샷을 읽어 보조 지표로 반영합니다.</p>`;

  document.getElementById("report").innerHTML = `
    <p><strong>${model.eventName}</strong>은 ${model.venue.label} 접근 행사로, 전체 참가자 ${formatter.format(
      model.attendees
    )}명 중 약 ${formatter.format(model.airportDemand)}명이 인천공항을 이용하는 시나리오입니다.</p>
    <p>외국인 비율 ${foreignPercent}%, 공항 이용 비율 ${airportPercent}% 조건에서는 공항철도와 공항버스만으로 약 ${formatter.format(
      model.publicCapacity
    )}명 수준을 흡수할 수 있으며, 약 ${formatter.format(publicGap)}명은 별도 수송 대책이 필요합니다.</p>
    <p>권장안은 ${model.venue.hubs.join(", ")}를 기준으로 공항 직행 셔틀과 시내 순환 셔틀을 분리하는 방식입니다. 현재 조건에서는 ${formatter.format(
      model.busCount
    )}대 규모의 셔틀 운영안이 필요하며, 리스크 수준은 ${riskLabel} 편입니다.</p>
    ${snapshotNote}
  `;
}

function renderSnapshotStatus() {
  const status = document.getElementById("snapshotStatus");
  const summary = document.getElementById("collectorSummary");

  if (!status || !summary) return;

  if (!publicDataSnapshot) {
    status.innerHTML = `<i class="warn"></i> Snapshot pending`;
    summary.textContent = "GitHub Actions 수집기를 실행하면 최신 공공 API 스냅샷이 표시됩니다.";
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
  summary.textContent = `최근 수집: ${new Date(publicDataSnapshot.generatedAt).toLocaleString(
    "ko-KR"
  )} / 성공 ${ok}, 건너뜀 ${skipped}, 실패 ${failed}`;
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
  setText("airportDemand", formatter.format(model.airportDemand));
  setText("publicCapacity", formatter.format(model.publicCapacity));
  setText("shuttleDemand", formatter.format(model.shuttleDemand));
  setText("peakWindow", model.venue.peak);
  setText("riskScore", model.riskScore);
  setText("busCount", formatter.format(model.busCount));
  setText("hubCount", model.hubCount);

  setText("peakCopy", `${model.venue.label} 접근과 공항 입국 처리 시간이 겹치는 구간`);
  setText("riskCopy", model.riskScore >= 75 ? "항공 집중, 환승 복잡도, VIP 분리 필요도 높음" : "대중교통 보완 시 안정 운영 가능");
  setText("busCopy", "45인승, 탑승률 88%, 예비차 15% 기준");
  setText("hubCopy", `${model.venue.hubs.join(", ")} 권역 운영`);

  renderBars(model);
  renderPlan(model);
  renderReport(model);
}

document.getElementById("analyzeBtn").addEventListener("click", render);
document.querySelectorAll("input, select").forEach((el) => el.addEventListener("input", render));

render();
loadPublicDataSnapshot();
