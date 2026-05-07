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

/* 4-lane one-direction road constants */
const ROAD_W  = 10;
const LANE_XS = [-3.75, -1.25, 1.25, 3.75];

/* shared materials */
const MAT_ROAD     = new THREE.MeshLambertMaterial({ color: 0x1c2d4a });
const MAT_ROAD_B   = new THREE.MeshLambertMaterial({ color: 0x2a3545 }); // bridge deck
const MAT_ROAD_T   = new THREE.MeshLambertMaterial({ color: 0x0e1c28 }); // tunnel asphalt
const MAT_SHOULDER = new THREE.MeshLambertMaterial({ color: 0x0f1e30 });
const MAT_LANE     = new THREE.MeshBasicMaterial({ color: 0xffffff });
const MAT_GRASS    = new THREE.MeshLambertMaterial({ color: 0x0d2a10 });
const MAT_TUNNEL   = new THREE.MeshLambertMaterial({ color: 0x090f18 });
const MAT_PILLAR   = new THREE.MeshLambertMaterial({ color: 0x263d5a });
const MAT_RAIL     = new THREE.MeshLambertMaterial({ color: 0x3a5a7a });
const MAT_CONE     = new THREE.MeshLambertMaterial({ color: 0xf97316, emissive: 0x200800 });
const MAT_BARRIER  = new THREE.MeshLambertMaterial({ color: 0xdd4400, emissive: 0x180400 });
const MAT_CHEVRON  = new THREE.MeshLambertMaterial({ color: 0xffcc00 });
const MAT_SIGN_G   = new THREE.MeshLambertMaterial({ color: 0x1a7a38 });
const MAT_SIGN_Y   = new THREE.MeshLambertMaterial({ color: 0xddcc00 });

