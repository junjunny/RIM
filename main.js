import * as THREE from 'three';

/* ── DATA ─────────────────────────────────── */
const SECTIONS = [
  { id:'highway', name:'일반 고속도로', icon:'🛣️', speedLimit:100 },
  { id:'tunnel',  name:'터널 진출입',   icon:'🚇', speedLimit:100 },
  { id:'curve',   name:'급커브 구간',   icon:'↩️', speedLimit:50  },
  { id:'bridge',  name:'교량·고가도로', icon:'🌉', speedLimit:100 },
  { id:'ic',      name:'IC·JC 연결로', icon:'🔀', speedLimit:60  },
  { id:'merge',   name:'병목·합류구간', icon:'🚦', speedLimit:80  }
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
const CLR_CSS = { good:'#22c55e', caution:'#f97316', danger:'#ef4444' };

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
    const overRec = speed > sec.speedLimit * (1 - WEATHER[weather].decel);
    sigEl.textContent = overRec ? w.signal : '';
    sigEl.className = 'hud-signal ' + (overRec ? st : '');
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

const CURVE_SEG_LEN   = 5.5;
const CURVE_ANGLE_STP = 0.18;
const CURVE_SEGS      = 10;
const CURVE_ARC_R     = CURVE_SEG_LEN / CURVE_ANGLE_STP;

/* 1차선 가장 빠름, 4차선 가장 느림 */
const LANE_SPD = [1.12, 1.00, 0.78, 0.60];

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

/* ── road surface ── */
function buildRoadSurface(scene, id) {
  const mat = id === 'bridge' ? MAT_ROAD_B : id === 'tunnel' ? MAT_ROAD_T : MAT_ROAD;
  const road = new THREE.Mesh(mkBox(ROAD_W, 0.12, 60), mat);
  road.position.set(0, 0, -20); scene.add(road);
  [-1, 1].forEach(s => {
    const sh = new THREE.Mesh(mkBox(2.8, 0.1, 60), MAT_SHOULDER);
    sh.position.set(s * (ROAD_W / 2 + 1.4), 0.005, -20); scene.add(sh);
  });
}

/* ── lane markings ── */
function buildLaneMarkings(scene, id) {
  const dashes  = [];
  const dashGeo = mkBox(0.1, 0.015, 2.2);
  [-2.5, 0, 2.5].forEach(x => {
    const mat = (id === 'merge' && x === 2.5) ? mkMat(0xf97316) : MAT_LANE;
    for (let z = -50; z < 14; z += 5) {
      const m = new THREE.Mesh(dashGeo, mat);
      m.position.set(x, 0.075, z); scene.add(m); dashes.push(m);
    }
  });
  [-5, 5].forEach(x => {
    const e = new THREE.Mesh(mkBox(0.12, 0.015, 60), MAT_LANE);
    e.position.set(x, 0.075, -20); scene.add(e);
  });
  return dashes;
}

/* ── TUNNEL ── */
function buildTunnel(scene) {
  [-1, 1].forEach(s => {
    const wall = new THREE.Mesh(mkBox(0.5, 4.5, 56), MAT_TUNNEL);
    wall.position.set(s * (ROAD_W / 2 + 0.95), 2.1, -20); scene.add(wall);
    for (let z = -4; z >= -44; z -= 3.8) {
      const tile = new THREE.Mesh(mkBox(0.05, 0.07, 3.3), new THREE.MeshBasicMaterial({ color: 0x6a7888 }));
      tile.position.set(s * (ROAD_W / 2 + 0.68), 1.6, z); scene.add(tile);
    }
  });
  const ceil = new THREE.Mesh(mkBox(ROAD_W + 2.4, 0.55, 56), MAT_TUNNEL);
  ceil.position.set(0, 4.27, -20); scene.add(ceil);
  const fTop = new THREE.Mesh(mkBox(ROAD_W + 3.5, 0.9, 0.5), mkMat(0x4a5460));
  fTop.position.set(0, 4.7, -0.8); scene.add(fTop);
  [-1, 1].forEach(s => {
    const fp = new THREE.Mesh(mkBox(0.55, 4.7, 0.5), mkMat(0x4a5460));
    fp.position.set(s * (ROAD_W / 2 + 1.2), 2.35, -0.8); scene.add(fp);
  });
  for (let z = -5; z >= -42; z -= 4.5) {
    const strip = new THREE.Mesh(mkBox(0.22, 0.06, 1.1), new THREE.MeshBasicMaterial({ color: 0xbbd8ff }));
    strip.position.set(0, 3.96, z); scene.add(strip);
    const l = new THREE.PointLight(0x7799cc, 1.1, 9);
    l.position.set(0, 3.8, z); scene.add(l);
  }
}

/* ── BRIDGE ── cable-stayed, visible towers + stay cables + sea below */
function buildBridge(scene) {
  /* guardrails with posts */
  [-1, 1].forEach(s => {
    const x = s * (ROAD_W / 2 + 0.28);
    const topR = new THREE.Mesh(mkBox(0.13, 0.15, 60), MAT_RAIL);
    topR.position.set(x, 1.35, -20); scene.add(topR);
    const botR = new THREE.Mesh(mkBox(0.08, 0.08, 60), MAT_RAIL);
    botR.position.set(x, 0.68, -20); scene.add(botR);
    for (let z = -1; z >= -46; z -= 2.0) {
      const post = new THREE.Mesh(mkBox(0.09, 1.4, 0.09), MAT_RAIL);
      post.position.set(x, 0.68, z); scene.add(post);
    }
  });

  /* cable-stayed pylons at z=-10 and z=-34 */
  [
    { pz: -10, deckZs: [4, 0, -4, -8, -14, -20, -27] },
    { pz: -34, deckZs: [-28, -22, -16, -34, -40, -46, -52] }
  ].forEach(({ pz, deckZs }) => {
    [-5.8, 5.8].forEach(px => {
      const shaft = new THREE.Mesh(mkBox(0.68, 18, 0.68), MAT_PILLAR);
      shaft.position.set(px, 8.0, pz); scene.add(shaft);
      const cap = new THREE.Mesh(mkBox(1.1, 0.55, 1.1), mkMat(0x162840));
      cap.position.set(px, 17.2, pz); scene.add(cap);
    });
    /* cross strut */
    const strut = new THREE.Mesh(mkBox(12.8, 0.5, 0.65), MAT_PILLAR);
    strut.position.set(0, 5.5, pz); scene.add(strut);

    /* stay cables as line segments */
    const pts = [];
    deckZs.forEach(dz => {
      [-5.8, 5.8].forEach(px => {
        pts.push(px, 16.8, pz,  px * 0.82, 0.22, dz);
      });
    });
    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(cGeo,
      new THREE.LineBasicMaterial({ color: 0x4a7ab0, transparent: true, opacity: 0.72 })));
  });

  /* box-girder under deck */
  const girder = new THREE.Mesh(mkBox(ROAD_W + 0.9, 0.9, 62), mkMat(0x1a2e4e));
  girder.position.set(0, -0.58, -20); scene.add(girder);

  /* piers from sea to deck */
  [-10, -22, -34].forEach(z => {
    const pier = new THREE.Mesh(mkBox(1.5, 12, 1.5), mkMat(0x172540));
    pier.position.set(0, -6.5, z); scene.add(pier);
    /* pier crosshead */
    const head = new THREE.Mesh(mkBox(4.5, 0.6, 1.6), mkMat(0x1a2f50));
    head.position.set(0, 0.1, z); scene.add(head);
  });

  /* expansion joints */
  [-8, -18, -28, -38].forEach(z => {
    const j = new THREE.Mesh(mkBox(ROAD_W, 0.02, 0.16), mkMat(0x050b18));
    j.position.set(0, 0.13, z); scene.add(j);
  });

  /* sea surface */
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), mkMat(0x071828));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -13; scene.add(sea);
  const shimmer = new THREE.Mesh(new THREE.PlaneGeometry(90, 50),
    new THREE.MeshBasicMaterial({ color: 0x0e2d48, transparent: true, opacity: 0.55 }));
  shimmer.rotation.x = -Math.PI / 2; shimmer.position.set(0, -12.6, -20); scene.add(shimmer);
}

