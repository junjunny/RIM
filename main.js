/* ── DATA ─────────────────────────────────── */
const SECTIONS = [
  { id:'highway', name:'일반 고속도로', icon:'🛣️', speedLimit:100, thermal:'5대/km',   piezo:'없음',  hasPiezo:false, risks:['기상 조건에 따른 속도 조절','광역 감시 구간'],    law:'도로교통법 제17조' },
  { id:'tunnel',  name:'터널 진출입',   icon:'🚇', speedLimit:100, thermal:'2대/개소', piezo:'2개소', hasPiezo:true,  risks:['시야·조도 급변','횡풍 발생'],                  law:'도로교통법 제17조, 제48조' },
  { id:'curve',   name:'급커브 구간',   icon:'↩️', speedLimit:50,  thermal:'3대/개소', piezo:'1개소', hasPiezo:true,  risks:['원심력 이탈 위험','곡률별 속도 제한'],          law:'도로 구조 규칙 제19조' },
  { id:'bridge',  name:'교량·고가도로', icon:'🌉', speedLimit:100, thermal:'3대/개소', piezo:'2개소', hasPiezo:true,  risks:['블랙아이스 생성','측풍 이탈 위험'],             law:'도로교통법 시행규칙 제19조 2항' },
  { id:'ic',      name:'IC·JC 연결로', icon:'🔀', speedLimit:60,  thermal:'3대/개소', piezo:'2개소', hasPiezo:true,  risks:['급곡선 구조','진출입 속도 제어'],               law:'도로 구조 규칙 제33조' },
  { id:'merge',   name:'병목·합류구간', icon:'🚦', speedLimit:80,  thermal:'3대/개소', piezo:'2개소', hasPiezo:true,  risks:['흐름 동기화','합류 충돌 방지'],                 law:'도로교통법 제65조' }
];

const WEATHER = {
  clear:{ name:'맑음',    decel:0.0, signal:'현재 속도 유지',     law:'법령 기준 속도 유지',   cond:'정상 기상 조건 / 노면 건조' },
  rain: { name:'비',      decel:0.2, signal:'감속 20% 권고',      law:'시행규칙 제19조 2항',   cond:'일반 강우 / 가시거리 100m 이상' },
  snow: { name:'눈·폭우', decel:0.5, signal:'감속 50% 긴급 명령', law:'시행규칙 제19조 2항',   cond:'적설 20mm 이상 또는 가시거리 100m 이하' },
  fog:  { name:'안개',    decel:0.5, signal:'즉시 50% 감속 명령', law:'시행규칙 제19조 2항',   cond:'가시거리 100m 이하 / 짙은 안개' }
};

let weather = 'clear';
let speed   = 100;

/* ── STATUS ───────────────────────────────── */
function calcStatus(sec, spd, wx) {
  const rec   = sec.speedLimit * (1 - WEATHER[wx].decel);
  const ratio = spd / rec;
  if (ratio > 1.05) return 'danger';
  if (ratio > 0.8)  return 'caution';
  return 'good';
}

const LABEL   = { good:'양호', caution:'주의', danger:'위험' };
const CLR_NUM = { good:0x22c55e, caution:0xf97316, danger:0xef4444 };

/* ── HUD UPDATE ───────────────────────────── */
function updateHUD() {
  const w = WEATHER[weather];
  document.getElementById('global-signal').textContent = w.signal;
  document.getElementById('global-law').textContent    = w.law;
  document.getElementById('weather-cond').textContent  = w.cond;

  SECTIONS.forEach(sec => {
    const st  = calcStatus(sec, speed, weather);
    const rec = Math.round(sec.speedLimit * (1 - WEATHER[weather].decel));

    document.getElementById('panel-' + sec.id).className = 'road-panel ' + st;

    const badge = document.getElementById('badge-' + sec.id);
    badge.textContent = LABEL[st];
    badge.className   = 'hud-badge ' + st;

    document.getElementById('rec-' + sec.id).textContent = rec;

    const curEl = document.getElementById('cur-' + sec.id);
    curEl.className = 'hud-cur ' + st;
    curEl.querySelector('b').textContent = speed;

    const sigEl = document.getElementById('sig-' + sec.id);
    sigEl.textContent = w.signal;
    sigEl.className   = 'hud-signal ' + st;

    const sim = simScenes[sec.id];
    if (sim) updateSimStatus(sim, st);
  });
}