function mkBox(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function mkMat(hex)      { return new THREE.MeshLambertMaterial({ color: hex }); }

/* ── 4-lane road surface ── */
function buildRoadSurface(scene, id) {
  const mat = id === 'bridge' ? MAT_ROAD_B : id === 'tunnel' ? MAT_ROAD_T : MAT_ROAD;
  const road = new THREE.Mesh(mkBox(ROAD_W, 0.12, 44), mat);
  road.position.set(0, 0, -12);
  scene.add(road);

  [-1, 1].forEach(s => {
    const sh = new THREE.Mesh(mkBox(2.8, 0.1, 44), MAT_SHOULDER);
    sh.position.set(s * (ROAD_W / 2 + 1.4), 0.005, -12);
    scene.add(sh);
  });
}

/* ── lane markings: 3 dashed inner + 2 solid edges ── */
function buildLaneMarkings(scene, id) {
  const dashes  = [];
  const dashGeo = mkBox(0.1, 0.015, 2.2);

  [-2.5, 0, 2.5].forEach(x => {
    // rightmost divider becomes orange for merge (lane closing)
    const mat = (id === 'merge' && x === 2.5) ? mkMat(0xf97316) : MAT_LANE;
    for (let z = -34; z < 14; z += 5) {
      const m = new THREE.Mesh(dashGeo, mat);
      m.position.set(x, 0.075, z);
      scene.add(m);
      dashes.push(m);
    }
  });

  // solid edge lines (static, don't scroll)
  [-5, 5].forEach(x => {
    const e = new THREE.Mesh(mkBox(0.12, 0.015, 44), MAT_LANE);
    e.position.set(x, 0.075, -12);
    scene.add(e);
  });

  return dashes;
}

/* ── TUNNEL ── */
function buildTunnel(scene) {
  // Side walls
  [-1, 1].forEach(s => {
    const wall = new THREE.Mesh(mkBox(0.5, 4.5, 38), MAT_TUNNEL);
    wall.position.set(s * (ROAD_W / 2 + 0.95), 2.1, -13);
    scene.add(wall);

    // Wall tile strips (visual rhythm)
    for (let z = -4; z >= -30; z -= 3.8) {
      const tile = new THREE.Mesh(mkBox(0.05, 0.07, 3.3), new THREE.MeshBasicMaterial({ color: 0x1c3050 }));
      tile.position.set(s * (ROAD_W / 2 + 0.68), 1.6, z);
      scene.add(tile);
    }
  });

  // Ceiling
  const ceil = new THREE.Mesh(mkBox(ROAD_W + 2.4, 0.55, 38), MAT_TUNNEL);
  ceil.position.set(0, 4.27, -13);
  scene.add(ceil);

  // Portal frame at entry
  const fTop = new THREE.Mesh(mkBox(ROAD_W + 3.5, 0.9, 0.5), mkMat(0x0f1e30));
  fTop.position.set(0, 4.7, -0.8);
  scene.add(fTop);
  [-1, 1].forEach(s => {
    const fp = new THREE.Mesh(mkBox(0.55, 4.7, 0.5), mkMat(0x0f1e30));
    fp.position.set(s * (ROAD_W / 2 + 1.2), 2.35, -0.8);
    scene.add(fp);
  });

  // Fluorescent ceiling light strips
  for (let z = -5; z >= -28; z -= 4.5) {
    const strip = new THREE.Mesh(mkBox(0.22, 0.06, 1.1), new THREE.MeshBasicMaterial({ color: 0xbbd8ff }));
    strip.position.set(0, 3.96, z);
    scene.add(strip);
    const l = new THREE.PointLight(0x7799cc, 1.1, 9);
    l.position.set(0, 3.8, z);
    scene.add(l);
  }
}

/* ── BRIDGE ── */
function buildBridge(scene) {
  // Side railings
  [-1, 1].forEach(s => {
    const x = s * (ROAD_W / 2 + 0.25);
    const topRail = new THREE.Mesh(mkBox(0.12, 0.14, 44), MAT_RAIL);
    topRail.position.set(x, 1.2, -12);
    scene.add(topRail);
    const midRail = new THREE.Mesh(mkBox(0.08, 0.08, 44), MAT_RAIL);
    midRail.position.set(x, 0.65, -12);
    scene.add(midRail);
    for (let z = -1; z >= -33; z -= 2.8) {
      const post = new THREE.Mesh(mkBox(0.1, 1.3, 0.1), MAT_RAIL);
      post.position.set(x, 0.62, z);
      scene.add(post);
    }
  });

  // Support towers at two points
  [-7, -23].forEach(z => {
    [-1, 1].forEach(s => {
      const tower = new THREE.Mesh(mkBox(0.6, 9, 0.6), MAT_PILLAR);
      tower.position.set(s * 6, -3.9, z);
      scene.add(tower);
    });
    // Cross beam
    const xBeam = new THREE.Mesh(mkBox(13, 0.4, 0.55), MAT_PILLAR);
    xBeam.position.set(0, -0.2, z);
    scene.add(xBeam);
    // Under-deck longitudinal beams
    [-2.5, 2.5].forEach(x => {
      const lBeam = new THREE.Mesh(mkBox(0.4, 0.35, 44), mkMat(0x1e3045));
      lBeam.position.set(x, -0.22, -12);
      scene.add(lBeam);
    });
  });

  // Expansion joints (dark lines across deck)
  [-6, -15, -24].forEach(z => {
    const joint = new THREE.Mesh(mkBox(ROAD_W, 0.02, 0.14), mkMat(0x060c18));
    joint.position.set(0, 0.13, z);
    scene.add(joint);
  });

  // Open void below (sky visible underneath)
  const void_ = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mkMat(0x05101e));
  void_.rotation.x = -Math.PI / 2;
  void_.position.y = -6.5;
  scene.add(void_);
}

