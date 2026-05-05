const SECTIONS = [
  {
    id: 'highway', name: '일반 고속도로', icon: '🛣️',
    speedLimit: 100, thermal: '5대/km', piezo: '없음', hasPiezo: false,
    risks: ['기상 조건에 따른 속도 조절', '광역 감시 구간'],
    law: '도로교통법 제17조'
  },
  {
    id: 'tunnel', name: '터널 진출입', icon: '🚇',
    speedLimit: 100, thermal: '2대/개소', piezo: '2개소', hasPiezo: true,
    risks: ['시야·조도 급변', '횡풍 발생'],
    law: '도로교통법 제17조, 제48조'
  },
  {
    id: 'curve', name: '급커브 구간', icon: '↩️',
    speedLimit: 50, thermal: '3대/개소', piezo: '1개소', hasPiezo: true,
    risks: ['원심력 이탈 위험', '곡률별 속도 제한'],
    law: '도로 구조 규칙 제19조'
  },
  {
    id: 'bridge', name: '교량·고가도로', icon: '🌉',
    speedLimit: 100, thermal: '3대/개소', piezo: '2개소', hasPiezo: true,
    risks: ['블랙아이스 생성', '측풍 이탈 위험'],
    law: '도로교통법 시행규칙 제19조 2항'
  },
  {
    id: 'ic', name: 'IC·JC 연결로', icon: '🔀',
    speedLimit: 60, thermal: '3대/개소', piezo: '2개소', hasPiezo: true,
    risks: ['급곡선 구조', '진출입 속도 제어'],
    law: '도로 구조 규칙 제33조'
  },
  {
    id: 'merge', name: '병목·합류구간', icon: '🚦',
    speedLimit: 80, thermal: '3대/개소', piezo: '2개소', hasPiezo: true,
    risks: ['흐름 동기화', '합류 충돌 방지'],
    law: '도로교통법 제65조'
  }
];

const WEATHER = {
  clear: { name: '맑음', decel: 0.0, signal: '현재 속도 유지', law: '법령 기준 속도 유지', cond: '정상 기상 조건 / 노면 건조' },
  rain:  { name: '비',    decel: 0.2, signal: '감속 20% 권고', law: '시행규칙 제19조 2항', cond: '일반 강우 / 가시거리 100m 이상' },
  snow:  { name: '눈·폭우', decel: 0.5, signal: '감속 50% 긴급 명령', law: '시행규칙 제19조 2항', cond: '적설 20mm 이상 또는 가시거리 100m 이하' },
  fog:   { name: '안개',  decel: 0.5, signal: '즉시 50% 감속 명령', law: '시행규칙 제19조 2항', cond: '가시거리 100m 이하 / 짙은 안개' }
};

let weather = 'clear';
let speed = 100;

function calcStatus(section, spd, wx) {
  const rec = section.speedLimit * (1 - WEATHER[wx].decel);
  const ratio = spd / rec;
  if (ratio > 1.05) return 'danger';
  if (ratio > 0.8)  return 'caution';
  return 'good';
}

const LABEL = { good: '양호', caution: '주의', danger: '위험' };

