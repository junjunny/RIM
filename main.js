/* ── DATA ─────────────────────────────────── */
const SECTIONS = [
  { id:'highway', name:'일반 고속도로', icon:'🛣️', speedLimit:100, thermal:'5대/km',   piezo:'없음',  hasPiezo:false },
  { id:'tunnel',  name:'터널 진출입',   icon:'🚇', speedLimit:100, thermal:'2대/개소', piezo:'2개소', hasPiezo:true  },
  { id:'curve',   name:'급커브 구간',   icon:'↩️', speedLimit:50,  thermal:'3대/개소', piezo:'1개소', hasPiezo:true  },
  { id:'bridge',  name:'교량·고가도로', icon:'🌉', speedLimit:100, thermal:'3대/개소', piezo:'2개소', hasPiezo:true  },
  { id:'ic',      name:'IC·JC 연결로', icon:'🔀', speedLimit:60,  thermal:'3대/개소', piezo:'2개소', hasPiezo:true  },
  { id:'merge',   name:'병목·합류구간', icon:'🚦', speedLimit:80,  thermal:'3대/개소', piezo:'2개소', hasPiezo:true  }
];

const WEATHER = {
  clear:{ name:'맑음',    decel:0.0, signal:'현재 속도 유지',     law:'법령 기준 속도 유지',   cond:'정상 기상 조건 / 노면 건조' },
  rain: { name:'비',      decel:0.2, signal:'감속 20% 권고',      law:'시행규칙 제19조 2항',   cond:'일반 강우 / 가시거리 100m 이상' },
  snow: { name:'눈·폭우', decel:0.5, signal:'감속 50% 긴급 명령', law:'시행규칙 제19조 2항',   cond:'적설 20mm 이상 또는 가시거리 100m 이하' },
  fog:  { name:'안개',    decel:0.5, signal:'즉시 50% 감속 명령', law:'시행규칙 제19조 2항',   cond:'가시거리 100m 이하 / 짙은 안개' }
};

let weather = 'clear';
let speed   = 100;

function calcStatus(sec, spd, wx) {
  const rec   = sec.speedLimit * (1 - WEATHER[wx].decel);
  const ratio = spd / rec;
  if (ratio > 1.05) return 'danger';
  if (ratio > 0.8)  return 'caution';
  return 'good';
}

const LABEL   = { good:'양호', caution:'주의', danger:'위험' };
const CLR_NUM = { good:0x22c55e, caution:0xf97316, danger:0xef4444 };

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
    badge.textContent = LABEL[st]; badge.className = 'hud-badge ' + st;
    document.getElementById('rec-' + sec.id).textContent = rec;
    const curEl = document.getElementById('cur-' + sec.id);
    curEl.className = 'hud-cur ' + st;
    curEl.querySelector('b').textContent = speed;
    const sigEl = document.getElementById('sig-' + sec.id);
    sigEl.textContent = w.signal; sigEl.className = 'hud-signal ' + st;
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

const ROAD_W  = 10;
const LANE_XS = [-3.75, -1.25, 1.25, 3.75];

/* curve arc constants */
const CURVE_SEG_LEN = 5.5;
const CURVE_ANGLE_STEP = 0.18;
const CURVE_SEGS    = 10;
const CURVE_ARC_R   = CURVE_SEG_LEN / CURVE_ANGLE_STEP; // ≈ 30.56

/* speed by lane: lane 0 (left) fastest → lane 3 (right) slowest */
const LANE_SPD = [1.10, 1.00, 0.78, 0.62];

/* materials */
const MAT_ROAD     = new THREE.MeshLambertMaterial({ color: 0x1c2d4a });
const MAT_ROAD_B   = new THREE.MeshLambertMaterial({ color: 0x2a3545 });
const MAT_ROAD_T   = new THREE.MeshLambertMaterial({ color: 0x363c42 });
const MAT_SHOULDER = new THREE.MeshLambertMaterial({ color: 0x0f1e30 });
const MAT_LANE     = new THREE.MeshBasicMaterial({ color: 0xffffff });
const MAT_GRASS    = new THREE.MeshLambertMaterial({ color: 0x0d2a10 });
const MAT_TUNNEL   = new THREE.MeshLambertMaterial({ color: 0x58626e });
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
  road.position.set(0, 0, -12); scene.add(road);
  [-1, 1].forEach(s => {
    const sh = new THREE.Mesh(mkBox(2.8, 0.1, 44), MAT_SHOULDER);
    sh.position.set(s * (ROAD_W / 2 + 1.4), 0.005, -12); scene.add(sh);
  });
}