/* ── CURVE ── */
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
    const gr = new THREE.Mesh(mkBox(0.16, 0.55, CURVE_SEG_LEN + 0.2), MAT_RAIL);
    gr.position.set(cx + (ROAD_W / 2 + 0.45) * rx, 0.32, cz + (ROAD_W / 2 + 0.45) * rz);
    gr.rotation.y = rot; scene.add(gr);
    const chX = cx + (ROAD_W / 2 + 1.25) * rx, chZ = cz + (ROAD_W / 2 + 1.25) * rz;
    const post = new THREE.Mesh(mkBox(0.22, 1.4, 0.22), MAT_CHEVRON);
    post.position.set(chX, 0.72, chZ); scene.add(post);
    const band = new THREE.Mesh(mkBox(0.26, 0.25, 0.26), MAT_BARRIER);
    band.position.set(chX, 1.12, chZ); scene.add(band);
    const curb = new THREE.Mesh(mkBox(0.32, 0.26, CURVE_SEG_LEN + 0.2), mkMat(0x4a5a68));
    curb.position.set(cx - (ROAD_W / 2 + 0.5) * rx, 0.14, cz - (ROAD_W / 2 + 0.5) * rz);
    curb.rotation.y = rot; scene.add(curb);
    px += Math.sin(angle) * CURVE_SEG_LEN;
    pz -= Math.cos(angle) * CURVE_SEG_LEN;
    angle += CURVE_ANGLE_STP;
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