function renderPanels() {
  const grid = document.getElementById('road-grid');
  grid.innerHTML = SECTIONS.map(sec => {
    const st = calcStatus(sec, speed, weather);
    const rec = Math.round(sec.speedLimit * (1 - WEATHER[weather].decel));
    return `
      <div class="road-panel ${st}">
        <div class="panel-head">
          <span class="p-icon">${sec.icon}</span>
          <span class="p-name">${sec.name}</span>
          <span class="status-badge ${st}">${LABEL[st]}</span>
        </div>
        <div class="panel-body">
          <div class="speed-trio">
            <div class="s-item">
              <div class="s-lbl">제한속도</div>
              <div class="s-val limit">${sec.speedLimit}<span class="s-unit">km/h</span></div>
            </div>
            <div class="s-item">
              <div class="s-lbl">권장속도</div>
              <div class="s-val rec">${rec}<span class="s-unit">km/h</span></div>
            </div>
            <div class="s-item">
              <div class="s-lbl">현재속도</div>
              <div class="s-val cur ${st}">${speed}<span class="s-unit">km/h</span></div>
            </div>
          </div>
          <div class="sensor-row">
            <div class="sensor-item">
              <span class="s-icon">🔴</span>
              <span class="s-sensor-lbl">열화상</span>
              <span class="s-sensor-val">${sec.thermal}</span>
            </div>
            <div class="sensor-item">
              <span class="s-icon ${sec.hasPiezo ? '' : 'off'}">⚡</span>
              <span class="s-sensor-lbl">압전센서</span>
              <span class="s-sensor-val">${sec.piezo}</span>
            </div>
          </div>
          <div class="rim-box ${st}">
            <div class="rim-lbl">RIM 신호</div>
            <div class="rim-txt">${WEATHER[weather].signal}</div>
          </div>
          <div class="risk-row">
            ${sec.risks.map(r => `<span class="risk-tag">⚠ ${r}</span>`).join('')}
          </div>
          <div class="law-row">📋 ${sec.law}</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateControls() {
  const w = WEATHER[weather];
  document.getElementById('global-signal').textContent = w.signal;
  document.getElementById('global-law').textContent = w.law;
  document.getElementById('weather-cond').textContent = w.cond;
}

function updateSliderTrack() {
  const pct = ((speed - 10) / (120 - 10)) * 100;
  document.getElementById('speed-slider').style.background =
    `linear-gradient(to right, var(--orange) ${pct}%, var(--border) ${pct}%)`;
}

function update() {
  updateSliderTrack();
  updateControls();
  renderPanels();
}

document.querySelectorAll('.w-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.w-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    weather = btn.dataset.weather;
    update();
  });
});

const slider = document.getElementById('speed-slider');
slider.addEventListener('input', () => {
  speed = parseInt(slider.value);
  document.getElementById('speed-val').textContent = speed;
  update();
});

/* ── INFO TABS ─────────────────────────────── */
const TAB = {
  background: `
    <h3>배경 및 필요성</h3>
    <div class="info-text">
      <p>현재 자율주행 기술은 카메라와 라이다(LiDAR) 등 '시각적 센서'에 전적으로 의존하고 있으나, 이는 폭우나 안개 같은 기상 악화와 GPS 통신 오류 상황에서 인지 능력이 마비되는 치명적인 구조적 한계를 지니고 있습니다. 단순한 소프트웨어 보완만으로는 해결할 수 없는 이 시각 기반 시스템의 불확실성은 자율주행 시대의 안전을 위협하는 가장 큰 걸림돌입니다.</p>
      <p>RIM(Road Intelligence Matrix)은 기존의 수동적인 '보이는 신호등' 체계를 넘어, 도로 인프라 자체가 차량과 직접 소통하는 '보이지 않는 신호등' 체계를 통해 이 한계를 정면으로 돌파합니다.</p>
      <p>우리의 핵심 설계는 도로의 물리 계층에 직접 지능을 부여하여, 어떤 환경에서도 결코 끊기지 않는 '인지적 중복성(Cognitive Redundancy)'을 확보하는 데 목적이 있습니다. 이를 위해 사고 다발 구간에는 지면 매립형 압전 센서를 배치하여, 시각 센서가 무용지물이 되는 극한의 상황에서도 타이어의 압력을 통해 차량의 위치, 속도, 이상 거동을 0.1초 단위로 정밀하게 감지합니다.</p>
      <p>또한 일반 구간에는 열화상 인식 시스템을 구축하여 가시거리가 제로에 가까운 악천후 속에서도 보행자와 장애물을 완벽히 식별해냄으로써 인지 데이터의 공백을 원천 차단합니다.</p>
      <p>결과적으로 RIM은 차량 개별의 센서 성능에만 의존하던 기존 방식의 한계를 물리적·열적 데이터로 완벽하게 보완함으로써, 도로 인프라가 주도하는 디지털 기반의 안전 엔지니어링 솔루션을 제시합니다.</p>
    </div>
  `,
  sensors: `
    <h3>구간별 센서 배치</h3>
    <table class="info-table">
      <thead>
        <tr><th>구간</th><th>🔴 열화상카메라</th><th>⚡ 압전센서</th><th>단위</th></tr>
      </thead>
      <tbody>
        <tr><td>일반 고속도로</td><td>5대/km</td><td>없음</td><td>km당</td></tr>
        <tr><td>터널 진출입</td><td>2대</td><td>2개소</td><td>개소당</td></tr>
        <tr><td>급커브</td><td>3대</td><td>1개소</td><td>개소당</td></tr>
        <tr><td>교량·고가</td><td>3대</td><td>2개소</td><td>개소당</td></tr>
        <tr><td>IC·JC·병목</td><td>3대</td><td>2개소</td><td>개소당</td></tr>
      </tbody>
    </table>
  `,
  weather: `
    <h3>기상 조건별 감속 알고리즘</h3>
    <div class="algo-grid">
      <div class="algo-card">
        <div class="ac-icon">☀️</div>
        <div class="ac-name">맑음</div>
        <div class="ac-decel">0% 감속</div>
        <div class="ac-desc">정상 기상 조건 / 노면 건조. 법령 기준 속도 그대로 유지.</div>
        <div class="ac-signal ok">RIM: 현재 속도 유지</div>
      </div>
      <div class="algo-card">
        <div class="ac-icon">🌧️</div>
        <div class="ac-name">비</div>
        <div class="ac-decel">20% 감속</div>
        <div class="ac-desc">일반 강우 / 가시거리 100m 이상. 노면 마찰력 저하로 제동거리 증가, 수막현상 발생 가능.</div>
        <div class="ac-signal warn">RIM: 감속 20% 권고</div>
        <div class="ac-law">시행규칙 제19조 2항</div>
      </div>
      <div class="algo-card">
        <div class="ac-icon">❄️</div>
        <div class="ac-name">눈·폭우</div>
        <div class="ac-decel">50% 감속</div>
        <div class="ac-desc">적설 20mm 이상 또는 가시거리 100m 이하. 노면 결빙·적설로 타이어 접지력 급감, 제동 불능 위험.</div>
        <div class="ac-signal bad">RIM: 감속 50% 긴급 명령</div>
        <div class="ac-law">시행규칙 제19조 2항</div>
      </div>
      <div class="algo-card">
        <div class="ac-icon">🌫️</div>
        <div class="ac-name">안개</div>
        <div class="ac-decel">50% 감속</div>
        <div class="ac-desc">가시거리 100m 이하 / 짙은 안개. 가시거리 급감으로 돌발상황 대응 불가, 연쇄추돌 위험.</div>
        <div class="ac-signal bad">RIM: 즉시 50% 감속 명령</div>
        <div class="ac-law">시행규칙 제19조 2항</div>
      </div>
    </div>
  `,
  limits: `
    <h3>구간별 제한속도</h3>
    <div class="limit-grid">
      <div class="limit-card">
        <div class="lc-head">🚇 터널 진출입 구간</div>
        <div class="lc-speed">100 km/h</div>
        <div class="lc-rec">감속 10~20% 권장</div>
        <ul><li>시야 및 조도 변화</li><li>횡풍 발생 대비</li></ul>
        <div class="lc-law">도로교통법 제17조, 제48조</div>
      </div>
      <div class="limit-card">
        <div class="lc-head">↩️ 급커브 구간</div>
        <div class="lc-speed">40~60 km/h</div>
        <div class="lc-rec">곡률에 따라 차등 적용</div>
        <ul><li>원심력 이탈 방지</li><li>횡풍 반경에 따른 속도 제한</li></ul>
        <div class="lc-law">도로 구조 규칙 제19조</div>
      </div>
      <div class="limit-card">
        <div class="lc-head">🌉 교량·고가도로</div>
        <div class="lc-speed">본선 동일</div>
        <div class="lc-rec">악천후 시 즉시 감속</div>
        <ul><li>블랙아이스 생성 위험</li><li>측풍에 의한 이탈 방지</li></ul>
        <div class="lc-law">도로교통법 시행규칙 제19조 2항</div>
      </div>
      <div class="limit-card">
        <div class="lc-head">🔀 IC·JC 연결로</div>
        <div class="lc-speed">40~80 km/h</div>
        <div class="lc-rec">본선 설계속도에 비례</div>
        <ul><li>좁고 급한 곡선 구조</li><li>본선 진출입 속도 제어</li></ul>
        <div class="lc-law">도로 구조 규칙 제33조</div>
      </div>
      <div class="limit-card">
        <div class="lc-head">🚦 병목·합류구간</div>
        <div class="lc-speed">본선의 70~80%</div>
        <div class="lc-rec">가속 필요 구간</div>
        <ul><li>흐름 동기화 및 충돌 방지</li><li>원활한 합류 유도</li></ul>
        <div class="lc-law">도로교통법 제65조, 구조 규칙 제34조</div>
      </div>
    </div>
  `
};

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-body').innerHTML = TAB[btn.dataset.tab];
  });
});

document.getElementById('tab-body').innerHTML = TAB['background'];

update();