/* ── lane markings ── */
function buildLaneMarkings(scene, id) {
  const dashes  = [];
  const dashGeo = mkBox(0.1, 0.015, 2.2);
  [-2.5, 0, 2.5].forEach(x => {
    const mat = (id === 'merge' && x === 2.5) ? mkMat(0xf97316) : MAT_LANE;
    for (let z = -34; z < 14; z += 5) {
      const m = new THREE.Mesh(dashGeo, mat);
      m.position.set(x, 0.075, z); scene.add(m); dashes.push(m);
    }
  });
  [-5, 5].forEach(x => {
    const e = new THREE.Mesh(mkBox(0.12, 0.015, 44), MAT_LANE);
    e.position.set(x, 0.075, -12); scene.add(e);
  });
  return dashes;
}

/* ── TUNNEL ── */
function buildTunnel(scene) {
  [-1, 1].forEach(s => {
    const wall = new THREE.Mesh(mkBox(0.5, 4.5, 38), MAT_TUNNEL);
    wall.position.set(s * (ROAD_W / 2 + 0.95), 2.1, -13); scene.add(wall);
    for (let z = -4; z >= -30; z -= 3.8) {
      const tile = new THREE.Mesh(mkBox(0.05, 0.07, 3.3), new THREE.MeshBasicMaterial({ color: 0x6a7888 }));
      tile.position.set(s * (ROAD_W / 2 + 0.68), 1.6, z); scene.add(tile);
    }
  });
  const ceil = new THREE.Mesh(mkBox(ROAD_W + 2.4, 0.55, 38), MAT_TUNNEL);
  ceil.position.set(0, 4.27, -13); scene.add(ceil);
  const fTop = new THREE.Mesh(mkBox(ROAD_W + 3.5, 0.9, 0.5), mkMat(0x4a5460));
  fTop.position.set(0, 4.7, -0.8); scene.add(fTop);
  [-1, 1].forEach(s => {
    const fp = new THREE.Mesh(mkBox(0.55, 4.7, 0.5), mkMat(0x4a5460));
    fp.position.set(s * (ROAD_W / 2 + 1.2), 2.35, -0.8); scene.add(fp);
  });
  for (let z = -5; z >= -28; z -= 4.5) {
    const strip = new THREE.Mesh(mkBox(0.22, 0.06, 1.1), new THREE.MeshBasicMaterial({ color: 0xbbd8ff }));
    strip.position.set(0, 3.96, z); scene.add(strip);
    const l = new THREE.PointLight(0x7799cc, 1.1, 9);
    l.position.set(0, 3.8, z); scene.add(l);
  }
}

/* ── BRIDGE ── */
function buildBridge(scene) {
  [-1, 1].forEach(s => {
    const x = s * (ROAD_W / 2 + 0.25);
    const topRail = new THREE.Mesh(mkBox(0.12, 0.14, 44), MAT_RAIL);
    topRail.position.set(x, 1.2, -12); scene.add(topRail);
    const midRail = new THREE.Mesh(mkBox(0.08, 0.08, 44), MAT_RAIL);
    midRail.position.set(x, 0.65, -12); scene.add(midRail);
    for (let z = -1; z >= -33; z -= 2.8) {
      const post = new THREE.Mesh(mkBox(0.1, 1.3, 0.1), MAT_RAIL);
      post.position.set(x, 0.62, z); scene.add(post);
    }
  });
  [-7, -23].forEach(z => {
    [-1, 1].forEach(s => {
      const tower = new THREE.Mesh(mkBox(0.6, 9, 0.6), MAT_PILLAR);
      tower.position.set(s * 6, -3.9, z); scene.add(tower);
    });
    const xBeam = new THREE.Mesh(mkBox(13, 0.4, 0.55), MAT_PILLAR);
    xBeam.position.set(0, -0.2, z); scene.add(xBeam);
  });
  [-6, -15, -24].forEach(z => {
    const joint = new THREE.Mesh(mkBox(ROAD_W, 0.02, 0.14), mkMat(0x060c18));
    joint.position.set(0, 0.13, z); scene.add(joint);
  });
  const void_ = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mkMat(0x05101e));
  void_.rotation.x = -Math.PI / 2; void_.position.y = -6.5; scene.add(void_);
}