/* ── IC ── fork: main road + ramp clearly splitting off right */
function buildIC(scene) {
  /* overhead gantry frame */
  const gBar = new THREE.Mesh(mkBox(ROAD_W + 3.5, 0.24, 0.32), mkMat(0x304050));
  gBar.position.set(0, 5.3, -5.5); scene.add(gBar);
  [-1, 1].forEach(s => {
    const gLeg = new THREE.Mesh(mkBox(0.24, 5.5, 0.32), mkMat(0x304050));
    gLeg.position.set(s * (ROAD_W / 2 + 1.3), 2.75, -5.5); scene.add(gLeg);
  });

  /* green exit sign (right) */
  const exitSign = new THREE.Mesh(mkBox(3.6, 1.1, 0.2), MAT_SIGN_G);
  exitSign.position.set(3.0, 4.75, -5.35); scene.add(exitSign);
  /* diagonal arrow → exit */
  const ea1 = new THREE.Mesh(mkBox(1.0, 0.17, 0.06), mkMat(0xffffff));
  ea1.position.set(0.4, 0.08, 0.14); exitSign.add(ea1);
  const ea2 = new THREE.Mesh(mkBox(0.55, 0.17, 0.06), mkMat(0xffffff));
  ea2.rotation.z = -0.55; ea2.position.set(1.1, -0.2, 0.14); exitSign.add(ea2);

  /* green straight sign (left — 직진) */
  const mainSign = new THREE.Mesh(mkBox(2.8, 1.1, 0.2), MAT_SIGN_G);
  mainSign.position.set(-2.2, 4.75, -5.35); scene.add(mainSign);
  const ma = new THREE.Mesh(mkBox(0.17, 0.85, 0.06), mkMat(0xffffff));
  ma.position.set(0, 0.05, 0.14); mainSign.add(ma);
  const mah = new THREE.Mesh(mkBox(0.6, 0.17, 0.06), mkMat(0xffffff));
  mah.position.set(0, 0.52, 0.14); mainSign.add(mah);

  /* gore nose — yellow hatch where split begins */
  for (let i = 0; i < 9; i++) {
    const chev = new THREE.Mesh(mkBox(2.9, 0.013, 0.4),
      i % 2 === 0 ? MAT_CHEVRON : new THREE.MeshBasicMaterial({ color: 0x222222 }));
    chev.position.set(4.7, 0.077, -7.5 - i * 0.52);
    chev.rotation.y = 0.42; scene.add(chev);
  }

  /* bollards at split point */
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const b = new THREE.Mesh(mkBox(0.22, 0.95, 0.22),
      i % 2 === 0 ? mkMat(0xffcc00) : mkMat(0x111111));
    b.position.set(5.3 - t * 0.5, 0.48, -7.2 - i * 1.3); scene.add(b);
  }

  /* ramp surface — wide, clearly angled */
  const ramp = new THREE.Mesh(mkBox(5.2, 0.12, 30), mkMat(0x1c2d4a));
  ramp.rotation.y = -0.42; ramp.position.set(11.5, 0, -17); scene.add(ramp);
  /* ramp shoulder */
  const rampSh = new THREE.Mesh(mkBox(1.5, 0.1, 30), mkMat(0x0f1e30));
  rampSh.rotation.y = -0.42; rampSh.position.set(14.6, 0.005, -17); scene.add(rampSh);
  /* ramp left edge line */
  const rampEdge = new THREE.Mesh(mkBox(0.12, 0.015, 30), MAT_LANE);
  rampEdge.rotation.y = -0.42; rampEdge.position.set(9.0, 0.078, -17); scene.add(rampEdge);

  /* ramp lane centre dashes */
  for (let i = 0; i < 7; i++) {
    const dash = new THREE.Mesh(mkBox(0.1, 0.015, 2.2), MAT_LANE);
    dash.rotation.y = -0.42;
    dash.position.set(9.5 + i * 1.65, 0.078, -8 - i * 3.8); scene.add(dash);
  }

  /* ramp guardrail */
  const rRail = new THREE.Mesh(mkBox(0.11, 0.13, 30), MAT_RAIL);
  rRail.rotation.y = -0.42; rRail.position.set(14.3, 0.72, -18); scene.add(rRail);
  for (let i = 0; i < 9; i++) {
    const rp = new THREE.Mesh(mkBox(0.09, 1.35, 0.09), MAT_RAIL);
    rp.rotation.y = -0.42; rp.position.set(14.0 + i * 0.55, 0.68, -10 - i * 2.9); scene.add(rp);
  }
}

/* ── MERGE ── funnel: right lane closes, cones + barriers diagonal, overhead VMS */
function buildMerge(scene) {
  /* overhead VMS gantry */
  [-1, 1].forEach(s => {
    const pole = new THREE.Mesh(mkBox(0.14, 5.6, 0.14), mkMat(0x607080));
    pole.position.set(s * (ROAD_W / 2 + 0.5), 2.8, -4.5); scene.add(pole);
  });
  const gBar = new THREE.Mesh(mkBox(ROAD_W + 0.7, 0.22, 0.22), mkMat(0x607080));
  gBar.position.set(0, 5.6, -4.5); scene.add(gBar);
  const vms = new THREE.Mesh(mkBox(7.0, 1.2, 0.24), MAT_SIGN_Y);
  vms.position.set(0, 5.6, -4.5); scene.add(vms);
  /* 합류 화살표 3개 on VMS */
  [-2.2, 0, 2.2].forEach(sx => {
    const stem = new THREE.Mesh(mkBox(0.15, 0.75, 0.06), mkMat(0x111111));
    stem.position.set(sx, 0, 0.15); vms.add(stem);
    const head = new THREE.Mesh(mkBox(0.65, 0.15, 0.06), mkMat(0x111111));
    head.position.set(sx, 0.48, 0.15); vms.add(head);
  });

  /* diagonal barrier wall — sweeps inward as lane closes */
  const N = 14;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const bx = 5.2 - t * 1.9;
    const bz = -3.0 - i * 2.4;
    const bar = new THREE.Mesh(mkBox(0.45, 0.9, 1.25), MAT_BARRIER);
    bar.position.set(bx, 0.46, bz); scene.add(bar);
    if (i % 2 === 0) {
      const stripe = new THREE.Mesh(mkBox(0.48, 0.18, 1.27),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      stripe.position.set(bx, 0.62, bz); scene.add(stripe);
    }
  }

  /* traffic cones — funnel row leading into barriers */
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const cx = 4.0 - t * 1.2;
    const cz = -0.5 - i * 2.8;
    const base = new THREE.Mesh(mkBox(0.36, 0.05, 0.36), mkMat(0x1a1a1a));
    base.position.set(cx, 0.03, cz); scene.add(base);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.72, 6), MAT_CONE);
    cone.position.set(cx, 0.41, cz); scene.add(cone);
    const band = new THREE.Mesh(mkBox(0.38, 0.11, 0.38),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    band.position.set(cx, 0.58, cz); scene.add(band);
  }

  /* road surface merge arrows (painted) */
  [{ z: -8, x: 2.0, r: -0.44 }, { z: -17, x: 1.5, r: -0.32 }].forEach(({ z, x, r }) => {
    const shaft = new THREE.Mesh(mkBox(3.2, 0.013, 0.72), MAT_CHEVRON);
    shaft.position.set(x, 0.077, z); shaft.rotation.y = r; scene.add(shaft);
    const tip = new THREE.Mesh(mkBox(1.3, 0.013, 0.72), MAT_CHEVRON);
    tip.position.set(x + 0.85, 0.077, z - 0.75); tip.rotation.y = r + 0.58; scene.add(tip);
  });
}