/* ── CURVE ── */
function buildCurve(scene) {
  const arcR = 20;

  for (let i = 0; i < 11; i++) {
    const a    = i * 0.12;
    const aMid = a + 0.06;

    // Outer guardrail (follows arc on right side)
    const ox = ROAD_W / 2 + 0.5 + arcR * Math.sin(a);
    const oz = -2 - arcR * (1 - Math.cos(a));
    const seg = new THREE.Mesh(mkBox(0.15, 0.55, 3.3), MAT_RAIL);
    seg.position.set(ox, 0.3, oz);
    seg.rotation.y = -aMid;
    scene.add(seg);

    // Chevron delineator posts on outer edge
    const cx = ROAD_W / 2 + 1.1 + arcR * Math.sin(aMid);
    const cz = -2 - arcR * (1 - Math.cos(aMid));
    const post = new THREE.Mesh(mkBox(0.16, 1.2, 0.16), MAT_CHEVRON);
    post.position.set(cx, 0.65, cz);
    scene.add(post);
    // Red band on post
    const band = new THREE.Mesh(mkBox(0.2, 0.22, 0.2), MAT_BARRIER);
    band.position.set(cx, 0.95, cz);
    scene.add(band);
  }

  // Inner embankment (hill on left)
  const hill = new THREE.Mesh(mkBox(7, 3.5, 38), mkMat(0x0c2810));
  hill.position.set(-11.5, 1.5, -13);
  scene.add(hill);
  const hillFace = new THREE.Mesh(mkBox(0.35, 3.5, 38), mkMat(0x183a20));
  hillFace.position.set(-8.0, 1.5, -13);
  scene.add(hillFace);
  // Inner curb
  const curb = new THREE.Mesh(mkBox(0.3, 0.25, 40), mkMat(0x4a5a68));
  curb.position.set(-(ROAD_W / 2 + 0.45), 0.14, -12);
  scene.add(curb);

  // Speed warning signs on right shoulder
  [-4, -16].forEach(z => {
    const post = new THREE.Mesh(mkBox(0.08, 2.0, 0.08), mkMat(0x888888));
    post.position.set(ROAD_W / 2 + 2.0, 1.0, z);
    scene.add(post);
    const sign = new THREE.Mesh(mkBox(0.7, 0.7, 0.06), MAT_SIGN_Y);
    sign.position.set(ROAD_W / 2 + 2.0, 2.2, z);
    sign.rotation.y = Math.PI / 4;
    scene.add(sign);
  });
}

/* ── IC ── */
function buildIC(scene) {
  // Overhead gantry structure
  const gBar = new THREE.Mesh(mkBox(ROAD_W + 3, 0.24, 0.32), mkMat(0x304050));
  gBar.position.set(0, 5.2, -5.5);
  scene.add(gBar);
  [-1, 1].forEach(s => {
    const gLeg = new THREE.Mesh(mkBox(0.24, 5.4, 0.32), mkMat(0x304050));
    gLeg.position.set(s * (ROAD_W / 2 + 1.2), 2.7, -5.5);
    scene.add(gLeg);
  });

  // Green exit sign on gantry
  const sign = new THREE.Mesh(mkBox(3.2, 1.0, 0.18), MAT_SIGN_G);
  sign.position.set(3.6, 4.72, -5.35);
  scene.add(sign);
  // White text placeholder bars on sign
  [[3.0, 4.72], [4.0, 4.50]].forEach(([x, y]) => {
    const bar = new THREE.Mesh(mkBox(0.6, 0.15, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bar.position.set(x, y, -5.26);
    scene.add(bar);
  });

  // Exit ramp surface (diverges right)
  const ramp = new THREE.Mesh(mkBox(4.0, 0.12, 22), mkMat(0x1c2d4a));
  ramp.rotation.y = -0.36;
  ramp.position.set(9.5, 0, -15);
  scene.add(ramp);

  // Exit nose (yellow-black striped barrier)
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(mkBox(0.55, 0.85, 0.55),
      i % 2 === 0 ? mkMat(0xffcc00) : mkMat(0x111111));
    b.position.set(5.5 + i * 0.6, 0.44, -7.5);
    scene.add(b);
  }

  // Ramp guardrail
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(mkBox(0.13, 0.5, 3.5), MAT_RAIL);
    r.rotation.y = -0.36;
    r.position.set(8.0 + i * 0.45, 0.3, -10 - i * 2.8);
    scene.add(r);
  }

  // Lane 4 chevron arrows on road (exit guidance)
  for (let z = -3; z >= -11; z -= 3.5) {
    const chev = new THREE.Mesh(mkBox(2.2, 0.013, 0.55), MAT_CHEVRON);
    chev.position.set(3.75, 0.077, z);
    chev.rotation.y = 0.32;
    scene.add(chev);
  }
}