/* ── CURVE — builds the entire curved road geometry ── */
function buildCurve(scene) {
  let px = 0, pz = 0, angle = 0;
  for (let i = 0; i < CURVE_SEGS; i++) {
    const rot = Math.PI - angle;
    const rx  = Math.cos(angle), rz = Math.sin(angle);
    const cx  = px + Math.sin(angle) * CURVE_SEG_LEN / 2;
    const cz  = pz - Math.cos(angle) * CURVE_SEG_LEN / 2;

    const seg = new THREE.Mesh(mkBox(ROAD_W + 0.3, 0.12, CURVE_SEG_LEN + 0.2), MAT_ROAD);
    seg.position.set(cx, 0, cz); seg.rotation.y = rot; scene.add(seg);

    [-1, 1].forEach(s => {
      const sh = new THREE.Mesh(mkBox(2.8, 0.1, CURVE_SEG_LEN + 0.2), MAT_SHOULDER);
      sh.position.set(cx + s * (ROAD_W / 2 + 1.4) * rx, 0.005, cz + s * (ROAD_W / 2 + 1.4) * rz);
      sh.rotation.y = rot; scene.add(sh);

      const e = new THREE.Mesh(mkBox(0.12, 0.015, CURVE_SEG_LEN + 0.2), MAT_LANE);
      e.position.set(cx + s * (ROAD_W / 2) * rx, 0.077, cz + s * (ROAD_W / 2) * rz);
      e.rotation.y = rot; scene.add(e);
    });

    [-2.5, 0, 2.5].forEach(lx => {
      const d = new THREE.Mesh(mkBox(0.1, 0.015, CURVE_SEG_LEN - 1.8), MAT_LANE);
      d.position.set(cx + lx * rx, 0.077, cz + lx * rz); d.rotation.y = rot; scene.add(d);
    });

    // outer guardrail (right = outside of curve)
    const gr = new THREE.Mesh(mkBox(0.16, 0.55, CURVE_SEG_LEN + 0.2), MAT_RAIL);
    gr.position.set(cx + (ROAD_W / 2 + 0.45) * rx, 0.32, cz + (ROAD_W / 2 + 0.45) * rz);
    gr.rotation.y = rot; scene.add(gr);

    // chevron delineator post
    const chX = cx + (ROAD_W / 2 + 1.25) * rx, chZ = cz + (ROAD_W / 2 + 1.25) * rz;
    const post = new THREE.Mesh(mkBox(0.22, 1.4, 0.22), MAT_CHEVRON);
    post.position.set(chX, 0.72, chZ); scene.add(post);
    const band = new THREE.Mesh(mkBox(0.26, 0.25, 0.26), MAT_BARRIER);
    band.position.set(chX, 1.12, chZ); scene.add(band);

    // inner curb (left = inside of curve)
    const curb = new THREE.Mesh(mkBox(0.32, 0.26, CURVE_SEG_LEN + 0.2), mkMat(0x4a5a68));
    curb.position.set(cx - (ROAD_W / 2 + 0.5) * rx, 0.14, cz - (ROAD_W / 2 + 0.5) * rz);
    curb.rotation.y = rot; scene.add(curb);

    px += Math.sin(angle) * CURVE_SEG_LEN;
    pz -= Math.cos(angle) * CURVE_SEG_LEN;
    angle += CURVE_ANGLE_STEP;
  }

  const hill = new THREE.Mesh(mkBox(8, 4, 50), mkMat(0x0c2810));
  hill.position.set(-14, 1.8, -15); scene.add(hill);
  const hillFace = new THREE.Mesh(mkBox(0.4, 4, 50), mkMat(0x183a20));
  hillFace.position.set(-9.5, 1.8, -15); scene.add(hillFace);

  [{ z: -3, x: 8.5 }, { z: -14, x: 10.5 }].forEach(({ z, x }) => {
    const wp = new THREE.Mesh(mkBox(0.09, 2.1, 0.09), mkMat(0x888888));
    wp.position.set(x, 1.05, z); scene.add(wp);
    const ws = new THREE.Mesh(mkBox(0.8, 0.8, 0.07), MAT_SIGN_Y);
    ws.position.set(x, 2.3, z); ws.rotation.y = Math.PI / 4; scene.add(ws);
  });
}