/* ── ENVIRONMENT ── */
function buildEnvironment(scene, id) {
  if (id === 'tunnel') {
    const floor = new THREE.Mesh(mkBox(30, 0.1, 60), mkMat(0x040810));
    floor.position.set(0, -0.1, -20); scene.add(floor); return;
  }
  if (id === 'bridge') return;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), MAT_GRASS);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.09; scene.add(ground);
  if (id === 'highway') {
    [[-13,-18],[-15,-26],[-14,-36],[13,-15],[15,-24],[14,-34],[-13,-44],[13,-42]].forEach(([x, z]) => {
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

  /* EGO car — 주황색, 1차선 옆 2번 차선에서 실제로 달림 */
  const egoMat = new THREE.MeshLambertMaterial({ color: 0xf97316, emissive: 0x301000 });
  const ego    = new THREE.Mesh(mkBox(1.5, 0.62, 2.7), egoMat);

  if (id === 'curve') {
    const egoTheta = 0.12;
    const lx = LANE_XS[1];
    ego.position.set(
      CURVE_ARC_R * (1 - Math.cos(egoTheta)) + lx * Math.cos(egoTheta),
      0.38, (lx - CURVE_ARC_R) * Math.sin(egoTheta)
    );
    ego.rotation.y = Math.PI - egoTheta;
  } else {
    ego.position.set(LANE_XS[1], 0.38, -4);
  }
  scene.add(ego);
  const roof = new THREE.Mesh(mkBox(1.05, 0.08, 1.25), new THREE.MeshBasicMaterial({ color: 0xff9f43 }));
  roof.position.y = 0.37; ego.add(roof);
  /* EGO 전조등 */
  [-0.44, 0.44].forEach(hx => {
    const hl = new THREE.Mesh(mkBox(0.2, 0.14, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffcc }));
    hl.position.set(hx, -0.06, 1.37); ego.add(hl);
  });
  /* EGO 후미등 */
  const egotail = new THREE.Mesh(mkBox(1.05, 0.12, 0.04), new THREE.MeshBasicMaterial({ color: 0xff3300 }));
  egotail.position.set(0, -0.12, -1.37); ego.add(egotail);
  cars.push({ mesh: ego, isEgo: true, laneX: LANE_XS[1], speed: 1.0, speedVar: 0, swayPhase: 0,
               curveAngle: id === 'curve' ? 0.12 : undefined });

  /* NPC 정의 — EGO가 있는 1번 차선(laneIdx:1)에는 배치 안 함 */
  let npcDefs;
  if (id === 'merge') {
    npcDefs = [
      { laneIdx:0, z:-8,  spd:LANE_SPD[0] }, { laneIdx:0, z:-22, spd:LANE_SPD[0] },
      { laneIdx:2, z:-5,  spd:LANE_SPD[2] }, { laneIdx:2, z:-18, spd:LANE_SPD[2] },
      { laneIdx:2, z:-34, spd:LANE_SPD[2] },
    ];
  } else if (id === 'ic') {
    npcDefs = [
      { laneIdx:0, z:-6,  spd:LANE_SPD[0] }, { laneIdx:0, z:-22, spd:LANE_SPD[0] },
      { laneIdx:2, z:-9,  spd:LANE_SPD[2] }, { laneIdx:2, z:-28, spd:LANE_SPD[2] },
      { laneIdx:3, z:-5,  spd:LANE_SPD[3], ramp:true },
    ];
  } else if (id === 'curve') {
    npcDefs = [
      { laneIdx:0, theta:0.25, spd:LANE_SPD[0] }, { laneIdx:0, theta:0.85, spd:LANE_SPD[0] },
      { laneIdx:2, theta:0.50, spd:LANE_SPD[2] }, { laneIdx:2, theta:1.10, spd:LANE_SPD[2] },
      { laneIdx:3, theta:0.30, spd:LANE_SPD[3] },
    ];
  } else {
    npcDefs = [
      { laneIdx:0, z:-5,  spd:LANE_SPD[0] }, { laneIdx:0, z:-20, spd:LANE_SPD[0] },
      { laneIdx:0, z:-36, spd:LANE_SPD[0] },
      { laneIdx:2, z:-8,  spd:LANE_SPD[2] }, { laneIdx:2, z:-25, spd:LANE_SPD[2] },
      { laneIdx:3, z:-3,  spd:LANE_SPD[3] }, { laneIdx:3, z:-18, spd:LANE_SPD[3] },
      { laneIdx:3, z:-34, spd:LANE_SPD[3] },
    ];
  }

  npcDefs.forEach((def, i) => {
    const lx     = LANE_XS[def.laneIdx];
    const mat    = new THREE.MeshLambertMaterial({ color: statusColor, emissive: 0x080808 });
    const isTruck = i % 5 === 0;
    const h = isTruck ? 1.0 : 0.58, len = isTruck ? 3.5 : 2.3;
    const npc = new THREE.Mesh(mkBox(1.4, h, len), mat);

    if (id === 'curve') {
      const theta = def.theta;
      npc.position.set(
        CURVE_ARC_R * (1 - Math.cos(theta)) + lx * Math.cos(theta),
        h / 2 + 0.07, (lx - CURVE_ARC_R) * Math.sin(theta)
      );
      npc.rotation.y = Math.PI - theta;
    } else {
      npc.position.set(lx, h / 2 + 0.07, def.z);
      if (def.ramp) npc.rotation.y = -0.36;
    }
    scene.add(npc);

    [-0.44, 0.44].forEach(hx => {
      const hl = new THREE.Mesh(mkBox(0.2, 0.14, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffcc }));
      hl.position.set(hx, -0.06, len / 2 + 0.02); npc.add(hl);
    });
    const tail = new THREE.Mesh(mkBox(1.05, 0.12, 0.04), new THREE.MeshBasicMaterial({ color: 0xff2200 }));
    tail.position.set(0, -0.12, -(len / 2 + 0.02)); npc.add(tail);

    cars.push({
      mesh: npc, isEgo: false, laneX: lx, speed: def.spd, mat,
      ramp: !!def.ramp,
      speedVar:  (Math.random() - 0.5) * 0.10,  // ±5% 개인 속도 편차
      swayPhase: Math.random() * Math.PI * 2,    // 차선 내 미세 흔들림
      curveAngle: def.theta !== undefined ? def.theta : undefined,
    });
  });

  return cars;
}

