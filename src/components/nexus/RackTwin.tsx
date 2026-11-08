import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Grid, Html, Lightformer, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { RotateCcw, Maximize } from "lucide-react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CLUSTERS, type Rack } from "@/lib/demo-data";
import { BLADE_COLORS, BLADE_LABELS, BLADES_PER_RACK, type Blade } from "@/lib/infra-data";

// Rack-level status colors mirror the --success / --warning / --destructive tokens.
export const TWIN_COLORS = {
  green: "#2fc27a",
  amber: "#f2b13a",
  red: "#ec4c4f",
  dim: "#3a4256",
  heatLow: "#5a2a33",
  heatMid: "#b2393f",
  heatHigh: "#ff4d4f",
};

export type TwinRack = Rack & { color: string; dimmed: boolean; glow: number; blades: Blade[] };

const RACK_W = 0.7, RACK_H = 2.1, RACK_D = 1.1, GAP = 0.12;

// Cluster layout: 2x2 halls, each two facing rows of 4 racks (cold aisle between).
function rackPosition(r: Rack): [number, number, number] {
  const ci = CLUSTERS.findIndex((c) => c.name === r.cluster);
  const local = r.n - (CLUSTERS[ci]?.range[0] ?? 1); // 0..7
  const row = Math.floor(local / 4);
  const col = local % 4;
  const cx = (ci % 2 === 0 ? -1 : 1) * 3.4;
  const cz = (ci < 2 ? -1 : 1) * 3.2;
  const x = cx + (col - 1.5) * (RACK_W + GAP);
  const z = cz + (row === 0 ? -1 : 1) * (RACK_D / 2 + 0.6);
  return [x, RACK_H / 2, z];
}

function rackFacing(r: Rack): number {
  const local = r.n - (CLUSTERS.find((c) => c.name === r.cluster)?.range[0] ?? 1);
  return local < 4 ? 1 : -1;
}

const OVERVIEW_POSITION: [number, number, number] = [9, 8, 11];
const INSPECT_POSITION: [number, number, number] = [1.25, 1.45, 4.4];
function CameraCommand({ command, inspect }: { command: number; inspect: boolean }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    const orbit = controls as OrbitControlsImpl | null;
    camera.position.set(...(inspect ? INSPECT_POSITION : OVERVIEW_POSITION));
    if (orbit) { orbit.target.set(0, inspect ? 1.05 : 0.8, 0); orbit.update(); }
    camera.lookAt(0, inspect ? 1.05 : 0.8, 0);
  }, [command, inspect, camera, controls]);
  return null;
}
function ReadySignal({ onReady }: { onReady: () => void }) {
  const sent = useRef(false);
  useFrame(() => { if (!sent.current) { sent.current = true; onReady(); } });
  return null;
}
function CriticalBeacon({ blade, onSelect }: { blade: Blade; onSelect: (b: Blade) => void }) {
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches); update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useFrame(({ clock }) => { if(material.current) material.current.emissiveIntensity = reduced ? 2 : 1.2 + (Math.sin(clock.elapsedTime * 4) + 1) * 1.4; });
  return <mesh position={[-RACK_W * 0.34, 0, 0.045]} onClick={e => { e.stopPropagation(); if(e.delta < 4) onSelect(blade); }}>
    <sphereGeometry args={[0.025, 8, 8]} />
    <meshStandardMaterial ref={material} color={BLADE_COLORS.red} emissive={BLADE_COLORS.red} toneMapped={false} />
  </mesh>;
}