/* ── IC ── */
function buildIC(scene) {
  const gBar = new THREE.Mesh(mkBox(ROAD_W + 3, 0.24, 0.32), mkMat(0x304050));
  gBar.position.set(0, 5.2, -5.5); scene.add(gBar);
  [-1, 1].forEach(s => {
    const gLeg = new THREE.Mesh(mkBox(0.24, 5.4, 0.32), mkMat(0x304050));
    gLeg.position.set(s * (ROAD_W / 2 + 1.2), 2.7, -5.5); scene.add(gLeg);
  });
  const sign = new THREE.Mesh(mkBox(3.2, 1.0, 0.18), MAT_SIGN_G);
  sign.position.set(3.6, 4.72, -5.35); scene.add(sign);
  const ramp = new THREE.Mesh(mkBox(4.0, 0.12, 22), mkMat(0x1c2d4a));
  ramp.rotation.y = -0.36; ramp.position.set(9.5, 0, -15); scene.add(ramp);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(mkBox(0.55, 0.85, 0.55), i % 2 === 0 ? mkMat(0xffcc00) : mkMat(0x111111));
    b.position.set(5.5 + i * 0.6, 0.44, -7.5); scene.add(b);
  }
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(mkBox(0.13, 0.5, 3.5), MAT_RAIL);
    r.rotation.y = -0.36; r.position.set(8.0 + i * 0.45, 0.3, -10 - i * 2.8); scene.add(r);
  }
  for (let z = -3; z >= -11; z -= 3.5) {
    const chev = new THREE.Mesh(mkBox(2.2, 0.013, 0.55), MAT_CHEVRON);
    chev.position.set(3.75, 0.077, z); chev.rotation.y = 0.32; scene.add(chev);
  }
}

/* ── MERGE ── */
function buildMerge(scene) {
  for (let i = 0; i < 11; i++) {
    const x = 5.2 - (i / 10) * 2.0, z = -3 - i * 2.4;
    const bar = new THREE.Mesh(mkBox(0.45, 0.9, 1.2), MAT_BARRIER);
    bar.position.set(x, 0.46, z); scene.add(bar);
    if (i % 2 === 0) {
      const stripe = new THREE.Mesh(mkBox(0.48, 0.18, 1.22), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      stripe.position.set(x, 0.62, z); scene.add(stripe);
    }
  }
  for (let z = -1.5; z >= -22; z -= 3.2) {
    const base = new THREE.Mesh(mkBox(0.38, 0.05, 0.38), mkMat(0x1a1a1a));
    base.position.set(3.75, 0.03, z); scene.add(base);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.75, 6), MAT_CONE);
    cone.position.set(3.75, 0.42, z); scene.add(cone);
    const stripe = new THREE.Mesh(mkBox(0.4, 0.12, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.set(3.75, 0.6, z); scene.add(stripe);
  }
  const arrow = new THREE.Mesh(mkBox(2.8, 0.013, 0.75), MAT_CHEVRON);
  arrow.position.set(1.25, 0.077, -9); arrow.rotation.y = -0.42; scene.add(arrow);
}

/* ── ENVIRONMENT ── */
function buildEnvironment(scene, id) {
  if (id === 'tunnel') {
    const floor = new THREE.Mesh(mkBox(30, 0.1, 44), mkMat(0x040810));
    floor.position.set(0, -0.1, -12); scene.add(floor); return;
  }
  if (id === 'bridge') return;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), MAT_GRASS);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.09; scene.add(ground);
  if (id === 'highway') {
    [[-13,-18],[-15,-26],[-14,-33],[13,-15],[15,-24],[14,-32]].forEach(([x, z]) => {
      const trunk = new THREE.Mesh(mkBox(0.45, 2.8, 0.45), mkMat(0x18100a));
      trunk.position.set(x, 1.4, z); scene.add(trunk);
      const top = new THREE.Mesh(mkBox(2.8, 4.0, 2.8), mkMat(0x082010));
      top.position.set(x, 4.5, z); scene.add(top);
    });
  }
}