/* ════════════════════════════════════════
   V2I 압전 센서 — 직관적 디자인
   - 도로 폭 전체를 가로지르는 노란 경고 라인 3개
   - 차선별 활성화 글로우 패널
   - 노변 RSU 박스 + LED 지시등
   - 차량 감지 시 수직 데이터 빔 상승
════════════════════════════════════════ */
function buildPiezoSensors(scene, id, statusColor) {
  if (id === 'highway') return [];

  const sensors  = [];
  const stationZ = [-8, -20, -34]; // 3개소, 12~14 단위 간격

  stationZ.forEach((z, zi) => {
    /* 전체 도로 폭 노란 경고 줄 3개 */
    for (let k = 0; k < 3; k++) {
      const sz = z + (k - 1) * 0.45;
      const stripe = new THREE.Mesh(mkBox(ROAD_W, 0.014, 0.2), mkMat(0xeecc00));
      stripe.position.set(0, 0.064, sz); scene.add(stripe);
    }

    /* 노변 RSU 박스 (오른쪽 갓길) */
    const rsuBox = new THREE.Mesh(mkBox(0.5, 0.7, 0.5), mkMat(0x1e3050));
    rsuBox.position.set(ROAD_W / 2 + 1.6, 0.37, z); scene.add(rsuBox);
    /* RSU LED (평소 꺼짐, 감지 시 on) */
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x00ff44, transparent: true, opacity: 0.3 });
    const led    = new THREE.Mesh(mkBox(0.18, 0.1, 0.06), ledMat);
    led.position.set(ROAD_W / 2 + 1.6, 0.76, z); scene.add(led);

    /* 차선별 글로우 패널 + 데이터 빔 */
    const laneList = id === 'merge' ? [0, 1, 2] : [0, 1, 2, 3];
    laneList.forEach(li => {
      const lx = LANE_XS[li];

      /* 차선 활성화 글로우 (전체 차선 폭) */
      const glowMat = new THREE.MeshBasicMaterial({
        color: statusColor, transparent: true, opacity: 0.06, side: THREE.DoubleSide
      });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(lx, 0.068, z); scene.add(glow);

      /* 수직 데이터 빔 */
      const pulseMat = new THREE.MeshBasicMaterial({
        color: statusColor, transparent: true, opacity: 0
      });
      const pulse = new THREE.Mesh(mkBox(0.1, 2.0, 0.1), pulseMat);
      pulse.position.set(lx, 1.1, z);
      pulse.scale.y = 0.05; scene.add(pulse);

      sensors.push({
        glowMat, pulseMat, pulseMesh: pulse, ledMat,
        laneX: lx, z,
        phase: li * 0.4 + zi * 0.7
      });
    });
  });
  return sensors;
}