/* ── MERGE ── */
function buildMerge(scene) {
  // Water-filled barrier blocks: close lane 4, moves inward toward lane 3
  for (let i = 0; i < 11; i++) {
    const progress = i / 10;
    const x = 5.2 - progress * 2.0;
    const z = -3 - i * 2.4;
    const bar = new THREE.Mesh(mkBox(0.45, 0.9, 1.2), MAT_BARRIER);
    bar.position.set(x, 0.46, z);
    scene.add(bar);
    // White stripe alternating
    if (i % 2 === 0) {
      const stripe = new THREE.Mesh(mkBox(0.48, 0.18, 1.22), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      stripe.position.set(x, 0.62, z);
      scene.add(stripe);
    }
  }

  // Traffic cones along lane 4
  for (let z = -1.5; z >= -22; z -= 3.2) {
    const base = new THREE.Mesh(mkBox(0.38, 0.05, 0.38), mkMat(0x1a1a1a));
    base.position.set(3.75, 0.03, z);
    scene.add(base);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.75, 6), MAT_CONE);
    cone.position.set(3.75, 0.42, z);
    scene.add(cone);
    const stripe = new THREE.Mesh(mkBox(0.4, 0.12, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.set(3.75, 0.6, z);
    scene.add(stripe);
  }

  // Merge arrow painted on lane 3 (→ lane 2)
  const arrow = new THREE.Mesh(mkBox(2.8, 0.013, 0.75), MAT_CHEVRON);
  arrow.position.set(1.25, 0.077, -9);
  arrow.rotation.y = -0.42;
  scene.add(arrow);

  // Warning sign right shoulder
  const post = new THREE.Mesh(mkBox(0.09, 2.0, 0.09), mkMat(0x888888));
  post.position.set(7.0, 1.0, -8);
  scene.add(post);
  const wsign = new THREE.Mesh(mkBox(0.75, 0.75, 0.06), mkMat(0xffcc00));
  wsign.position.set(7.0, 2.2, -8);
  scene.add(wsign);
}

/* ── environment / ground ── */
function buildEnvironment(scene, id) {
  if (id === 'tunnel') {
    // Dark floor outside walls
    const floor = new THREE.Mesh(mkBox(30, 0.1, 44), mkMat(0x040810));
    floor.position.set(0, -0.1, -12);
    scene.add(floor);
    return;
  }

  if (id === 'bridge') return; // bridge has void below, added in buildBridge

  // Grass ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), MAT_GRASS);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.09;
  scene.add(ground);

  if (id === 'highway') {
    // Distant tree silhouettes both sides
    [[-13,-18],[-15,-26],[-14,-33],[13,-15],[15,-24],[14,-32],[16,-10]].forEach(([x, z]) => {
      const trunk = new THREE.Mesh(mkBox(0.45, 2.8, 0.45), mkMat(0x18100a));
      trunk.position.set(x, 1.4, z);
      scene.add(trunk);
      const top = new THREE.Mesh(mkBox(2.8, 4.0, 2.8), mkMat(0x082010));
      top.position.set(x, 4.5, z);
      scene.add(top);
    });
    // Distance markers on right shoulder
    [-8, -20].forEach(z => {
      const post = new THREE.Mesh(mkBox(0.09, 1.4, 0.09), mkMat(0xaaaaaa));
      post.position.set(ROAD_W / 2 + 1.8, 0.7, z);
      scene.add(post);
      const head = new THREE.Mesh(mkBox(0.3, 0.3, 0.06), mkMat(0xff6600));
      head.position.set(ROAD_W / 2 + 1.8, 1.5, z);
      scene.add(head);
    });
  }

  if (id === 'curve') {
    // Hill added inside buildCurve
  }
}

/* ── cars ── */
function buildCars(scene, id, statusColor) {
  const cars = [];

  // EGO car (orange) — lane 2
  const egoX   = LANE_XS[1];
  const egoMat = new THREE.MeshLambertMaterial({ color: 0xf97316, emissive: 0x301000 });
  const ego    = new THREE.Mesh(mkBox(1.5, 0.62, 2.7), egoMat);
  ego.position.set(egoX, 0.38, -1);
  scene.add(ego);
  const roof = new THREE.Mesh(mkBox(1.05, 0.08, 1.25), new THREE.MeshBasicMaterial({ color: 0xff9f43 }));
  roof.position.y = 0.37;
  ego.add(roof);
  cars.push({ mesh: ego, isEgo: true });

  // NPC definitions per scene
  const npcDefs = id === 'merge'
    ? [ // lane 4 blocked by cones
        { laneIdx: 0, z: -7,  spd: 0.60 },
        { laneIdx: 2, z: -10, spd: 0.72 },
        { laneIdx: 0, z: -18, spd: 0.65 },
        { laneIdx: 1, z: -24, spd: 0.78 },
        { laneIdx: 2, z: -30, spd: 0.82 },
      ]
    : id === 'ic'
    ? [
        { laneIdx: 0, z: -8,  spd: 0.62 },
        { laneIdx: 2, z: -11, spd: 0.70 },
        { laneIdx: 3, z: -6,  spd: 0.80, ramp: true },
        { laneIdx: 0, z: -20, spd: 0.68 },
        { laneIdx: 1, z: -25, spd: 0.75 },
      ]
    : [
        { laneIdx: 0, z: -7,  spd: 0.60 },
        { laneIdx: 2, z: -10, spd: 0.73 },
        { laneIdx: 3, z: -5,  spd: 0.88 },
        { laneIdx: 0, z: -19, spd: 0.66 },
        { laneIdx: 1, z: -23, spd: 0.78 },
        { laneIdx: 3, z: -29, spd: 0.92 },
      ];

  npcDefs.forEach((def, i) => {
    const lx     = LANE_XS[def.laneIdx];
    const mat    = new THREE.MeshLambertMaterial({ color: statusColor, emissive: 0x080808 });
    const isTruck = i % 4 === 0;
    const h      = isTruck ? 1.0 : 0.58;
    const len    = isTruck ? 3.5 : 2.3;
    const npc    = new THREE.Mesh(mkBox(1.4, h, len), mat);
    npc.position.set(lx, h / 2 + 0.07, def.z);
    if (def.ramp) npc.rotation.y = -0.36;
    scene.add(npc);

    // Headlights (front)
    [-0.44, 0.44].forEach(hx => {
      const hl = new THREE.Mesh(mkBox(0.2, 0.14, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(hx, -0.06, len / 2 + 0.02);
      npc.add(hl);
    });
    // Tail lights (rear, red)
    const tail = new THREE.Mesh(mkBox(1.05, 0.12, 0.04), new THREE.MeshBasicMaterial({ color: 0xff2200 }));
    tail.position.set(0, -0.12, -(len / 2 + 0.02));
    npc.add(tail);

    cars.push({ mesh: npc, isEgo: false, laneX: lx, speed: def.spd, mat, ramp: !!def.ramp });
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

/* ── weather particles (unchanged) ── */
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

/* ── per-scene camera / fog config ── */
const SCENE_CFG = {
  highway: { bg: 0x060d1a, fogClr: 0x060d1a, fogN: 32, fogF: 56, cam: [0, 7, 13], look: [0,  0.5, -8]  },
  tunnel:  { bg: 0x020508, fogClr: 0x020508, fogN:  9, fogF: 28, cam: [0, 3.5, 8], look: [0,  1.8,-11]  },
  curve:   { bg: 0x060d1a, fogClr: 0x060d1a, fogN: 26, fogF: 50, cam:[-4, 7, 13], look: [2,  0.5,-10]  },
  bridge:  { bg: 0x07121f, fogClr: 0x07121f, fogN: 36, fogF: 64, cam: [0, 9, 13], look: [0, -0.5, -8]  },
  ic:      { bg: 0x060d1a, fogClr: 0x060d1a, fogN: 30, fogF: 56, cam:[-3, 7, 13], look: [3,  0.5, -8]  },
  merge:   { bg: 0x060d1a, fogClr: 0x060d1a, fogN: 28, fogF: 52, cam: [2, 7, 13], look: [2,  0.5, -8]  },
};

/* ── init one scene ── */
function initScene(sec) {
  const canvas = document.getElementById('canvas-' + sec.id);
  const panel  = canvas.parentElement;
  const W = panel.clientWidth  || 300;
  const H = panel.clientHeight || 230;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const cfg   = SCENE_CFG[sec.id];
  scene.background = new THREE.Color(cfg.bg);
  scene.fog = new THREE.Fog(cfg.fogClr, cfg.fogN, cfg.fogF);

  const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 80);
  camera.position.set(...cfg.cam);
  camera.lookAt(...cfg.look);

  // Scene-specific lighting
  if (sec.id === 'tunnel') {
    scene.add(new THREE.AmbientLight(0x0a1828, 1.8));
    // tunnel lights added inside buildTunnel
  } else if (sec.id === 'bridge') {
    scene.add(new THREE.AmbientLight(0x1a3060, 2.0));
    const sun = new THREE.DirectionalLight(0x5588bb, 1.3);
    sun.position.set(8, 16, 6);
    scene.add(sun);
  } else {
    scene.add(new THREE.AmbientLight(0x1a2f50, 2.2));
    const dir = new THREE.DirectionalLight(0x4488cc, 1.0);
    dir.position.set(4, 10, 6);
    scene.add(dir);
  }

  const egoLight = new THREE.PointLight(0xf97316, 0.8, 9);
  egoLight.position.set(LANE_XS[1], 2, -1);
  scene.add(egoLight);

  buildEnvironment(scene, sec.id);
  buildRoadSurface(scene, sec.id);
  const dashes = buildLaneMarkings(scene, sec.id);

  if (sec.id === 'tunnel') buildTunnel(scene);
  if (sec.id === 'bridge') buildBridge(scene);
  if (sec.id === 'curve')  buildCurve(scene);
  if (sec.id === 'ic')     buildIC(scene);
  if (sec.id === 'merge')  buildMerge(scene);

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
  sim.cars.forEach(car => { if (!car.isEgo && car.mat) car.mat.color.setHex(col); });
  sim.rings.forEach(r  => r.mat.color.setHex(col));
}

/* ── per-frame update ── */
function animateSim(sim, ts, dt) {
  const wx     = WEATHER[weather];
  const carSpd = (speed / 100) * (1 - wx.decel) * 0.055 * 60 * dt;

  sim.cars.forEach(car => {
    if (car.isEgo) return;
    if (car.ramp) {
      car.mesh.position.z += carSpd * car.speed;
      car.mesh.position.x += carSpd * car.speed * 0.38;
      if (car.mesh.position.z > 7) {
        car.mesh.position.set(LANE_XS[3], car.mesh.position.y, -6);
      }
    } else {
      car.mesh.position.z += carSpd * car.speed;
      if (car.mesh.position.z > 9) car.mesh.position.z = -30;
    }
  });

  sim.dashes.forEach(m => {
    m.position.z += carSpd;
    if (m.position.z > 13) m.position.z -= 50;
  });

  sim.rings.forEach(r => {
    const phase = (ts * 1.1 + r.phase) % 1;
    r.mesh.scale.setScalar(0.75 + phase * 1.35);
    r.mat.opacity     = (1 - phase) * 0.72;
    r.mesh.position.z = r.car.mesh.position.z;
    r.mesh.position.x = r.car.mesh.position.x;
  });

  /* ── weather particles (unchanged) ── */
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

  const cfg = SCENE_CFG[sim.sec.id];
  if (isFog) {
    sim.scene.fog.near = sim.sec.id === 'tunnel' ? cfg.fogN : 6;
    sim.scene.fog.far  = sim.sec.id === 'tunnel' ? cfg.fogF : 18;
    sim.scene.fog.color.setHex(0x2a4455);
  } else {
    sim.scene.fog.near = cfg.fogN;
    sim.scene.fog.far  = cfg.fogF;
    sim.scene.fog.color.setHex(cfg.fogClr);
  }

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