/* ── CARS ── */
function buildCars(scene, id, statusColor) {
  const cars = [];

  // EGO car
  const egoMat = new THREE.MeshLambertMaterial({ color: 0xf97316, emissive: 0x301000 });
  const ego    = new THREE.Mesh(mkBox(1.5, 0.62, 2.7), egoMat);

  if (id === 'curve') {
    // place ego on the arc at theta=0.05 (just entered curve)
    const egoTheta = 0.05;
    const lx = LANE_XS[1];
    ego.position.set(
      CURVE_ARC_R * (1 - Math.cos(egoTheta)) + lx * Math.cos(egoTheta),
      0.38,
      (lx - CURVE_ARC_R) * Math.sin(egoTheta)
    );
    ego.rotation.y = Math.PI - egoTheta;
  } else {
    ego.position.set(LANE_XS[1], 0.38, -1);
  }
  scene.add(ego);
  const roof = new THREE.Mesh(mkBox(1.05, 0.08, 1.25), new THREE.MeshBasicMaterial({ color: 0xff9f43 }));
  roof.position.y = 0.37; ego.add(roof);
  cars.push({ mesh: ego, isEgo: true });

  // NPC definitions — EGO is in lane 1, never place NPCs there
  let npcDefs;
  if (id === 'merge') {
    npcDefs = [
      { laneIdx: 0, z: -6,  spd: LANE_SPD[0] },
      { laneIdx: 2, z: -9,  spd: LANE_SPD[2] },
      { laneIdx: 0, z: -20, spd: LANE_SPD[0] },
      { laneIdx: 2, z: -26, spd: LANE_SPD[2] },
    ];
  } else if (id === 'ic') {
    npcDefs = [
      { laneIdx: 0, z: -6,  spd: LANE_SPD[0] },
      { laneIdx: 2, z: -10, spd: LANE_SPD[2] },
      { laneIdx: 3, z: -5,  spd: LANE_SPD[3], ramp: true },
      { laneIdx: 0, z: -20, spd: LANE_SPD[0] },
      { laneIdx: 2, z: -26, spd: LANE_SPD[2] },
    ];
  } else if (id === 'curve') {
    // positions are arc angles (theta), placed visibly along the curve
    npcDefs = [
      { laneIdx: 0, theta: 0.18, spd: LANE_SPD[0] },
      { laneIdx: 2, theta: 0.45, spd: LANE_SPD[2] },
      { laneIdx: 3, theta: 0.20, spd: LANE_SPD[3] },
      { laneIdx: 0, theta: 0.80, spd: LANE_SPD[0] },
      { laneIdx: 2, theta: 1.05, spd: LANE_SPD[2] },
    ];
  } else {
    npcDefs = [
      { laneIdx: 0, z: -5,  spd: LANE_SPD[0] },
      { laneIdx: 0, z: -19, spd: LANE_SPD[0] },
      { laneIdx: 2, z: -8,  spd: LANE_SPD[2] },
      { laneIdx: 2, z: -23, spd: LANE_SPD[2] },
      { laneIdx: 3, z: -4,  spd: LANE_SPD[3] },
      { laneIdx: 3, z: -21, spd: LANE_SPD[3] },
    ];
  }

  npcDefs.forEach((def, i) => {
    const lx     = LANE_XS[def.laneIdx];
    const mat    = new THREE.MeshLambertMaterial({ color: statusColor, emissive: 0x080808 });
    const isTruck = i % 4 === 0;
    const h      = isTruck ? 1.0 : 0.58;
    const len    = isTruck ? 3.5 : 2.3;
    const npc    = new THREE.Mesh(mkBox(1.4, h, len), mat);

    if (id === 'curve') {
      // place on arc using theta
      const theta = def.theta;
      npc.position.set(
        CURVE_ARC_R * (1 - Math.cos(theta)) + lx * Math.cos(theta),
        h / 2 + 0.07,
        (lx - CURVE_ARC_R) * Math.sin(theta)
      );
      npc.rotation.y = Math.PI - theta;
    } else {
      npc.position.set(lx, h / 2 + 0.07, def.z);
      if (def.ramp) npc.rotation.y = -0.36;
    }
    scene.add(npc);

    // headlights
    [-0.44, 0.44].forEach(hx => {
      const hl = new THREE.Mesh(mkBox(0.2, 0.14, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(hx, -0.06, len / 2 + 0.02); npc.add(hl);
    });
    // tail lights
    const tail = new THREE.Mesh(mkBox(1.05, 0.12, 0.04), new THREE.MeshBasicMaterial({ color: 0xff2200 }));
    tail.position.set(0, -0.12, -(len / 2 + 0.02)); npc.add(tail);

    cars.push({
      mesh: npc, isEgo: false, laneX: lx, speed: def.spd, mat,
      ramp: !!def.ramp,
      curveAngle: def.theta !== undefined ? def.theta : undefined,
    });
  });

  return cars;
}

/* ── PIEZO SENSORS (압전 센서) ── */
function buildPiezoSensors(scene, id, statusColor) {
  if (id === 'highway') return []; // highway: thermal only

  const sensors = [];
  // Sensor stations every ~7 units; skip lane 3 for merge
  const sensZ = [-6, -13, -20];

  LANE_XS.forEach((lx, li) => {
    if (id === 'merge' && li === 3) return;
    sensZ.forEach((z, zi) => {
      // Sensor housing pad
      const housing = new THREE.Mesh(mkBox(0.55, 0.013, 0.55), mkMat(0x253545));
      housing.position.set(lx, 0.063, z); scene.add(housing);

      // Glow indicator (PlaneGeometry on road surface)
      const glowMat = new THREE.MeshBasicMaterial({
        color: statusColor, transparent: true, opacity: 0.08, side: THREE.DoubleSide
      });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(lx, 0.068, z); scene.add(glow);

      // Vertical data pulse beam (rises when car triggers sensor)
      const pulseMat = new THREE.MeshBasicMaterial({
        color: statusColor, transparent: true, opacity: 0
      });
      const pulse = new THREE.Mesh(mkBox(0.08, 0.8, 0.08), pulseMat);
      pulse.position.set(lx, 0.45, z); scene.add(pulse);

      sensors.push({
        glowMat, pulseMat, pulseMesh: pulse,
        laneX: lx, z,
        phase: li * 0.35 + zi * 0.65
      });
    });
  });
  return sensors;
}

/* ── THERMAL CAMERAS (열화상 카메라) ── */
function buildThermalCameras(scene, id) {
  const thermals = [];

  // camera station z positions (12-unit spacing)
  const camZs = [-8, -22];
  // tunnel mounts on ceiling; others on right shoulder pole
  const onCeiling = id === 'tunnel';
  const camX = onCeiling ? 4.2 : ROAD_W / 2 + 2.0;
  const camY = onCeiling ? 3.6 : 5.8;

  camZs.forEach((z, i) => {
    if (!onCeiling) {
      // Pole
      const pole = new THREE.Mesh(mkBox(0.12, camY, 0.12), mkMat(0x607080));
      pole.position.set(camX, camY / 2, z); scene.add(pole);
    }

    // Camera head
    const camMat = new THREE.MeshLambertMaterial({ color: 0x1a2530, emissive: 0x000000 });
    const camBox = new THREE.Mesh(mkBox(0.45, 0.28, 0.62), camMat);
    camBox.position.set(camX - (onCeiling ? 0 : 0.18), camY, z);
    camBox.rotation.y = onCeiling ? 0 : -0.5;
    scene.add(camBox);

    // Lens
    const lens = new THREE.Mesh(mkBox(0.1, 0.1, 0.04), mkMat(0x2255aa));
    lens.position.set(camX - (onCeiling ? 0 : 0.42), camY, z); scene.add(lens);

    // Detection field — wide semi-transparent plane across road at road level
    const fanMat = new THREE.MeshBasicMaterial({
      color: 0xff7700, transparent: true, opacity: 0.07, side: THREE.DoubleSide
    });
    const fan = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 1, 4.5), fanMat);
    fan.rotation.x = -Math.PI / 2;
    fan.position.set(0, 0.14, z); scene.add(fan);

    // Thin connecting beam camera → road
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff8800, transparent: true, opacity: 0.12
    });
    const beam = new THREE.Mesh(mkBox(0.04, camY, 0.04), beamMat);
    beam.position.set(camX - 0.18, camY / 2, z); scene.add(beam);

    thermals.push({ camMat, fanMat, beamMat, z, phase: i * 0.6 });
  });
  return thermals;
}