/* ════════════════════════════════════════
   V2I 열화상 카메라 — 직관적 디자인
   - 폴 + 카메라 헤드
   - 와이어프레임 감지 콘 (카메라→도로 피라미드 윤곽)
   - 반투명 스캔 필드
   - 애니메이션 스캔 라인
════════════════════════════════════════ */
function buildThermalCameras(scene, id) {
  const thermals = [];

  /* ── 커브 구간: 호 경로를 따라 카메라 위치 계산 ── */
  if (id === 'curve') {
    [{ theta: 0.22 }, { theta: 0.72 }].forEach(({ theta }, i) => {
      const outerLx = ROAD_W / 2 + 2.2;
      const poleX   = CURVE_ARC_R * (1 - Math.cos(theta)) + outerLx * Math.cos(theta);
      const poleZ   = (outerLx - CURVE_ARC_R) * Math.sin(theta);
      const rcX     = CURVE_ARC_R * (1 - Math.cos(theta));
      const rcZ     = -CURVE_ARC_R * Math.sin(theta);
      const camY    = 5.8;

      /* 도로 접선 & 안쪽 법선 */
      const tx = Math.sin(theta), tz = -Math.cos(theta);   // 접선 (전진 방향)
      const nx = -Math.cos(theta), nz = -Math.sin(theta);  // 안쪽 법선

      /* 폴 */
      const pole = new THREE.Mesh(mkBox(0.12, camY, 0.12), mkMat(0x607080));
      pole.position.set(poleX, camY / 2, poleZ); scene.add(pole);

      /* 카메라 헤드 — 도로 안쪽을 향함 */
      const camMat = new THREE.MeshLambertMaterial({ color: 0x1a2530, emissive: 0x000000 });
      const camBox = new THREE.Mesh(mkBox(0.5, 0.3, 0.7), camMat);
      camBox.position.set(poleX + nx * 0.2, camY, poleZ + nz * 0.2);
      camBox.rotation.y = Math.PI / 2 - theta;
      scene.add(camBox);

      /* 렌즈 */
      const lens = new THREE.Mesh(mkBox(0.12, 0.12, 0.04), mkMat(0x2255aa));
      lens.position.set(poleX + nx * 0.5, camY, poleZ + nz * 0.5);
      scene.add(lens);

      /* LED */
      const camLedMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 });
      const camLed    = new THREE.Mesh(mkBox(0.08, 0.08, 0.04), camLedMat);
      camLed.position.set(poleX + nx * 0.5, camY + 0.18, poleZ + nz * 0.5);
      scene.add(camLed);

      /* 와이어 감지 콘 — 도로 호에 맞춰 4 모서리 계산 */
      const zHW   = 5.5;
      const roadHW = ROAD_W / 2 + 0.5;
      const oex = CURVE_ARC_R * (1 - Math.cos(theta)) + roadHW * Math.cos(theta);
      const oez = (roadHW - CURVE_ARC_R) * Math.sin(theta);
      const iex = CURVE_ARC_R * (1 - Math.cos(theta)) - roadHW * Math.cos(theta);
      const iez = (-roadHW - CURVE_ARC_R) * Math.sin(theta);
      const chx = poleX + nx * 0.22, chz = poleZ + nz * 0.22;
      const wirePoints = [
        chx, camY, chz,   oex + tx*zHW, 0.12, oez + tz*zHW,
        chx, camY, chz,   oex - tx*zHW, 0.12, oez - tz*zHW,
        chx, camY, chz,   iex + tx*zHW, 0.12, iez + tz*zHW,
        chx, camY, chz,   iex - tx*zHW, 0.12, iez - tz*zHW,
        oex + tx*zHW, 0.12, oez + tz*zHW,   oex - tx*zHW, 0.12, oez - tz*zHW,
        oex - tx*zHW, 0.12, oez - tz*zHW,   iex - tx*zHW, 0.12, iez - tz*zHW,
        iex - tx*zHW, 0.12, iez - tz*zHW,   iex + tx*zHW, 0.12, iez + tz*zHW,
        iex + tx*zHW, 0.12, iez + tz*zHW,   oex + tx*zHW, 0.12, oez + tz*zHW,
      ];
      const wireGeo = new THREE.BufferGeometry();
      wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePoints, 3));
      const wireMat = new THREE.LineBasicMaterial({ color: 0xff7700, transparent: true, opacity: 0.35 });
      scene.add(new THREE.LineSegments(wireGeo, wireMat));

      /* 스캔 필드 — 그룹으로 도로 접선 방향에 정렬 */
      const fanGrp = new THREE.Group();
      fanGrp.position.set(rcX, 0, rcZ);
      fanGrp.rotation.y = Math.PI - theta;
      scene.add(fanGrp);

      const fanMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.05, side: THREE.DoubleSide });
      const fan    = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 1, zHW * 2), fanMat);
      fan.rotation.x = -Math.PI / 2; fan.position.set(0, 0.13, 0);
      fanGrp.add(fan);

      const scanMat = new THREE.MeshBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.55 });
      const scanBar = new THREE.Mesh(mkBox(ROAD_W + 1, 0.03, 0.12), scanMat);
      scanBar.position.set(0, 0.16, 0);
      fanGrp.add(scanBar);

      thermals.push({ camMat, camLedMat, wireMat, fanMat, scanMat, scanBar, z: rcZ, zHW, phase: i * 0.7, isCurve: true });
    });
    return thermals;
  }

  const onCeil   = id === 'tunnel';
  const camX     = onCeil ? 4.2 : ROAD_W / 2 + 2.0;
  const camY     = onCeil ? 3.6 : 5.8;
  /* 12 단위 간격 2곳 */
  const camZs    = [-6, -26];

  camZs.forEach((z, i) => {
    /* ── 폴 ── */
    if (!onCeil) {
      const pole = new THREE.Mesh(mkBox(0.12, camY, 0.12), mkMat(0x607080));
      pole.position.set(camX, camY / 2, z); scene.add(pole);
    }

    /* ── 카메라 헤드 ── */
    const camMat = new THREE.MeshLambertMaterial({ color: 0x1a2530, emissive: 0x000000 });
    const camBox = new THREE.Mesh(mkBox(0.5, 0.3, 0.7), camMat);
    camBox.position.set(camX - (onCeil ? 0 : 0.2), camY, z);
    camBox.rotation.y = onCeil ? 0 : -0.45;
    scene.add(camBox);
    /* 렌즈 */
    const lens = new THREE.Mesh(mkBox(0.12, 0.12, 0.04), mkMat(0x2255aa));
    lens.position.set(camX - (onCeil ? 0 : 0.44), camY, z); scene.add(lens);
    /* 카메라 표시등 (작은 LED) */
    const camLedMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 });
    const camLed    = new THREE.Mesh(mkBox(0.08, 0.08, 0.04), camLedMat);
    camLed.position.set(camX - (onCeil ? 0 : 0.44), camY + 0.18, z); scene.add(camLed);

    /* ── 감지 콘 — 와이어프레임 피라미드 윤곽 ── */
    const cx   = camX - 0.22; // 렌즈 기준점
    const zHW  = 5.5;         // 도로 레벨 detection half-depth
    const roadHW = ROAD_W / 2 + 0.5;
    /* 카메라 → 도로 4 모서리 선 */
    const wirePoints = [
      cx, camY, z,   -roadHW, 0.12, z - zHW,
      cx, camY, z,    roadHW, 0.12, z - zHW,
      cx, camY, z,   -roadHW, 0.12, z + zHW,
      cx, camY, z,    roadHW, 0.12, z + zHW,
      /* 도로 레벨 사각형 윤곽 */
      -roadHW, 0.12, z - zHW,  roadHW, 0.12, z - zHW,
       roadHW, 0.12, z - zHW,  roadHW, 0.12, z + zHW,
       roadHW, 0.12, z + zHW, -roadHW, 0.12, z + zHW,
      -roadHW, 0.12, z + zHW, -roadHW, 0.12, z - zHW,
    ];
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePoints, 3));
    const wireMat = new THREE.LineBasicMaterial({ color: 0xff7700, transparent: true, opacity: 0.35 });
    const wire    = new THREE.LineSegments(wireGeo, wireMat);
    scene.add(wire);

    /* ── 반투명 스캔 필드 (도로 레벨 평면) ── */
    const fanMat = new THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0.05, side: THREE.DoubleSide
    });
    const fan = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 1, zHW * 2), fanMat);
    fan.rotation.x = -Math.PI / 2;
    fan.position.set(0, 0.13, z); scene.add(fan);

    /* ── 애니메이션 스캔 라인 (가는 수평 바) ── */
    const scanMat = new THREE.MeshBasicMaterial({
      color: 0xff9900, transparent: true, opacity: 0.55
    });
    const scanBar = new THREE.Mesh(mkBox(ROAD_W + 1, 0.03, 0.12), scanMat);
    scanBar.position.set(0, 0.16, z); scene.add(scanBar);

    thermals.push({ camMat, camLedMat, wireMat, fanMat, scanMat, scanBar, z, zHW, phase: i * 0.7 });
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
    pos[i*3+2] = (Math.random() - 0.5) * 50 - 20;
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
  highway: { bg: 0x060d1a, fogClr: 0x060d1a, fogN: 36, fogF: 65, cam: [0,   7, 14], look: [0,   0.5, -10] },
  tunnel:  { bg: 0x1e2530, fogClr: 0x1e2530, fogN: 16, fogF: 42, cam: [0, 3.5,  9], look: [0,   1.5, -14] },
  curve:   { bg: 0x060d1a, fogClr: 0x060d1a, fogN: 32, fogF: 60, cam:[-7,   8, 10], look: [6,   0,   -20] },
  bridge:  { bg: 0x07121f, fogClr: 0x07121f, fogN: 38, fogF: 85, cam:[-14, 11,  2], look: [1,   3.5, -20] },
  ic:      { bg: 0x060d1a, fogClr: 0x060d1a, fogN: 34, fogF: 65, cam:[-6,   9, 12], look: [4,   0.5, -12] },
  merge:   { bg: 0x060d1a, fogClr: 0x060d1a, fogN: 30, fogF: 60, cam: [0,  10, 13], look: [2,   0,   -8] },
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

  const camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 90);
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

  const egoLight = new THREE.PointLight(0xf97316, 1.0, 10);
  egoLight.position.set(LANE_XS[1], 2, -4); scene.add(egoLight);

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