function updateSliderTrack() {
  const pct = ((speed - 10) / (120 - 10)) * 100;
  document.getElementById('speed-slider').style.background =
    `linear-gradient(to right, var(--orange) ${pct}%, var(--border) ${pct}%)`;
}

/* ══════════════════════════════════════════
   THREE.JS SIMULATION
═══════════════════════════════════════════ */
const simScenes = {};
const clock = new THREE.Clock();

const MAT_ROAD     = new THREE.MeshLambertMaterial({ color: 0x1c2d4a });
const MAT_SHOULDER = new THREE.MeshLambertMaterial({ color: 0x12202e });
const MAT_LANE     = new THREE.MeshBasicMaterial({ color: 0xffffff });
const MAT_YELLOW   = new THREE.MeshBasicMaterial({ color: 0xffd04a });
const MAT_TUNNEL   = new THREE.MeshLambertMaterial({ color: 0x0c1828 });
const MAT_PILLAR   = new THREE.MeshLambertMaterial({ color: 0x263d5a });
const MAT_RAIL     = new THREE.MeshLambertMaterial({ color: 0x2a4a6a });
const MAT_GRASS    = new THREE.MeshLambertMaterial({ color: 0x0d2d10 });

function mkBox(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function mkMat(hex)      { return new THREE.MeshLambertMaterial({ color: hex }); }

/* ── road surface ── */
function buildRoadSurface(scene, id) {
  const roadW = id === 'highway' ? 8 : id === 'merge' ? 7 : 5;

  const road = new THREE.Mesh(mkBox(roadW, 0.12, 44), MAT_ROAD);
  road.position.set(0, 0, -12);
  scene.add(road);

  const sh1 = new THREE.Mesh(mkBox(1.5, 0.1, 44), MAT_SHOULDER);
  sh1.position.set(roadW / 2 + 0.75, 0.005, -12);
  scene.add(sh1);
  const sh2 = sh1.clone();
  sh2.position.set(-(roadW / 2 + 0.75), 0.005, -12);
  scene.add(sh2);

  return roadW;
}

/* ── lane dashes (returned for scrolling animation) ── */
function buildLaneMarkings(scene, roadW, id) {
  const dashes = [];
  const geo    = mkBox(0.08, 0.015, 1.5);
  const mat    = id === 'highway' ? MAT_YELLOW : MAT_LANE;

  for (let z = -34; z < 12; z += 4) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, 0.075, z);
    scene.add(m);
    dashes.push(m);
  }

  if (id === 'highway' || id === 'merge') {
    const gap = roadW / 4;
    for (let z = -34; z < 12; z += 4) {
      const a = new THREE.Mesh(geo, MAT_LANE);
      a.position.set(gap, 0.075, z);
      scene.add(a);
      dashes.push(a);
      const b = new THREE.Mesh(geo, MAT_LANE);
      b.position.set(-gap, 0.075, z);
      scene.add(b);
      dashes.push(b);
    }
  }

  return dashes;
}

/* ── tunnel ── */
function buildTunnel(scene) {
  const mat = MAT_TUNNEL;
  const ceil = new THREE.Mesh(mkBox(6.5, 0.3, 18), mat);
  ceil.position.set(0, 3.6, -14);
  scene.add(ceil);
  const lw = new THREE.Mesh(mkBox(0.3, 3.6, 18), mat);
  lw.position.set(-3.25, 1.8, -14);
  scene.add(lw);
  const rw = lw.clone();
  rw.position.set(3.25, 1.8, -14);
  scene.add(rw);
  for (let z = -8; z >= -20; z -= 5) {
    const l = new THREE.PointLight(0x2255cc, 0.6, 6);
    l.position.set(0, 3.2, z);
    scene.add(l);
  }
}