/* ── WEATHER PARTICLES ── */
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

/* ── SCENE CONFIG ── */
const SCENE_CFG = {
  highway: { bg: 0x060d1a, fogClr: 0x060d1a, fogN: 32, fogF: 56, cam: [0,   7, 13], look: [0,   0.5,  -8] },
  tunnel:  { bg: 0x1e2530, fogClr: 0x1e2530, fogN: 14, fogF: 38, cam: [0, 3.5,  8], look: [0,   1.5, -12] },
  curve:   { bg: 0x060d1a, fogClr: 0x060d1a, fogN: 30, fogF: 56, cam:[-7,   8, 10], look: [6,   0,   -20] },
  bridge:  { bg: 0x07121f, fogClr: 0x07121f, fogN: 36, fogF: 64, cam: [0,   9, 13], look: [0,  -0.5,  -8] },
  ic:      { bg: 0x060d1a, fogClr: 0x060d1a, fogN: 30, fogF: 56, cam:[-3,   7, 13], look: [3,   0.5,  -8] },
  merge:   { bg: 0x060d1a, fogClr: 0x060d1a, fogN: 28, fogF: 52, cam: [2,   7, 13], look: [2,   0.5,  -8] },
};

/* ── INIT ONE SCENE ── */
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

  const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 80);
  camera.position.set(...cfg.cam);
  camera.lookAt(...cfg.look);

  if (sec.id === 'tunnel') {
    scene.add(new THREE.AmbientLight(0x8899aa, 2.4));
    const tDir = new THREE.DirectionalLight(0xaabbcc, 0.8);
    tDir.position.set(0, 8, 4); scene.add(tDir);
  } else if (sec.id === 'bridge') {
    scene.add(new THREE.AmbientLight(0x1a3060, 2.0));
    const sun = new THREE.DirectionalLight(0x5588bb, 1.3);
    sun.position.set(8, 16, 6); scene.add(sun);
  } else {
    scene.add(new THREE.AmbientLight(0x1a2f50, 2.2));
    const dir = new THREE.DirectionalLight(0x4488cc, 1.0);
    dir.position.set(4, 10, 6); scene.add(dir);
  }

  const egoLight = new THREE.PointLight(0xf97316, 0.8, 9);
  egoLight.position.set(LANE_XS[1], 2, -1); scene.add(egoLight);

  buildEnvironment(scene, sec.id);

  let dashes = [];
  if (sec.id === 'curve') {
    buildCurve(scene);
  } else {
    buildRoadSurface(scene, sec.id);
    dashes = buildLaneMarkings(scene, sec.id);
    if (sec.id === 'tunnel') buildTunnel(scene);
    if (sec.id === 'bridge') buildBridge(scene);
    if (sec.id === 'ic')     buildIC(scene);
    if (sec.id === 'merge')  buildMerge(scene);
  }

  const st          = calcStatus(sec, speed, weather);
  const statusColor = CLR_NUM[st];
  const cars        = buildCars(scene, sec.id, statusColor);
  const sensors     = buildPiezoSensors(scene, sec.id, statusColor);
  const thermals    = buildThermalCameras(scene, sec.id);
  const particles   = buildParticles(scene);

  simScenes[sec.id] = { renderer, scene, camera, cars, sensors, thermals, particles, dashes, egoLight, sec, st };
}

