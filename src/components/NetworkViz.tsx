import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { MutableRefObject } from 'react';
import type { SimState } from '../types';
import { REAL_RED_IDS, REAL_WHITE_IDS } from '../live/realAgents';

interface Props {
  stateRef: MutableRefObject<SimState>;
  onSelectAgent: (id: number | null) => void;
  filteredIdsRef: MutableRefObject<Set<number> | null>;
}

const BASE = import.meta.env.BASE_URL;
const HOLO_URLS = [
  `${BASE}holograms/bigfoot-holo-white.png?v=cartoon2`,
  `${BASE}holograms/bigfoot-holo-red.png?v=cartoon2`,
  `${BASE}holograms/bigfoot-holo-green.png?v=cartoon2`,
  `${BASE}holograms/bigfoot-holo-black.png?v=cartoon2`,
  `${BASE}holograms/bigfoot-holo-sand.png?v=cartoon2`,
] as const;

/** Black needs normal blending so the silhouette stays visible; others glow additively. */
const HOLO_ADDITIVE = [true, true, true, false, true] as const;

export function NetworkViz({ stateRef, onSelectAgent, filteredIdsRef }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelectAgent);
  selectRef.current = onSelectAgent;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02060c, 0.012);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 200);
    camera.position.set(0, 14, 68);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0x0a2030, 1.2));
    const key = new THREE.PointLight(0x00e5ff, 2.5, 120);
    key.position.set(10, 24, 20);
    scene.add(key);
    const fill = new THREE.PointLight(0x004466, 1.2, 100);
    fill.position.set(-20, -5, -10);
    scene.add(fill);
    const coreLight = new THREE.PointLight(0x00e5ff, 3.2, 40);
    coreLight.position.set(0, 2, 0);
    scene.add(coreLight);

    // Pedestal / floor rings
    const floorGroup = new THREE.Group();
    scene.add(floorGroup);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(6 + i * 3.2, 6.08 + i * 3.2, 64),
        new THREE.MeshBasicMaterial({
          color: 0x00e5ff,
          transparent: true,
          opacity: 0.18 - i * 0.025,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -16;
      floorGroup.add(ring);
    }
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(5.5, 64),
      new THREE.MeshBasicMaterial({
        color: 0x00b8d4,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -16.01;
    floorGroup.add(disc);

    // Vertical data rays
    const rayGeo = new THREE.BufferGeometry();
    const rayCount = 80;
    const rayPos = new Float32Array(rayCount * 6);
    for (let i = 0; i < rayCount; i++) {
      const a = (i / rayCount) * Math.PI * 2;
      const r = 4 + (i % 5) * 2.5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      rayPos[i * 6] = x;
      rayPos[i * 6 + 1] = -16;
      rayPos[i * 6 + 2] = z;
      rayPos[i * 6 + 3] = x;
      rayPos[i * 6 + 4] = -16 + 4 + (i % 7);
      rayPos[i * 6 + 5] = z;
    }
    rayGeo.setAttribute('position', new THREE.BufferAttribute(rayPos, 3));
    const rays = new THREE.LineSegments(
      rayGeo,
      new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.15 }),
    );
    scene.add(rays);

    const state = stateRef.current;
    const N = state.agents.length;

    // ——— Hologram Bigfoot billboards (weighted rarity) ———
    // Indices match HOLO_URLS: 0 white, 1 red, 2 green, 3 black, 4 sand
    // Rarity: sand 50%, green 20%, black 15%, white 10%, red 5%
    const buckets: number[][] = [[], [], [], [], []];
    const reserved = new Set<number>([...REAL_WHITE_IDS, ...REAL_RED_IDS]);
    // Pin real agents to white (0) / red (1) hologram buckets
    for (const id of REAL_WHITE_IDS) {
      if (id >= 0 && id < N) buckets[0].push(id);
    }
    for (const id of REAL_RED_IDS) {
      if (id >= 0 && id < N) buckets[1].push(id);
    }
    const order = Array.from({ length: N }, (_, i) => i).filter((i) => !reserved.has(i));
    // deterministic shuffle of remaining sim-only agents
    for (let i = order.length - 1; i > 0; i--) {
      const j = (Math.imul(i + 1, 2654435761) >>> 0) % (i + 1);
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    // Target rarity among remaining: white 10%, red 5%, green 20%, black 15%, sand rest
    // but white/red quotas already partly filled by real agents
    const rem = order.length;
    const wantWhite = Math.max(0, Math.round(N * 0.1) - buckets[0].length);
    const wantRed = Math.max(0, Math.round(N * 0.05) - buckets[1].length);
    const wantGreen = Math.round(N * 0.2);
    const wantBlack = Math.round(N * 0.15);
    const quotas = [wantWhite, wantRed, wantGreen, wantBlack, 0];
    const assigned = quotas[0] + quotas[1] + quotas[2] + quotas[3];
    quotas[4] = Math.max(0, rem - assigned);
    // If over-assigned, shrink sand then black
    let overflow = assigned + quotas[4] - rem;
    for (let c = 4; c >= 0 && overflow > 0; c--) {
      const cut = Math.min(quotas[c], overflow);
      quotas[c] -= cut;
      overflow -= cut;
    }
    let cursor = 0;
    for (let c = 0; c < 5; c++) {
      for (let k = 0; k < quotas[c] && cursor < order.length; k++) {
        buckets[c].push(order[cursor++]);
      }
    }
    while (cursor < order.length) buckets[4].push(order[cursor++]);

    const planeGeo = new THREE.PlaneGeometry(0.38, 0.57); // smaller cartoon Bigfoots
    const loader = new THREE.TextureLoader();
    const holoMats: THREE.MeshBasicMaterial[] = [];
    const holoMeshes: THREE.InstancedMesh[] = [];
    const holoTextures: Array<THREE.Texture | null> = [null, null, null, null, null];

    for (let c = 0; c < 5; c++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: HOLO_ADDITIVE[c] ? 0.88 : 0.92,
        depthWrite: false,
        blending: HOLO_ADDITIVE[c] ? THREE.AdditiveBlending : THREE.NormalBlending,
        side: THREE.DoubleSide,
        fog: true,
      });
      holoMats.push(mat);
      const mesh = new THREE.InstancedMesh(planeGeo, mat, Math.max(buckets[c].length, 1));
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = buckets[c].length;
      scene.add(mesh);
      holoMeshes.push(mesh);

      const colorIndex = c;
      loader.load(HOLO_URLS[c], (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        holoTextures[colorIndex] = tex;
        mat.map = tex;
        mat.needsUpdate = true;
      });
    }

    const dummy = new THREE.Object3D();

    // Edge lines
    const edgePairs = state.edges;
    const maxEdgeVerts = Math.min(edgePairs.length, 2800) * 2;
    const edgePositions = new Float32Array(maxEdgeVerts * 3);
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x00b8d4,
      transparent: true,
      opacity: 0.22,
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    scene.add(edgeLines);

    // Pulse sprites along edges
    const pulseMax = 80;
    const pulseGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.95,
    });
    const pulses = new THREE.InstancedMesh(pulseGeo, pulseMat, pulseMax);
    pulses.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(pulses);

    // ——— Gold data transmission along mesh wires (edgePairs) ———
    const goldLight = new THREE.PointLight(0xffd700, 4.5, 55, 2);
    goldLight.position.set(0, 0, 0);
    scene.add(goldLight);

    const TX_MAX = 144;
    type WireSignal = {
      edgeIndex: number;
      fromId: number;
      toId: number;
      progress: number;
      speed: number;
    };

    // Adjacency: agentId → list of { neighbor, edgeIndex }
    const adj: Array<Array<{ neighbor: number; edgeIndex: number }>> = Array.from(
      { length: N },
      () => [],
    );
    const edgeLimit = Math.min(edgePairs.length, 2800);
    for (let e = 0; e < edgeLimit; e++) {
      const [ai, bi] = edgePairs[e];
      if (ai < N && bi < N) {
        adj[ai].push({ neighbor: bi, edgeIndex: e });
        adj[bi].push({ neighbor: ai, edgeIndex: e });
      }
    }

    const dist2 = (id: number) => {
      const a = state.agents[id];
      return a.x * a.x + a.y * a.y + a.z * a.z;
    };

    // Stratify edges by average agent Y so gold covers top / mid / bottom of the swarm
    const yValues = state.agents.map((a) => a.y).sort((a, b) => a - b);
    const yLow = yValues[Math.floor(N / 3)] ?? 0;
    const yHigh = yValues[Math.floor((2 * N) / 3)] ?? 0;
    const edgesByBand: number[][] = [[], [], []];
    for (let e = 0; e < edgeLimit; e++) {
      const [ai, bi] = edgePairs[e];
      if (ai >= N || bi >= N) continue;
      const avgY = (state.agents[ai].y + state.agents[bi].y) * 0.5;
      const band = avgY < yLow ? 0 : avgY > yHigh ? 2 : 1;
      edgesByBand[band].push(e);
    }
    // Round-robin band cursor so concurrent signals stay latitude-balanced
    let spawnBandCursor = 0;

    const spawnSignal = (sig: WireSignal, preferBand?: number) => {
      if (edgeLimit === 0) {
        sig.edgeIndex = 0;
        sig.fromId = 0;
        sig.toId = 0;
        sig.progress = 0;
        sig.speed = 0.5;
        return;
      }
      let band =
        preferBand !== undefined ? preferBand % 3 : spawnBandCursor++ % 3;
      let pool = edgesByBand[band];
      if (pool.length === 0) {
        pool = edgesByBand.find((b) => b.length > 0) ?? [];
      }
      const e =
        pool.length > 0
          ? pool[Math.floor(Math.random() * pool.length)]
          : Math.floor(Math.random() * edgeLimit);
      const [ai, bi] = edgePairs[e];
      const dA = dist2(ai);
      const dB = dist2(bi);
      // Mild outward bias, but often flip so poles / equator both get traffic
      let fromId = ai;
      let toId = bi;
      if (Math.random() < 0.6) {
        if (dB >= dA) {
          fromId = ai;
          toId = bi;
        } else {
          fromId = bi;
          toId = ai;
        }
      } else if (Math.random() < 0.5) {
        fromId = bi;
        toId = ai;
      }
      sig.edgeIndex = e;
      sig.fromId = fromId;
      sig.toId = toId;
      sig.progress = Math.random() * 0.15;
      sig.speed = 0.55 + Math.random() * 0.75;
    };

    const hopOrRespawn = (sig: WireSignal) => {
      const at = sig.toId;
      const links = adj[at];
      const candidates = links.filter((l) => l.neighbor !== sig.fromId);
      // Occasional full respawn keeps coverage across all latitudes
      if (candidates.length === 0 || Math.random() < 0.1) {
        spawnSignal(sig);
        return;
      }
      const fromDist = dist2(sig.fromId);
      // Mild outward preference — still allow inward / lateral so signals don't trap at poles
      let next = candidates[Math.floor(Math.random() * candidates.length)];
      if (Math.random() < 0.55) {
        const outward = candidates.filter((l) => dist2(l.neighbor) >= fromDist * 0.88);
        if (outward.length > 0) {
          next = outward[Math.floor(Math.random() * outward.length)];
        }
      }
      sig.edgeIndex = next.edgeIndex;
      sig.fromId = at;
      sig.toId = next.neighbor;
      sig.progress = 0;
      sig.speed = 0.5 + Math.random() * 0.85;
    };

    const wireSignals: WireSignal[] = [];
    for (let i = 0; i < TX_MAX; i++) {
      const sig: WireSignal = { edgeIndex: 0, fromId: 0, toId: 0, progress: 0, speed: 0.5 };
      spawnSignal(sig, i % 3);
      sig.progress = Math.random();
      wireSignals.push(sig);
    }

    // Gold highlight overlay on the exact blue edge segments currently carrying signals
    const txEdgePos = new Float32Array(TX_MAX * 6);
    const txEdgeGeo = new THREE.BufferGeometry();
    txEdgeGeo.setAttribute('position', new THREE.BufferAttribute(txEdgePos, 3));
    const txEdgeMat = new THREE.LineBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const txEdgeLines = new THREE.LineSegments(txEdgeGeo, txEdgeMat);
    scene.add(txEdgeLines);

    // Tiny gold packets locked to wire endpoints (lerp between agents)
    const txPacketGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const txPacketMat = new THREE.MeshBasicMaterial({
      color: 0xffe27a,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const txPackets = new THREE.InstancedMesh(txPacketGeo, txPacketMat, TX_MAX);
    txPackets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    txPackets.frustumCulled = false;
    scene.add(txPackets);

    // Track which blue edges are lit so we can briefly boost their opacity via a second pass flag
    const litEdgeBoost = new Uint8Array(edgeLimit);

    // Inner gold corona on the orb (illumination source)
    const goldCore = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );

    // Outer wireframe cube ring
    const chainGroup = new THREE.Group();
    scene.add(chainGroup);
    const cubeCount = 12;
    for (let i = 0; i < cubeCount; i++) {
      const ang = (i / cubeCount) * Math.PI * 2;
      const r = 30;
      const cube = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.6, 1.6, 1.6)),
        new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.45 }),
      );
      cube.position.set(Math.cos(ang) * r, -8, Math.sin(ang) * r);
      chainGroup.add(cube);
      const next = ((i + 1) / cubeCount) * Math.PI * 2;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(Math.cos(ang) * r, -8, Math.sin(ang) * r),
        new THREE.Vector3(
          Math.cos((ang + next) / 2) * (r + 1.5),
          -7.2,
          Math.sin((ang + next) / 2) * (r + 1.5),
        ),
        new THREE.Vector3(Math.cos(next) * r, -8, Math.sin(next) * r),
      );
      const link = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(8)),
        new THREE.LineBasicMaterial({ color: 0x00bcd4, transparent: true, opacity: 0.35 }),
      );
      chainGroup.add(link);
    }

    // ——— Abstract holographic BIG NETWORK core ———
    const coreGroup = new THREE.Group();
    coreGroup.position.set(0, 0, 0);
    scene.add(coreGroup);

    const icoGeo = new THREE.IcosahedronGeometry(3.2, 1);
    const icoWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(icoGeo),
      new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.55 }),
    );
    coreGroup.add(icoWire);

    const innerGeo = new THREE.IcosahedronGeometry(1.6, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.12,
      wireframe: true,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerMesh);

    // Soft energy core behind the fixed center logo (plain orb + gold corona)
    const softOrbMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const softOrb = new THREE.Mesh(new THREE.SphereGeometry(1.55, 32, 24), softOrbMat);
    coreGroup.add(softOrb);

    goldCore.geometry.dispose();
    goldCore.geometry = new THREE.SphereGeometry(2.05, 32, 24);
    (goldCore.material as THREE.MeshBasicMaterial).opacity = 0.2;
    coreGroup.add(goldCore);

    // Fixed center Bigfoot logo — circular billboard (NOT sphere UV-wrapped, NOT square)
    const logoGeo = new THREE.CircleGeometry(1.7, 64);
    const logoMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      side: THREE.DoubleSide,
      alphaTest: 0.05,
    });
    const logoPlane = new THREE.Mesh(logoGeo, logoMat);
    logoPlane.frustumCulled = false;
    coreGroup.add(logoPlane);
    let logoTex: THREE.Texture | null = null;
    loader.load(`${BASE}holograms/bigfoot-logo-circle.png?v=4`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      logoTex = tex;
      logoMat.map = tex;
      logoMat.needsUpdate = true;
    });
    const coreRingRadii = [4.2, 5.1, 6.0];
    const coreRings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(coreRingRadii[i], 0.035, 8, 64),
        new THREE.MeshBasicMaterial({
          color: 0x00e5ff,
          transparent: true,
          opacity: 0.4 - i * 0.08,
        }),
      );
      ring.rotation.x = Math.PI / 2 + i * 0.35;
      ring.rotation.y = i * 0.5;
      coreGroup.add(ring);
      coreRings.push(ring);
    }

    // Red hologram Bigfoots orbiting along the cyan wire rings
    const RUNNERS_PER_RING = 5;
    const ringRunnerCount = coreRings.length * RUNNERS_PER_RING;
    const ringRunnerGeo = new THREE.PlaneGeometry(0.32, 0.48);
    const ringRunnerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    const ringRunners = new THREE.InstancedMesh(ringRunnerGeo, ringRunnerMat, ringRunnerCount);
    ringRunners.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ringRunners.frustumCulled = false;
    scene.add(ringRunners);
    let ringRunnerTex: THREE.Texture | null = null;
    loader.load(`${BASE}holograms/bigfoot-holo-red.png?v=cartoon2`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      ringRunnerTex = tex;
      ringRunnerMat.map = tex;
      ringRunnerMat.needsUpdate = true;
    });
    type RingRunner = { ringIndex: number; angle: number; speed: number };
    const ringRunnerState: RingRunner[] = [];
    for (let i = 0; i < coreRings.length; i++) {
      for (let k = 0; k < RUNNERS_PER_RING; k++) {
        ringRunnerState.push({
          ringIndex: i,
          angle: (k / RUNNERS_PER_RING) * Math.PI * 2 + i * 0.4,
          speed: (0.35 + (k % 3) * 0.08 + i * 0.05) * (k % 2 === 0 ? 1 : -1),
        });
      }
    }
    const runnerLocal = new THREE.Vector3();

    // Thin laser eyes from center Bigfoot logo → floating holographics (data send)
    const LASER_PAIRS = 18;
    const laserPos = new Float32Array(LASER_PAIRS * 2 * 2 * 3); // pairs × 2 eyes × 2 verts × xyz
    const laserCols = new Float32Array(LASER_PAIRS * 2 * 2 * 3);
    const laserGeo = new THREE.BufferGeometry();
    laserGeo.setAttribute('position', new THREE.BufferAttribute(laserPos, 3));
    laserGeo.setAttribute('color', new THREE.BufferAttribute(laserCols, 3));
    const laserMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      linewidth: 1,
    });
    const laserLines = new THREE.LineSegments(laserGeo, laserMat);
    laserLines.frustumCulled = false;
    scene.add(laserLines);

    const sparkPos = new Float32Array(LASER_PAIRS * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xff66aa,
      size: 0.42,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const laserSparks = new THREE.Points(sparkGeo, sparkMat);
    laserSparks.frustumCulled = false;
    scene.add(laserSparks);

    type LaserShot = { targetId: number; progress: number; speed: number };
    const laserShots: LaserShot[] = [];
    for (let i = 0; i < LASER_PAIRS; i++) {
      laserShots.push({
        targetId: (i * 83) % 1500,
        progress: Math.random(),
        speed: 0.75 + Math.random() * 1.35,
      });
    }
    // Eye sockets in logo local space (profile facing +X; dual beams read as laser eyes)
    const eyeLocalL = new THREE.Vector3(0.55, 0.28, 0.12);
    const eyeLocalR = new THREE.Vector3(0.22, 0.36, 0.12);
    const eyeWorldL = new THREE.Vector3();
    const eyeWorldR = new THREE.Vector3();
    const laserTarget = new THREE.Vector3();
    const laserHeadL = new THREE.Vector3();
    const laserTailL = new THREE.Vector3();
    const laserHeadR = new THREE.Vector3();
    const laserTailR = new THREE.Vector3();
    // Short streak length along the eye→target path (shooting star, not a continuous laser)
    const STAR_LEN = 0.14;


    // Soft vertical energy column
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 18, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      }),
    );
    column.position.y = -2;
    coreGroup.add(column);

    const coreHalo = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 5.2, 64),
      new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    coreHalo.rotation.x = -Math.PI / 2;
    coreHalo.position.y = -8;
    coreGroup.add(coreHalo);

    // Raycaster for click (project agents to screen)
    const mouse = new THREE.Vector2();

    const onClick = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      const s = stateRef.current;
      let best = -1;
      let bestDist = 0.045;
      const filter = filteredIdsRef.current;
      for (let i = 0; i < s.agents.length; i++) {
        if (filter && !filter.has(i)) continue;
        const a = s.agents[i];
        const v = new THREE.Vector3(a.x, a.y, a.z).project(camera);
        const dx = v.x - mouse.x;
        const dy = v.y - mouse.y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      selectRef.current(best >= 0 ? best : null);
    };
    renderer.domElement.addEventListener('click', onClick);

    let animId = 0;
    let t = 0;

    const updateNodes = () => {
      const s = stateRef.current;
      const filter = filteredIdsRef.current;
      const camQuat = camera.quaternion;

      for (let c = 0; c < 5; c++) {
        const ids = buckets[c];
        const mesh = holoMeshes[c];
        for (let li = 0; li < ids.length; li++) {
          const i = ids[li];
          const a = s.agents[i];
          const visible = !filter || filter.has(i);
          const pulse = a.status === 'working' ? 1 + Math.sin(t * 6 + i * 0.05) * 0.18 : 1;
          const selectedBoost = s.selectedAgentId === i ? 1.35 : 1;
          const liveBoost = a.live ? 1.28 : 1;
          const base =
            a.status === 'idle' ? 0.45 : a.status === 'error' ? 0.58 : 0.52;
          const scale = visible ? base * pulse * selectedBoost * liveBoost : 0.001;
          dummy.position.set(a.x, a.y, a.z);
          dummy.scale.set(scale, scale, scale);
          // Billboard toward camera
          dummy.quaternion.copy(camQuat);
          dummy.updateMatrix();
          mesh.setMatrixAt(li, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }

      // Soft opacity pulse on hologram materials
      const glow = 0.78 + Math.sin(t * 2) * 0.1;
      for (let c = 0; c < 5; c++) {
        holoMats[c].opacity = HOLO_ADDITIVE[c] ? glow : 0.85 + Math.sin(t * 2) * 0.06;
      }

      const agents = s.agents;
      let vi = 0;
      const limit = Math.min(edgePairs.length, 2800);
      for (let e = 0; e < limit; e++) {
        const [ai, bi] = edgePairs[e];
        const A = agents[ai];
        const B = agents[bi];
        edgePositions[vi++] = A.x;
        edgePositions[vi++] = A.y;
        edgePositions[vi++] = A.z;
        edgePositions[vi++] = B.x;
        edgePositions[vi++] = B.y;
        edgePositions[vi++] = B.z;
      }
      edgeGeo.attributes.position.needsUpdate = true;
      edgeGeo.setDrawRange(0, vi / 3);

      const plist = s.pulses;
      for (let i = 0; i < pulseMax; i++) {
        if (i < plist.length) {
          const p = plist[i];
          const A = agents[p.from];
          const B = agents[p.to];
          const u = p.progress;
          dummy.position.set(
            A.x + (B.x - A.x) * u,
            A.y + (B.y - A.y) * u,
            A.z + (B.z - A.z) * u,
          );
          dummy.scale.setScalar(1.2);
          dummy.quaternion.identity();
        } else {
          dummy.position.set(0, -999, 0);
          dummy.scale.setScalar(0.001);
          dummy.quaternion.identity();
        }
        dummy.updateMatrix();
        pulses.setMatrixAt(i, dummy.matrix);
      }
      pulses.instanceMatrix.needsUpdate = true;

      // Gold wire-signals: travel strictly on blue mesh edges (edgePairs)
      litEdgeBoost.fill(0);
      let edgeVi = 0;
      let litCount = 0;
      const pausedMul = s.paused ? 0 : s.speed;
      for (let i = 0; i < TX_MAX; i++) {
        const sig = wireSignals[i];
        sig.progress += 0.016 * sig.speed * pausedMul;
        if (sig.progress >= 1) {
          hopOrRespawn(sig);
        }
        const A = agents[sig.fromId];
        const B = agents[sig.toId];
        if (!A || !B) {
          dummy.position.set(0, -999, 0);
          dummy.scale.setScalar(0.001);
          dummy.quaternion.identity();
          dummy.updateMatrix();
          txPackets.setMatrixAt(i, dummy.matrix);
          continue;
        }

        // Gold highlight of the exact edge segment under this signal
        txEdgePos[edgeVi++] = A.x;
        txEdgePos[edgeVi++] = A.y;
        txEdgePos[edgeVi++] = A.z;
        txEdgePos[edgeVi++] = B.x;
        txEdgePos[edgeVi++] = B.y;
        txEdgePos[edgeVi++] = B.z;
        if (sig.edgeIndex >= 0 && sig.edgeIndex < litEdgeBoost.length && !litEdgeBoost[sig.edgeIndex]) {
          litEdgeBoost[sig.edgeIndex] = 1;
          litCount++;
        }

        // Tiny packet lerped between the two agent endpoints (on the wire)
        const u = Math.min(1, Math.max(0, sig.progress));
        dummy.position.set(
          A.x + (B.x - A.x) * u,
          A.y + (B.y - A.y) * u,
          A.z + (B.z - A.z) * u,
        );
        dummy.scale.setScalar(0.85 + (1 - Math.abs(u - 0.5) * 2) * 0.35);
        dummy.quaternion.identity();
        dummy.updateMatrix();
        txPackets.setMatrixAt(i, dummy.matrix);
      }
      txEdgeGeo.attributes.position.needsUpdate = true;
      txEdgeGeo.setDrawRange(0, edgeVi / 3);
      txEdgeMat.opacity = 0.42 + Math.sin(t * 3.1) * 0.1;
      txPackets.instanceMatrix.needsUpdate = true;

      // Soft transmission glow at lower capacity (~27k TPS / 15%)
      const load = Math.min(1, s.metrics.tps / 27000) * 0.55 + s.metrics.computeUsed * 0.45;
      const blaze = 0.18 + load * 0.28 + Math.sin(t * 4.5) * 0.04;
      // Mostly cyan mesh with a light gold tint
      const goldMix = Math.min(0.35, 0.08 + blaze * 0.35);
      edgeMat.color.setRGB(
        0.0 * (1 - goldMix) + 1.0 * goldMix,
        0.72 * (1 - goldMix) + 0.84 * goldMix,
        0.83 * (1 - goldMix) + 0.15 * goldMix,
      );
      edgeMat.opacity = 0.18 + blaze * 0.12 + Math.min(0.06, litCount * 0.0006);
      edgeMat.needsUpdate = true;
      txEdgeMat.opacity = 0.22 + blaze * 0.18 + Math.sin(t * 3.1) * 0.04;
      txPacketMat.opacity = 0.55 + blaze * 0.15;
      // Keep center calm — soft cyan core only, no gold globe blaze
      goldLight.intensity = 1.2 + Math.sin(t * 2) * 0.3;
      goldLight.distance = 28;
      const gMat = goldCore.material as THREE.MeshBasicMaterial;
      gMat.opacity = 0.06;
      gMat.color.setHex(0x00e5ff);
      softOrbMat.color.setHex(0x00bcd4);
      softOrbMat.opacity = 0.1 + Math.sin(t * 1.9) * 0.03;
      softOrb.scale.setScalar(1 + Math.sin(t * 2.0) * 0.04);
      goldCore.scale.setScalar(1 + Math.sin(t * 2.2) * 0.03);
      logoMat.color.setHex(0xffffff);
      logoMat.opacity = 0.96;
    };

    const onResize = () => {
      if (!mount) return;
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onResize);
    window.setTimeout(onResize, 50);
    window.setTimeout(onResize, 300);

    const animate = () => {
      animId = requestAnimationFrame(animate);
      t += 0.016;
      const s = stateRef.current;
      // slow orbit — look at holographic network core
      const radius = 78;
      const angle = t * 0.08;
      camera.position.x = Math.sin(angle) * radius * 0.35;
      camera.position.z = Math.cos(angle) * radius;
      camera.position.y = 14 + Math.sin(t * 0.15) * 2;
      camera.lookAt(0, 0, 0);

      chainGroup.rotation.y = t * 0.05;
      floorGroup.rotation.y = -t * 0.02;

      icoWire.rotation.y = t * 0.25;
      icoWire.rotation.x = t * 0.12;
      innerMesh.rotation.y = -t * 0.4;
      innerMesh.rotation.z = t * 0.2;
      // Logo stays camera-facing (no globe spin wrap); gold blaze applied in updateNodes
      goldCore.rotation.y = -t * 0.15;
      const logoPulse = 1 + Math.sin(t * 2.2) * 0.03;
      logoPlane.scale.setScalar(logoPulse);
      logoPlane.quaternion.copy(camera.quaternion);
      logoPlane.updateMatrixWorld(true);

      // Shooting-star eye shots: short red streaks travel eye → holo (no continuous laser trail)
      {
        eyeWorldL.copy(eyeLocalL).applyMatrix4(logoPlane.matrixWorld);
        eyeWorldR.copy(eyeLocalR).applyMatrix4(logoPlane.matrixWorld);
        const agents = stateRef.current.agents;
        const pausedMul = stateRef.current.paused ? 0 : stateRef.current.speed;
        let vi = 0;
        let ci = 0;
        for (let i = 0; i < LASER_PAIRS; i++) {
          const shot = laserShots[i];
          // Faster travel so streaks read as meteors at 4×
          shot.progress += 0.016 * shot.speed * 1.85 * pausedMul;
          if (shot.progress >= 1) {
            shot.progress = 0;
            let pick = (shot.targetId + 19 + ((i * 7 + Math.floor(t * 3)) % 41)) % agents.length;
            for (let tries = 0; tries < 24; tries++) {
              const st = agents[pick].status;
              if (st === 'working' || st === 'waiting') break;
              pick = (pick + 31) % agents.length;
            }
            shot.targetId = pick;
            shot.speed = 0.95 + Math.random() * 1.6;
          }
          const a = agents[shot.targetId];
          laserTarget.set(a.x, a.y, a.z);
          const head = shot.progress;
          const tail = Math.max(0, head - STAR_LEN);
          // Fade in briefly, full body, soft fade at impact
          const intensity =
            head < 0.06 ? head / 0.06 : head > 0.92 ? Math.max(0, (1 - head) / 0.08) : 1;
          laserHeadL.copy(eyeWorldL).lerp(laserTarget, head);
          laserTailL.copy(eyeWorldL).lerp(laserTarget, tail);
          laserHeadR.copy(eyeWorldR).lerp(laserTarget, head);
          laserTailR.copy(eyeWorldR).lerp(laserTarget, tail);
          // Left eye streak (tail → head)
          laserPos[vi++] = laserTailL.x;
          laserPos[vi++] = laserTailL.y;
          laserPos[vi++] = laserTailL.z;
          laserPos[vi++] = laserHeadL.x;
          laserPos[vi++] = laserHeadL.y;
          laserPos[vi++] = laserHeadL.z;
          // Right eye streak
          laserPos[vi++] = laserTailR.x;
          laserPos[vi++] = laserTailR.y;
          laserPos[vi++] = laserTailR.z;
          laserPos[vi++] = laserHeadR.x;
          laserPos[vi++] = laserHeadR.y;
          laserPos[vi++] = laserHeadR.z;
          // Dim red tail → hot tip
          const rT = 0.55 * intensity;
          const gT = 0.02 * intensity;
          const bT = 0.08 * intensity;
          const rH = 1.0 * intensity;
          const gH = 0.35 * intensity;
          const bH = 0.55 * intensity;
          for (let e = 0; e < 2; e++) {
            laserCols[ci++] = rT;
            laserCols[ci++] = gT;
            laserCols[ci++] = bT;
            laserCols[ci++] = rH;
            laserCols[ci++] = gH;
            laserCols[ci++] = bH;
          }
          // Spark rides the leading tip
          if (intensity > 0.2) {
            sparkPos[i * 3] = laserHeadL.x * 0.5 + laserHeadR.x * 0.5;
            sparkPos[i * 3 + 1] = laserHeadL.y * 0.5 + laserHeadR.y * 0.5;
            sparkPos[i * 3 + 2] = laserHeadL.z * 0.5 + laserHeadR.z * 0.5;
          } else {
            sparkPos[i * 3] = 0;
            sparkPos[i * 3 + 1] = -999;
            sparkPos[i * 3 + 2] = 0;
          }
        }
        (laserGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (laserGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
        (sparkGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        sparkMat.opacity = 0.55 + Math.sin(t * 10) * 0.2;
        laserMat.opacity = 0.9;
      }

      for (let i = 0; i < coreRings.length; i++) {
        coreRings[i].rotation.z = t * (0.3 + i * 0.12);
        coreRings[i].rotation.x = Math.PI / 2 + i * 0.35 + Math.sin(t * 0.4 + i) * 0.15;
        coreRings[i].updateMatrixWorld(true);
      }

      // Red holo Bigfoots ride the torus wire paths, billboarded to camera
      const pausedMulAnim = stateRef.current.paused ? 0 : stateRef.current.speed;
      for (let ri = 0; ri < ringRunnerState.length; ri++) {
        const runner = ringRunnerState[ri];
        runner.angle += 0.016 * runner.speed * pausedMulAnim;
        const ring = coreRings[runner.ringIndex];
        const R = coreRingRadii[runner.ringIndex];
        // Torus major circle lies in local XY
        runnerLocal.set(Math.cos(runner.angle) * R, Math.sin(runner.angle) * R, 0);
        runnerLocal.applyMatrix4(ring.matrixWorld);
        dummy.position.copy(runnerLocal);
        dummy.scale.setScalar(0.55 + Math.sin(t * 3 + ri) * 0.05);
        dummy.quaternion.copy(camera.quaternion);
        dummy.updateMatrix();
        ringRunners.setMatrixAt(ri, dummy.matrix);
      }
      ringRunners.instanceMatrix.needsUpdate = true;
      ringRunnerMat.opacity = 0.78 + Math.sin(t * 2.5) * 0.12;

      coreHalo.rotation.z = t * 0.12;
      (innerMat as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(t * 1.8) * 0.05;

      updateNodes();
      // Core stays cyan; mesh carries the gold heat
      coreLight.color.setHex(0x00e5ff);
      coreLight.intensity = 2.6 + Math.sin(t * 2) * 0.4;

      renderer.render(scene, camera);
      void s;
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onResize);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.dispose();
      planeGeo.dispose();
      txEdgeGeo.dispose();
      txEdgeMat.dispose();
      txPacketGeo.dispose();
      txPacketMat.dispose();
      scene.remove(txEdgeLines);
      scene.remove(txPackets);
      scene.remove(goldLight);
      softOrbMat.dispose();
      softOrb.geometry.dispose();
      logoGeo.dispose();
      logoMat.dispose();
      logoTex?.dispose();
      laserGeo.dispose();
      laserMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      scene.remove(laserLines);
      scene.remove(laserSparks);
      ringRunnerGeo.dispose();
      ringRunnerMat.dispose();
      ringRunnerTex?.dispose();
      scene.remove(ringRunners);
      ringRunners.dispose();
      for (const mat of holoMats) mat.dispose();
      for (const tex of holoTextures) tex?.dispose();
      for (const mesh of holoMeshes) {
        scene.remove(mesh);
        mesh.dispose();
      }
      edgeGeo.dispose();
      edgeMat.dispose();
      pulseGeo.dispose();
      pulseMat.dispose();
      icoGeo.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [stateRef, filteredIdsRef]);

  return <div className="network-viz" ref={mountRef} />;
}