function BladeSlat({
  blade, rack, selected, anySelected, onSelectBlade,
}: {
  blade: Blade; rack: TwinRack; selected: boolean; anySelected: boolean; onSelectBlade: (b: Blade) => void;
}) {
  const [hover, setHover] = useState(false);
  const i = blade.slot - 1;
  const slatH = (RACK_H * 0.88) / BLADES_PER_RACK - 0.03;
  const y = RACK_H * 0.44 - (i + 0.5) * (RACK_H * 0.88) / BLADES_PER_RACK;
  const color = BLADE_COLORS[blade.health];
  const interactive = anySelected && !rack.dimmed;
  // When the rack is selected, blades slide slightly out of the cabinet for inspection.
  const pop = anySelected ? 0.09 : 0;
  const opacity = rack.dimmed ? 0.18 : 1;
  return (
    <group position={[0, y, RACK_D / 2 + 0.012 + pop]}>
      <mesh
        onPointerOver={(e) => { if (!interactive) return; e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}
        onClick={(e) => { if (!interactive || e.delta > 4) return; e.stopPropagation(); onSelectBlade(blade); }}
      >
        <boxGeometry args={[RACK_W * 0.84, slatH, 0.03]} />
        <meshStandardMaterial
          color="#1b2230"
          emissive={color}
          emissiveIntensity={blade.health === "green" ? 0.35 : 1.1}
          metalness={0.4}
          roughness={0.5}
          transparent
          opacity={opacity}
        />
      </mesh>
      {blade.health === "red" && <CriticalBeacon blade={blade} onSelect={onSelectBlade} />}
      {/* status strip on the slat edge */}
      <mesh position={[RACK_W * 0.36, 0, 0.02]}>
        <boxGeometry args={[0.05, slatH * 0.7, 0.01]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} toneMapped={false} transparent opacity={opacity} />
      </mesh>
      {(hover || selected) && interactive && (
        <>
          <mesh>
            <boxGeometry args={[RACK_W * 0.88, slatH + 0.02, 0.05]} />
            <meshBasicMaterial color="#4d8dff" wireframe />
          </mesh>
          <Html position={[0, slatH, 0.2]} center style={{ pointerEvents: "none" }}>
            <div className="max-w-56 rounded-lg border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-lg">
              <b>{blade.id}</b> · {BLADE_LABELS[blade.health]} · {blade.temp}°C · {blade.errors} err/h
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

function RackMesh({
  rack, selected, anyRackSelected, selectedBladeId, onSelect, onSelectBlade,
}: {
  rack: TwinRack; selected: boolean; anyRackSelected: boolean; selectedBladeId?: string | undefined;
  onSelect: (r: Rack) => void; onSelectBlade: (b: Blade) => void;
}) {
  const [hover, setHover] = useState(false);
  const pos: [number, number, number] = selected ? [0, RACK_H / 2, 0] : rackPosition(rack);
  const facing = selected ? 1 : rackFacing(rack);
  const lift = hover || selected ? 0.08 : 0;
  const opacity = rack.dimmed ? 0.18 : 1;
  return (
    <group
      position={[pos[0], pos[1] + lift, pos[2]]}
      rotation-y={facing === 1 ? 0 : Math.PI}
      onPointerOver={(e) => { if (rack.dimmed || anyRackSelected) return; e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}
      onClick={(e) => { if (rack.dimmed || anyRackSelected || e.delta > 4) return; e.stopPropagation(); onSelect(rack); }}
    >
      {/* cabinet body */}
      <mesh castShadow>
        <boxGeometry args={[RACK_W, RACK_H, RACK_D]} />
        <meshStandardMaterial color="#2a3246" metalness={0.6} roughness={0.45} transparent opacity={opacity} />
      </mesh>
      {/* individual server blades on the aisle-facing side */}
      {rack.blades.map((b) => (
        <BladeSlat key={b.id} blade={b} rack={rack} selected={b.id === selectedBladeId} anySelected={selected} onSelectBlade={onSelectBlade} />
      ))}
      {/* status LED strip */}
      <mesh position={[RACK_W * 0.44, 0, RACK_D / 2 + 0.01]}>
        <boxGeometry args={[0.04, RACK_H * 0.88, 0.01]} />
        <meshStandardMaterial color={rack.color} emissive={rack.color} emissiveIntensity={1.4 * rack.glow} toneMapped={false} transparent opacity={opacity} />
      </mesh>
      {/* status top cap */}
      <mesh position={[0, RACK_H / 2 + 0.03, 0]}>
        <boxGeometry args={[RACK_W, 0.06, RACK_D]} />
        <meshStandardMaterial color={rack.color} emissive={rack.color} emissiveIntensity={0.5 * rack.glow} toneMapped={false} transparent opacity={opacity} />
      </mesh>
      {(hover || selected) && !rack.dimmed && (
        <>
          <mesh>
            <boxGeometry args={[RACK_W + 0.06, RACK_H + 0.14, RACK_D + 0.06]} />
            <meshBasicMaterial color="#4d8dff" wireframe />
          </mesh>
          {!selected && (
            <Html position={[0, RACK_H / 2 + 0.4, 0]} center distanceFactor={9} style={{ pointerEvents: "none" }}>
              <div className="whitespace-nowrap rounded-lg border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-lg">
                <b>{rack.id}</b> · {rack.health}% · {rack.issue}
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}

export default function RackTwin({
  racks, selectedId, selectedBladeId, onSelect, onSelectBlade,
}: {
  racks: TwinRack[];
  selectedId?: string | undefined;
  selectedBladeId?: string | undefined;
  onSelect: (r: Rack | null) => void;
  onSelectBlade: (b: Blade | null) => void;
}) {
  const [ready, setReady] = useState(false);
  const [command, setCommand] = useState(0);

  const selected = racks.find((r) => r.id === selectedId);

  return (
    <div className="relative h-[520px] w-full overflow-hidden bg-background" data-scene-ready={ready ? "" : undefined}>
      <div className="absolute right-3 top-3 z-10 flex gap-2"><Button variant="secondary" size="icon" title="Reset camera" aria-label="Reset camera" onClick={() => setCommand(c => c + 1)}><RotateCcw /></Button><Button variant="secondary" size="icon" title="Fit entire rack" aria-label="Fit entire rack" onClick={() => setCommand(c => c + 1)}><Maximize /></Button></div>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: selected ? INSPECT_POSITION : OVERVIEW_POSITION, fov: 40 }}
        onPointerMissed={() => { if (!selected) onSelectBlade(null); }}
      >
        <color attach="background" args={["#0b0f19"]} />
        <fog attach="fog" args={["#0b0f19", 22, 40]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[6, 12, 6]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
        <pointLight position={[0, 4, 0]} intensity={8} color="#4d8dff" distance={14} />
        <Environment resolution={64}>
          <Lightformer intensity={2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
          <Lightformer intensity={1} color="#6aa0ff" position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
        </Environment>

        {/* raised floor */}
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#121826" roughness={0.9} />
        </mesh>
        <Grid position={[0, 0.002, 0]} args={[30, 30]} cellSize={0.6} cellColor="#1f2738" sectionSize={3} sectionColor="#2b3a5a" fadeDistance={28} infiniteGrid={false} />
        <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={20} blur={2} far={4} />

        {/* cluster labels on the floor */}
        {!selected && CLUSTERS.map((c, ci) => (
          <Html key={c.name} position={[(ci % 2 === 0 ? -1 : 1) * 3.4, 0.05, (ci < 2 ? -1 : 1) * 3.2 + (ci < 2 ? -2.3 : 2.3)]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
            <div className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.name} · {c.role}</div>
          </Html>
        ))}

        {(selected ? [selected] : racks).map((r) => (
          <RackMesh
            key={r.id}
            rack={r}
            selected={r.id === selectedId}
            anyRackSelected={!!selectedId}
            selectedBladeId={selectedBladeId}
            onSelect={(rack) => onSelect(rack)}
            onSelectBlade={(b) => onSelectBlade(b)}
          />
        ))}

        <CameraCommand command={command} inspect={!!selected} />
        <ReadySignal onReady={() => setReady(true)} />
        <OrbitControls makeDefault enableDamping target={[0, selected ? 1.05 : 0.8, 0]} minDistance={1.6} maxDistance={selected ? 12 : 26} maxPolarAngle={Math.PI * 0.95} />
      </Canvas>
    </div>
  );
}