/* ── UPDATE STATUS COLORS ── */
function updateSimStatus(sim, st) {
  sim.st = st;
  const col = CLR_NUM[st];
  sim.cars.forEach(car => { if (!car.isEgo && car.mat) car.mat.color.setHex(col); });
  sim.sensors.forEach(s => { s.glowMat.color.setHex(col); s.pulseMat.color.setHex(col); });
}

/* ── PER-FRAME UPDATE ── */
function animateSim(sim, ts, dt) {
  const wx     = WEATHER[weather];
  const carSpd = (speed / 100) * (1 - wx.decel) * 0.055 * 60 * dt;

  // ── car movement
  sim.cars.forEach(car => {
    if (car.isEgo) return;

    if (car.curveAngle !== undefined) {
      // arc-based movement for curve scene
      const dTheta = (carSpd * car.speed) / CURVE_ARC_R;
      car.curveAngle += dTheta;
      if (car.curveAngle > 1.65) car.curveAngle -= 1.45; // loop back near start
      const theta = car.curveAngle;
      const lx    = car.laneX;
      car.mesh.position.x = CURVE_ARC_R * (1 - Math.cos(theta)) + lx * Math.cos(theta);
      car.mesh.position.z = (lx - CURVE_ARC_R) * Math.sin(theta);
      car.mesh.rotation.y = Math.PI - theta;
    } else if (car.ramp) {
      car.mesh.position.z += carSpd * car.speed;
      car.mesh.position.x += carSpd * car.speed * 0.38;
      if (car.mesh.position.z > 7) car.mesh.position.set(LANE_XS[3], car.mesh.position.y, -6);
    } else {
      car.mesh.position.z += carSpd * car.speed;
      if (car.mesh.position.z > 9) car.mesh.position.z = -30;
    }
  });

  // ── lane dash scrolling (straight scenes only)
  sim.dashes.forEach(m => {
    m.position.z += carSpd;
    if (m.position.z > 13) m.position.z -= 50;
  });

  // ── piezo sensor animation
  sim.sensors.forEach(s => {
    let carNear = false;
    sim.cars.forEach(car => {
      if (Math.abs(car.mesh.position.x - s.laneX) < 1.6 &&
          Math.abs(car.mesh.position.z - s.z)     < 2.8) carNear = true;
    });
    const baseOp   = 0.05 + 0.04 * Math.sin(ts * 2.5 + s.phase * 5);
    const targetOp = carNear ? 0.88 : baseOp;
    s.glowMat.opacity += (targetOp - s.glowMat.opacity) * 0.18;
    s.pulseMat.opacity = carNear ? 0.72 + 0.28 * Math.sin(ts * 9 + s.phase) : 0;
    if (s.pulseMesh) {
      s.pulseMesh.scale.y = carNear ? 1 + 0.5 * Math.abs(Math.sin(ts * 6 + s.phase)) : 0.05;
    }
  });

  // ── thermal camera animation
  sim.thermals.forEach(tc => {
    let vehicleInZone = false;
    sim.cars.forEach(car => {
      if (Math.abs(car.mesh.position.z - tc.z) < 5.5) vehicleInZone = true;
    });
    const baseOp        = 0.05 + 0.02 * Math.sin(ts * 1.5 + tc.phase * 3);
    tc.fanMat.opacity   = vehicleInZone ? 0.18 + 0.05 * Math.sin(ts * 4) : baseOp;
    tc.beamMat.opacity  = vehicleInZone ? 0.28 : 0.07;
    tc.camMat.emissive.setHex(vehicleInZone ? CLR_NUM[sim.st] : 0x000000);
    tc.camMat.emissiveIntensity = vehicleInZone ? 0.45 + 0.2 * Math.sin(ts * 5) : 0;
  });

  // ── weather particles (unchanged)
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

/* ── RENDER LOOP ── */
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
      <div class="algo-card"><div class="ac-icon">🌧️</div><div class="ac-name">비</div><div class="ac-decel">20% 감속</div><div class="ac-desc">일반 강우 / 가시거리 100m 이상. 노면 마찰력 저하로 제동거리 증가.</div><div class="ac-signal warn">RIM: 감속 20% 권고</div><div class="ac-law">시행규칙 제19조 2항</div></div>
      <div class="algo-card"><div class="ac-icon">❄️</div><div class="ac-name">눈·폭우</div><div class="ac-decel">50% 감속</div><div class="ac-desc">적설 20mm 이상 또는 가시거리 100m 이하. 노면 결빙으로 제동 불능 위험.</div><div class="ac-signal bad">RIM: 감속 50% 긴급 명령</div><div class="ac-law">시행규칙 제19조 2항</div></div>
      <div class="algo-card"><div class="ac-icon">🌫️</div><div class="ac-name">안개</div><div class="ac-decel">50% 감속</div><div class="ac-desc">가시거리 100m 이하 / 짙은 안개. 돌발상황 대응 불가, 연쇄추돌 위험.</div><div class="ac-signal bad">RIM: 즉시 50% 감속 명령</div><div class="ac-law">시행규칙 제19조 2항</div></div>
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

/* ── EVENT LISTENERS ── */
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

/* ── BOOT ── */
SECTIONS.forEach(initScene);
updateSliderTrack();
updateHUD();
requestAnimationFrame(renderLoop);