/* ── bridge ── */
function buildBridge(scene) {
  const rGeo = mkBox(0.12, 0.65, 44);
  const r1 = new THREE.Mesh(rGeo, MAT_RAIL);
  r1.position.set(3.5, 0.38, -12);
  scene.add(r1);
  const r2 = r1.clone();
  r2.position.set(-3.5, 0.38, -12);
  scene.add(r2);
  [-8, -12, -16, -20, -24].forEach(z => {
    [-3.5, 3.5].forEach(x => {
      const post = new THREE.Mesh(mkBox(0.12, 1.5, 0.12), MAT_RAIL);
      post.position.set(x, 0.75, z);
      scene.add(post);
    });
  });
  [-8, -16, -24].forEach(z => {
    [-2, 2].forEach(x => {
      const p = new THREE.Mesh(mkBox(0.45, 5, 0.45), MAT_PILLAR);
      p.position.set(x, -2.5, z);
      scene.add(p);
    });
    const beam = new THREE.Mesh(mkBox(5, 0.25, 0.5), MAT_PILLAR);
    beam.position.set(0, -0.1, z);
    scene.add(beam);
  });
}

/* ── IC ramp ── */
function buildIC(scene) {
  const ramp = new THREE.Mesh(mkBox(2.8, 0.12, 16), MAT_ROAD);
  ramp.rotation.y = -0.45;
  ramp.position.set(4.5, 0, -8);
  scene.add(ramp);
  const div = new THREE.Mesh(mkBox(0.14, 0.45, 12), MAT_RAIL);
  div.position.set(2.3, 0.22, -10);
  scene.add(div);
  for (let z = -4; z > -14; z -= 4) {
    const arr = new THREE.Mesh(mkBox(0.07, 0.015, 0.8), MAT_LANE);
    arr.position.set(1.2, 0.075, z);
    arr.rotation.y = -0.45;
    scene.add(arr);
  }
}

/* ── merge extra lane ── */
function buildMerge(scene) {
  const lane = new THREE.Mesh(mkBox(2.8, 0.12, 14), MAT_ROAD);
  lane.rotation.y = 0.35;
  lane.position.set(-5, 0, -14);
  scene.add(lane);
  const div = new THREE.Mesh(mkBox(0.14, 0.45, 12), MAT_RAIL);
  div.position.set(-3, 0.22, -12);
  scene.add(div);
}

/* ── curve guardrails ── */
function buildCurveRails(scene) {
  for (let i = 0; i < 9; i++) {
    const a  = i * 0.14;
    const r1 = 13, r2 = 8;
    const x1 = r1 * Math.sin(a) + 3.5;
    const x2 = r2 * Math.sin(a) - 3.5;
    const z  = -r1 * (1 - Math.cos(a)) - 1;
    [x1, x2].forEach(x => {
      const seg = new THREE.Mesh(mkBox(0.14, 0.5, 2.8), MAT_RAIL);
      seg.position.set(x, 0.28, z);
      seg.rotation.y = -a;
      scene.add(seg);
    });
  }
}