/* ── UPDATE STATUS ── */
function updateSimStatus(sim, st) {
  sim.st = st;
  const col = CLR_NUM[st];
  sim.cars.forEach(car => { if (!car.isEgo && car.mat) car.mat.color.setHex(col); });
  sim.sensors.forEach(s  => { s.glowMat.color.setHex(col); s.pulseMat.color.setHex(col); });
  sim.thermals.forEach(tc => { tc.wireMat.color.setHex(col); tc.fanMat.color.setHex(col); tc.scanMat.color.setHex(col); });
}

/* ── PER-FRAME ── */
function animateSim(sim, ts, dt) {
  const wx     = WEATHER[weather];
  const carSpd = (speed / 100) * (1 - wx.decel) * 0.055 * 60 * dt;
  const isRain = weather === 'rain';
  const isSnow = weather === 'snow';
  const isFog  = weather === 'fog';

  /* ── 모든 차량 이동 (EGO 포함) ── */
  sim.cars.forEach(car => {
    if (car.curveAngle !== undefined) {
      /* 커브 호 경로 */
      const dTheta = (carSpd * (car.isEgo ? 1.0 : car.speed + car.speedVar)) / CURVE_ARC_R;
      car.curveAngle += dTheta;
      if (car.curveAngle > 1.65) car.curveAngle -= 1.45;
      const theta = car.curveAngle;
      const lx    = car.laneX;
      car.mesh.position.x = CURVE_ARC_R * (1 - Math.cos(theta)) + lx * Math.cos(theta);
      car.mesh.position.z = (lx - CURVE_ARC_R) * Math.sin(theta);
      car.mesh.rotation.y = Math.PI - theta;
    } else if (car.ramp) {
      car.mesh.position.z += carSpd * car.speed;
      car.mesh.position.x += carSpd * car.speed * 0.38;
      if (car.mesh.position.z > 8) car.mesh.position.set(LANE_XS[3], car.mesh.position.y, -6);
    } else {
      /* 직선 구간: EGO와 NPC 모두 동일 방향 (+z) */
      const spd = car.isEgo ? carSpd : carSpd * (car.speed + car.speedVar);
      car.mesh.position.z += spd;
      /* 차선 내 미세 흔들림 (NPC만) */
      if (!car.isEgo) {
        car.mesh.position.x = car.laneX + Math.sin(ts * 0.6 + car.swayPhase) * 0.03;
      }
      /* EGO: 살짝 바디 롤 */
      if (car.isEgo) {
        car.mesh.rotation.z = Math.sin(ts * 1.2) * 0.008;
      }
      /* 리셋 (EGO와 NPC 공통) */
      if (car.mesh.position.z > 9) car.mesh.position.z = car.isEgo ? -32 : -38;
    }
  });

  /* EGO 조명 위치 추적 */
  const ego = sim.cars.find(c => c.isEgo);
  if (ego) {
    sim.egoLight.position.set(ego.mesh.position.x, 2, ego.mesh.position.z);
  }

  /* ── 차선 마킹 스크롤 ── */
  sim.dashes.forEach(m => {
    m.position.z += carSpd;
    if (m.position.z > 14) m.position.z -= 66;
  });

  /* ── 압전 센서 애니메이션 ── */
  sim.sensors.forEach(s => {
    let carNear = false, egoNear = false;
    sim.cars.forEach(car => {
      const inX = Math.abs(car.mesh.position.x - s.laneX) < 1.6;
      const inZ = Math.abs(car.mesh.position.z - s.z)     < 3.0;
      if (inX && inZ) { carNear = true; if (car.isEgo) egoNear = true; }
    });

    /* 안개 시 베이스라인 상향 — 도로 매립 센서는 날씨 무관하게 항상 감지 중 */
    const fogBase   = isFog ? 0.28 + 0.10 * Math.sin(ts * 1.8 + s.phase * 3) : 0.04 + 0.03 * Math.sin(ts * 2 + s.phase * 5);
    const targetOp  = egoNear ? 0.92 : carNear ? 0.72 : fogBase;
    s.glowMat.opacity += (targetOp - s.glowMat.opacity) * 0.2;

    /* 데이터 빔 — 안개 시 차 없어도 저강도 상시 발광 */
    const beamActive = carNear || isFog;
    s.pulseMat.opacity = carNear
      ? 0.75 + 0.25 * Math.sin(ts * 10 + s.phase)
      : isFog ? 0.18 + 0.12 * Math.abs(Math.sin(ts * 2.5 + s.phase)) : 0;
    if (s.pulseMesh) {
      s.pulseMesh.scale.y = carNear ? 1.4 + 0.9 * Math.abs(Math.sin(ts * 7 + s.phase))
        : isFog ? 0.35 + 0.2 * Math.abs(Math.sin(ts * 2 + s.phase)) : 0.05;
    }

    /* RSU LED: 안개 시 항상 최대 밝기 */
    s.ledMat.opacity = carNear ? 0.6 + 0.4 * Math.sin(ts * 8 + s.phase) : isFog ? 0.95 : 0.25;
  });

  /* ── 열화상 카메라 애니메이션 ── */
  sim.thermals.forEach(tc => {
    let carInZone = false, egoInZone = false;
    sim.cars.forEach(car => {
      if (Math.abs(car.mesh.position.z - tc.z) < tc.zHW + 1.5) {
        carInZone = true;
        if (car.isEgo) egoInZone = true;
      }
    });

    /* 스캔 라인 왕복 — 안개 시 빠르게 / 커브는 로컬 Z로 이동 */
    const scanSpd = isFog ? 2.2 : 1.2;
    const scanOffset = Math.sin(ts * scanSpd + tc.phase * 2) * tc.zHW * 0.85;
    tc.scanBar.position.z = tc.isCurve ? scanOffset : tc.z + scanOffset;

    /* 안개 시: 열화상은 안개 관통 → 스캔필드·와이어 모두 최대 밝기로 강조 */
    const baseOp = isFog
      ? 0.42 + 0.08 * Math.sin(ts * 1.5 + tc.phase * 2)   // 안개: 상시 강한 스캔 필드
      : 0.04 + 0.02 * Math.sin(ts * 0.8 + tc.phase * 3);  // 평상시: 거의 꺼짐
    tc.fanMat.opacity  = isFog
      ? Math.max(0.42, carInZone ? (egoInZone ? 0.62 : 0.52) : baseOp)
      : carInZone ? (egoInZone ? 0.18 : 0.12) + 0.04 * Math.sin(ts * 3) : baseOp;
    tc.wireMat.opacity = isFog ? 0.88 + 0.12 * Math.sin(ts * 2 + tc.phase) : carInZone ? 0.7 : 0.25;
    tc.scanMat.opacity = isFog
      ? 0.90 + 0.10 * Math.sin(ts * 4 + tc.phase)
      : carInZone ? 0.8 + 0.2 * Math.sin(ts * 4 + tc.phase) : 0.35;

    /* 카메라 헤드 발광: 안개 시 주황색 상시 발광 (열화상 활성 표시) */
    if (isFog) {
      tc.camMat.emissive.setHex(0xff5500);
      tc.camMat.emissiveIntensity = 0.7 + 0.2 * Math.sin(ts * 4 + tc.phase);
    } else {
      tc.camMat.emissive.setHex(carInZone ? CLR_NUM[sim.st] : 0x000000);
      tc.camMat.emissiveIntensity = carInZone ? 0.5 + 0.2 * Math.sin(ts * 5) : 0;
    }

    /* 카메라 LED: 안개 시 항상 최대 */
    tc.camLedMat.opacity = (isFog || egoInZone) ? 1.0 : 0.7 + 0.2 * Math.sin(ts * 3 + tc.phase);
  });

  /* ── 날씨 파티클 ── */
  const { geo, mat, pos } = sim.particles;
  mat.opacity = (isRain || isSnow) ? 0.78 : 0;
  if (isRain || isSnow) {
    const fallSpd = isRain ? 9 : 1.8;
    for (let i = 0; i < 320; i++) {
      pos[i*3+1] -= fallSpd * dt;
      if (isSnow) pos[i*3] += (Math.random() - 0.5) * 0.25;
      if (pos[i*3+1] < -1) {
        pos[i*3]   = (Math.random() - 0.5) * 22;
        pos[i*3+1] = 14;
        pos[i*3+2] = (Math.random() - 0.5) * 50 - 20;
      }
    }
    geo.attributes.position.needsUpdate = true;
    mat.size = isRain ? 0.055 : 0.13;
    mat.color.setHex(isRain ? 0x88aadd : 0xddeeff);
  }
  const cfg = SCENE_CFG[sim.sec.id];
  if (isFog) {
    sim.scene.fog.near = sim.sec.id === 'tunnel' ? cfg.fogN : 14;
    sim.scene.fog.far  = sim.sec.id === 'tunnel' ? cfg.fogF : 32;
    sim.scene.fog.color.setHex(0x2a4455);
  } else {
    sim.scene.fog.near = cfg.fogN;
    sim.scene.fog.far  = cfg.fogF;
    sim.scene.fog.color.setHex(cfg.fogClr);
  }
  sim.egoLight.intensity = 0.8 + Math.sin(ts * 2.5) * 0.15;
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
      <div class="limit-card"><div class="lc-head">↩️ 급커브 구간</div><div class="lc-speed">40~60 km/h</div><div class="lc-rec">곡률에 따라 차등 적용</div><ul><li>원심력 이탈 방지</li><li>곡률 반경별 속도 제한</li></ul><div class="lc-law">도로 구조 규칙 제19조</div></div>
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