/* ── cars ── */
function buildCars(scene, id, statusColor) {
  const cars = [];

  const egoMat = new THREE.MeshLambertMaterial({ color: 0xf97316, emissive: 0x301000 });
  const ego    = new THREE.Mesh(mkBox(1.4, 0.55, 2.2), egoMat);
  ego.position.set(id === 'highway' ? -2 : 0, 0.33, -1);
  scene.add(ego);
  const roof = new THREE.Mesh(mkBox(0.75, 0.06, 1.0), new THREE.MeshBasicMaterial({ color: 0xff9f43 }));
  roof.position.y = 0.32;
  ego.add(roof);
  cars.push({ mesh: ego, isEgo: true });

  const laneXs = id === 'highway' ? [-2, 2] :
                 id === 'merge'   ? [-1.5, 1.5] : [0];

  if (id === 'ic') {
    const mat = new THREE.MeshLambertMaterial({ color: statusColor, emissive: 0x080808 });
    const rc  = new THREE.Mesh(mkBox(1.2, 0.5, 2.0), mat);
    rc.position.set(4, 0.3, -9);
    rc.rotation.y = -0.45;
    scene.add(rc);
    cars.push({ mesh: rc, isEgo: false, laneX: 4, speed: 0.6, ramp: true, mat });
  }

  [{ z:-6, li:0 }, { z:-12, li:1 }, { z:-18, li:0 }, { z:-24, li:1 }].forEach((def, i) => {
    const lx  = laneXs[def.li % laneXs.length];
    const mat = new THREE.MeshLambertMaterial({ color: statusColor, emissive: 0x080808 });
    const npc = new THREE.Mesh(mkBox(1.2, 0.5, 2.0), mat);
    npc.position.set(lx, 0.3, def.z);
    scene.add(npc);
    [-0.4, 0.4].forEach(hx => {
      const hl = new THREE.Mesh(mkBox(0.18, 0.12, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(hx, -0.08, 1.02);
      npc.add(hl);
    });
    cars.push({ mesh: npc, isEgo: false, laneX: lx, speed: 0.65 + i * 0.08, mat });
  });

  return cars;
}

/* ── V2V rings ── */
function buildRings(scene, cars, statusColor) {
  const rings = [];
  const geo   = new THREE.RingGeometry(1.6, 1.9, 32);
  cars.forEach((car, i) => {
    if (car.isEgo) return;
    const mat  = new THREE.MeshBasicMaterial({ color: statusColor, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(car.mesh.position);
    ring.position.y = 0.2;
    scene.add(ring);
    rings.push({ mesh: ring, phase: (i / 5) % 1, car, mat });
  });
  return rings;
}

/* ── weather particles ── */
function buildParticles(scene) {
  const count = 320;
  const pos   = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 22;
    pos[i*3+1] = Math.random() * 14;
    pos[i*3+2] = (Math.random() - 0.5) * 34 - 10;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.08, transparent: true, opacity: 0 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return { pts, geo, mat, pos };
}

/* ── init one scene ── */
function initScene(sec) {
  const canvas = document.getElementById('canvas-' + sec.id);
  const panel  = canvas.parentElement;
  const W = panel.clientWidth  || 300;
  const H = panel.clientHeight || 230;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x060d1a);
  scene.fog = new THREE.Fog(0x060d1a, 35, 58);

  const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 80);
  camera.position.set(0, 7, 9);
  camera.lookAt(0, 0.5, -6);

  scene.add(new THREE.AmbientLight(0x1a2f50, 2.2));
  const dir = new THREE.DirectionalLight(0x4488cc, 1.0);
  dir.position.set(4, 10, 6);
  scene.add(dir);

  const egoLight = new THREE.PointLight(0xf97316, 0.8, 9);
  egoLight.position.set(0, 2, -1);
  scene.add(egoLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    sec.id === 'bridge' ? mkMat(0x0a1830) : MAT_GRASS
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  scene.add(ground);

  const roadW  = buildRoadSurface(scene, sec.id);
  const dashes = buildLaneMarkings(scene, roadW, sec.id);

  if (sec.id === 'tunnel') buildTunnel(scene);
  if (sec.id === 'bridge') buildBridge(scene);
  if (sec.id === 'ic')     buildIC(scene);
  if (sec.id === 'merge')  buildMerge(scene);
  if (sec.id === 'curve') {
    buildCurveRails(scene);
    camera.position.set(1.5, 7, 9);
    camera.lookAt(-1, 0.5, -8);
  }

  const st          = calcStatus(sec, speed, weather);
  const statusColor = CLR_NUM[st];
  const cars        = buildCars(scene, sec.id, statusColor);
  const rings       = buildRings(scene, cars, statusColor);
  const particles   = buildParticles(scene);

  simScenes[sec.id] = { renderer, scene, camera, cars, rings, particles, dashes, egoLight, sec, st };
}

/* ── update status colors ── */
function updateSimStatus(sim, st) {
  sim.st = st;
  const col = CLR_NUM[st];
  sim.cars.forEach(car  => { if (!car.isEgo && car.mat) car.mat.color.setHex(col); });
  sim.rings.forEach(r   => r.mat.color.setHex(col));
}

/* ── per-frame update ── */
function animateSim(sim, ts, dt) {
  const wx     = WEATHER[weather];
  const carSpd = (speed / 100) * (1 - wx.decel) * 0.055 * 60 * dt;

  sim.cars.forEach(car => {
    if (car.isEgo) return;
    if (car.ramp) {
      car.mesh.position.z += carSpd * car.speed;
      car.mesh.position.x += carSpd * car.speed * 0.3;
      if (car.mesh.position.z > 6) car.mesh.position.set(4, 0.3, -9);
    } else {
      car.mesh.position.z += carSpd * car.speed;
      if (car.mesh.position.z > 8) car.mesh.position.z = -28;
    }
  });

  sim.dashes.forEach(m => {
    m.position.z += carSpd;
    if (m.position.z > 10) m.position.z -= 44;
  });

  sim.rings.forEach(r => {
    const phase = (ts * 1.1 + r.phase) % 1;
    r.mesh.scale.setScalar(0.75 + phase * 1.35);
    r.mat.opacity    = (1 - phase) * 0.72;
    r.mesh.position.z = r.car.mesh.position.z;
    r.mesh.position.x = r.car.mesh.position.x;
  });

  const { geo, mat, pos } = sim.particles;
  const isRain = weather === 'rain';
  const isSnow = weather === 'snow';
  const isFog  = weather === 'fog';

  mat.opacity = (isRain || isSnow) ? 0.78 : 0;
  if (isRain || isSnow) {
    const fallSpd = isRain ? 9 : 1.8;
    for (let i = 0; i < 320; i++) {
      pos[i*3+1] -= fallSpd * dt;
      if (isSnow) pos[i*3] += (Math.random() - 0.5) * 0.25;
      if (pos[i*3+1] < -1) {
        pos[i*3]   = (Math.random() - 0.5) * 22;
        pos[i*3+1] = 14;
        pos[i*3+2] = (Math.random() - 0.5) * 34 - 10;
      }
    }
    geo.attributes.position.needsUpdate = true;
    mat.size = isRain ? 0.055 : 0.13;
    mat.color.setHex(isRain ? 0x88aadd : 0xddeeff);
  }

  sim.scene.fog.near = isFog ? 6  : 35;
  sim.scene.fog.far  = isFog ? 18 : 58;
  sim.scene.fog.color.setHex(isFog ? 0x2a4455 : 0x060d1a);
  sim.egoLight.intensity = 0.6 + Math.sin(ts * 2.5) * 0.2;
}

/* ── render loop ── */
function renderLoop(timestamp) {
  requestAnimationFrame(renderLoop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const ts = timestamp / 1000;
  Object.values(simScenes).forEach(sim => {
    animateSim(sim, ts, dt);
    sim.renderer.render(sim.scene, sim.camera);
  });
}

window.addEventListener('resize', () => {
  Object.values(simScenes).forEach(sim => {
    const canvas = sim.renderer.domElement;
    const W = canvas.parentElement.clientWidth;
    const H = canvas.parentElement.clientHeight;
    if (W && H) {
      sim.renderer.setSize(W, H, false);
      sim.camera.aspect = W / H;
      sim.camera.updateProjectionMatrix();
    }
  });
});

/* ══════════════════════════════════════════
   INFO TABS
═══════════════════════════════════════════ */
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
      <thead><tr><th>구간</th><th>🔴 열화상카메라</th><th>⚡ 압전센서</th><th>단위</th></tr></thead>
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
      <div class="algo-card"><div class="ac-icon">☀️</div><div class="ac-name">맑음</div><div class="ac-decel">0% 감속</div><div class="ac-desc">정상 기상 조건 / 노면 건조. 법령 기준 속도 그대로 유지.</div><div class="ac-signal ok">RIM: 현재 속도 유지</div></div>
      <div class="algo-card"><div class="ac-icon">🌧️</div><div class="ac-name">비</div><div class="ac-decel">20% 감속</div><div class="ac-desc">일반 강우 / 가시거리 100m 이상. 노면 마찰력 저하로 제동거리 증가, 수막현상 발생 가능.</div><div class="ac-signal warn">RIM: 감속 20% 권고</div><div class="ac-law">시행규칙 제19조 2항</div></div>
      <div class="algo-card"><div class="ac-icon">❄️</div><div class="ac-name">눈·폭우</div><div class="ac-decel">50% 감속</div><div class="ac-desc">적설 20mm 이상 또는 가시거리 100m 이하. 노면 결빙·적설로 타이어 접지력 급감, 제동 불능 위험.</div><div class="ac-signal bad">RIM: 감속 50% 긴급 명령</div><div class="ac-law">시행규칙 제19조 2항</div></div>
      <div class="algo-card"><div class="ac-icon">🌫️</div><div class="ac-name">안개</div><div class="ac-decel">50% 감속</div><div class="ac-desc">가시거리 100m 이하 / 짙은 안개. 가시거리 급감으로 돌발상황 대응 불가, 연쇄추돌 위험.</div><div class="ac-signal bad">RIM: 즉시 50% 감속 명령</div><div class="ac-law">시행규칙 제19조 2항</div></div>
    </div>
  `,
  limits: `
    <h3>구간별 제한속도</h3>
    <div class="limit-grid">
      <div class="limit-card"><div class="lc-head">🚇 터널 진출입 구간</div><div class="lc-speed">100 km/h</div><div class="lc-rec">감속 10~20% 권장</div><ul><li>시야 및 조도 변화</li><li>횡풍 발생 대비</li></ul><div class="lc-law">도로교통법 제17조, 제48조</div></div>
      <div class="limit-card"><div class="lc-head">↩️ 급커브 구간</div><div class="lc-speed">40~60 km/h</div><div class="lc-rec">곡률에 따라 차등 적용</div><ul><li>원심력 이탈 방지</li><li>횡풍 반경에 따른 속도 제한</li></ul><div class="lc-law">도로 구조 규칙 제19조</div></div>
      <div class="limit-card"><div class="lc-head">🌉 교량·고가도로</div><div class="lc-speed">본선 동일</div><div class="lc-rec">악천후 시 즉시 감속</div><ul><li>블랙아이스 생성 위험</li><li>측풍에 의한 이탈 방지</li></ul><div class="lc-law">도로교통법 시행규칙 제19조 2항</div></div>
      <div class="limit-card"><div class="lc-head">🔀 IC·JC 연결로</div><div class="lc-speed">40~80 km/h</div><div class="lc-rec">본선 설계속도에 비례</div><ul><li>좁고 급한 곡선 구조</li><li>본선 진출입 속도 제어</li></ul><div class="lc-law">도로 구조 규칙 제33조</div></div>
      <div class="limit-card"><div class="lc-head">🚦 병목·합류구간</div><div class="lc-speed">본선의 70~80%</div><div class="lc-rec">가속 필요 구간</div><ul><li>흐름 동기화 및 충돌 방지</li><li>원활한 합류 유도</li></ul><div class="lc-law">도로교통법 제65조, 구조 규칙 제34조</div></div>
    </div>
  `
};

/* ── EVENT LISTENERS ──────────────────────── */
document.querySelectorAll('.w-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.w-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    weather = btn.dataset.weather;
    updateHUD();
  });
});

const slider = document.getElementById('speed-slider');
slider.addEventListener('input', () => {
  speed = parseInt(slider.value);
  document.getElementById('speed-val').textContent = speed;
  updateSliderTrack();
  updateHUD();
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-body').innerHTML = TAB[btn.dataset.tab];
  });
});

document.getElementById('tab-body').innerHTML = TAB['background'];

/* ── BOOT ─────────────────────────────────── */
SECTIONS.forEach(initScene);
updateSliderTrack();
updateHUD();
requestAnimationFrame(renderLoop);
