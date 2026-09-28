import { Suspense, useRef, useEffect, useMemo, useState } from "react";
import {
  Canvas,
  useThree,
  useFrame,
  type ThreeEvent,
} from "@react-three/fiber";
import {
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
  TransformControls,
  ContactShadows,
  Html,
} from "@react-three/drei";
import {
  Color,
  Vector3,
  Group,
  Mesh,
  PerspectiveCamera as PC,
  OrthographicCamera as OC,
} from "three";
import {
  sceneBounds,
  type SceneDocument,
  type SceneObject,
  type Wall,
} from "../../../packages/domain/src/index";
import { useEditor } from "./state";
import { Furniture } from "./Furniture";

type Pose = { position: number[]; target: number[]; zoom: number };
const cameraListeners = new Set<(p: Pose) => void>();
function Floor({ scene }: { scene: SceneDocument }) {
  return (
    <>
      {scene.rooms.map((r) => (
        <group key={r.id}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[r.x + r.width / 2, -0.002, r.z + r.depth / 2]}
            receiveShadow
          >
            <planeGeometry args={[r.width, r.depth]} />
            <meshStandardMaterial
              color={r.floor.color}
              roughness={r.floor.roughness}
            />
          </mesh>
          {Array.from(
            {
              length: Math.ceil(
                r.width / (r.floor.finish === "wood" ? 0.22 : 0.5),
              ),
            },
            (_, i) => {
              const x = r.x + i * (r.floor.finish === "wood" ? 0.22 : 0.5);
              return (
                <mesh
                  key={i}
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[x, 0.002, r.z + r.depth / 2]}
                >
                  <planeGeometry args={[0.008, r.depth]} />
                  <meshStandardMaterial
                    color={r.floor.color}
                    roughness={1}
                    transparent
                    opacity={0.35}
                  />
                </mesh>
              );
            },
          )}
          {r.floor.finish === "wood"
            ? Array.from({ length: Math.ceil(r.width / 0.22) }, (_, i) =>
                [0, 1, 2].map((j) => (
                  <mesh
                    key={`${i}-${j}`}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[
                      r.x + i * 0.22 + 0.11,
                      0.003,
                      r.z + ((j * 1.1 + (i % 3) * 0.35) % r.depth),
                    ]}
                  >
                    <planeGeometry args={[0.218, 0.008]} />
                    <meshStandardMaterial
                      color="#756b59"
                      transparent
                      opacity={0.16}
                    />
                  </mesh>
                )),
              )
            : Array.from({ length: Math.ceil(r.depth / 0.5) }, (_, i) => (
                <mesh
                  key={i}
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[r.x + r.width / 2, 0.003, r.z + i * 0.5]}
                >
                  <planeGeometry args={[r.width, 0.008]} />
                  <meshStandardMaterial
                    color="#9d9b8d"
                    transparent
                    opacity={0.25}
                  />
                </mesh>
              ))}
        </group>
      ))}
    </>
  );
}
function WallMesh({
  wall: w,
  scene,
  cut,
}: {
  wall: Wall;
  scene: SceneDocument;
  cut: boolean;
}) {
  const ref = useRef<Group>(null);
  const view = useEditor((s) => s.view);
  const dx = w.end[0] - w.start[0],
    dz = w.end[1] - w.start[1],
    len = Math.hypot(dx, dz);
  const openings = scene.openings
    .filter((o) => o.wallId === w.id)
    .sort((a, b) => a.offset - b.offset);
  const b = sceneBounds(scene);
  const exterior =
    (Math.abs(w.start[0] - w.end[0]) < 0.01 &&
      (Math.abs(w.start[0] - b.minX) < 0.1 ||
        Math.abs(w.start[0] - b.maxX) < 0.1)) ||
    (Math.abs(w.start[1] - w.end[1]) < 0.01 &&
      (Math.abs(w.start[1] - b.minZ) < 0.1 ||
        Math.abs(w.start[1] - b.maxZ) < 0.1));
  useFrame(({ camera }) => {
    if (!ref.current) return;
    const mid = new Vector3(
      (w.start[0] + w.end[0]) / 2,
      0,
      (w.start[1] + w.end[1]) / 2,
    );
    const normal = new Vector3(
      mid.x - (b.minX + b.maxX) / 2,
      0,
      mid.z - (b.minZ + b.maxZ) / 2,
    );
    const front =
      new Vector3(camera.position.x - mid.x, 0, camera.position.z - mid.z).dot(
        normal,
      ) > 0;
    ref.current.scale.y =
      view === "2d"
        ? 0.04
        : cut && view !== "inside"
          ? exterior
            ? front
              ? 0.075
              : 1
            : 0.42
          : 1;
  });
  const faceColor = (localX: number, side: number) => {
    const x =
        w.start[0] +
        (dx * localX) / len -
        (dz / len) * side * (w.thickness / 2 + 0.04),
      z =
        w.start[1] +
        (dz * localX) / len +
        (dx / len) * side * (w.thickness / 2 + 0.04);
    return (
      scene.rooms.find(
        (r) => x > r.x && x < r.x + r.width && z > r.z && z < r.z + r.depth,
      )?.wallColor || w.color
    );
  };
  const sections: {
    start: number;
    width: number;
    y: number;
    height: number;
  }[] = [];
  let at = 0;
  for (const o of openings) {
    if (o.offset > at)
      sections.push({
        start: at,
        width: o.offset - at,
        y: 0,
        height: w.height,
      });
    if (o.sill > 0)
      sections.push({ start: o.offset, width: o.width, y: 0, height: o.sill });
    if (w.height > o.sill + o.height)
      sections.push({
        start: o.offset,
        width: o.width,
        y: o.sill + o.height,
        height: w.height - o.sill - o.height,
      });
    at = Math.max(at, o.offset + o.width);
  }
  if (at < len)
    sections.push({ start: at, width: len - at, y: 0, height: w.height });
  return (
    <group
      ref={ref}
      position={[w.start[0], 0, w.start[1]]}
      rotation={[0, -Math.atan2(dz, dx), 0]}
    >
      {sections.map((s, i) => (
        <mesh
          key={i}
          position={[s.start + s.width / 2, s.y + s.height / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[s.width, s.height, w.thickness]} />
          <meshStandardMaterial
            attach="material-0"
            color={w.color}
            roughness={0.88}
          />
          <meshStandardMaterial
            attach="material-1"
            color={w.color}
            roughness={0.88}
          />
          <meshStandardMaterial
            attach="material-2"
            color={w.color}
            roughness={0.88}
          />
          <meshStandardMaterial
            attach="material-3"
            color={w.color}
            roughness={0.88}
          />
          <meshStandardMaterial
            attach="material-4"
            color={faceColor(s.start + s.width / 2, 1)}
            roughness={0.88}
          />
          <meshStandardMaterial
            attach="material-5"
            color={faceColor(s.start + s.width / 2, -1)}
            roughness={0.88}
          />
        </mesh>
      ))}
      {openings.map((o) =>
        o.kind === "window" ? (
          <group key={o.id}>
            <mesh position={[o.offset + o.width / 2, o.sill + o.height / 2, 0]}>
              <boxGeometry args={[o.width, o.height, 0.012]} />
              <meshStandardMaterial
                color="#c6d4d0"
                transparent
                opacity={0.17}
                roughness={0.1}
              />
            </mesh>
            {[0, o.width / 2, o.width].map((x) => (
              <mesh key={x} position={[o.offset + x, o.sill + o.height / 2, 0]}>
                <boxGeometry args={[0.026, o.height, 0.05]} />
                <meshStandardMaterial color="#e5e4dc" />
              </mesh>
            ))}
            {[o.sill, o.sill + o.height].map((y) => (
              <mesh key={y} position={[o.offset + o.width / 2, y, 0]}>
                <boxGeometry args={[o.width, 0.035, 0.07]} />
                <meshStandardMaterial color="#dddcd4" />
              </mesh>
            ))}
          </group>
        ) : (
          <group key={o.id}>
            {[o.offset, o.offset + o.width].map((x) => (
              <mesh key={x} position={[x, o.height / 2, 0]}>
                <boxGeometry args={[0.035, o.height, w.thickness + 0.025]} />
                <meshStandardMaterial color="#a9987d" />
              </mesh>
            ))}
            <mesh position={[o.offset + o.width / 2, o.height, 0]}>
              <boxGeometry args={[o.width, 0.035, w.thickness + 0.025]} />
              <meshStandardMaterial color="#a9987d" />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}
function Item({
  object: o,
  interactive,
}: {
  object: SceneObject;
  interactive: boolean;
}) {
  const group = useRef<Group>(null!);
  const { selectedId, transform, mutate, set } = useEditor();
  const selected = selectedId === o.id && interactive;
  const content = (
    <group
      ref={group}
      position={o.position}
      rotation={[0, (o.rotation * Math.PI) / 180, 0]}
      onClick={
        interactive
          ? (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              set({ selectedId: o.id, panel: "properties" });
            }
          : undefined
      }
    >
      <Furniture object={o} />
      {selected && (
        <mesh position={[0, 0.009, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry
            args={[o.dimensions[0] + 0.12, o.dimensions[2] + 0.12]}
          />
          <meshBasicMaterial
            color="#93b578"
            transparent
            opacity={0.24}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
  const finish = async () => {
    const g = group.current;
    if (!g) return;
    const position = g.position.toArray() as [number, number, number];
    const rotation = (g.rotation.y * 180) / Math.PI;
    const dimensions = o.dimensions.map((v, i) => v * g.scale.toArray()[i]) as [
      number,
      number,
      number,
    ];
    await mutate(
      [
        {
          type: "update_object",
          id: o.id,
          changes: { position, rotation, dimensions },
        },
      ],
      `Ajustou ${o.name}`,
    );
    const saved =
      useEditor
        .getState()
        .project?.scene.objects.find((item) => item.id === o.id) || o;
    g.position.fromArray(saved.position);
    g.rotation.set(0, (saved.rotation * Math.PI) / 180, 0);
    g.scale.set(1, 1, 1);
  };
  return (
    <>
      {content}
      {selected && !o.locked && (
        <TransformControls
          object={group}
          mode={transform}
          showY={transform === "rotate" || transform === "scale"}
          showX={transform !== "rotate"}
          showZ={transform !== "rotate"}
          size={0.7}
          onMouseUp={finish}
        />
      )}
    </>
  );
}
function Rig({
  scene,
  interactive,
  sync,
}: {
  scene: SceneDocument;
  interactive: boolean;
  sync: boolean;
}) {
  const { camera, gl, size } = useThree();
  const controls = useRef<any>(null);
  const b = sceneBounds(scene);
  const { view, roomId, set } = useEditor();
  const lastPose = useRef<Pose | undefined>(undefined);
  const moving = useRef(false);
  const targetPosition = useRef(new Vector3());
  const targetLook = useRef(new Vector3());
  const room = scene.rooms.find((r) => r.id === roomId);
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const center = new Vector3(
      room ? room.x + room.width / 2 : (b.minX + b.maxX) / 2,
      0,
      room ? room.z + room.depth / 2 : (b.minZ + b.maxZ) / 2,
    );
    const extent = room
      ? Math.max(room.width, room.depth) * 1.2
      : Math.max(b.width, b.depth);
    targetLook.current.copy(center);
    if (view === "2d") {
      targetPosition.current.set(center.x, 22, center.z + 0.001);
      (camera as OC).zoom = Math.min(
        size.width / (room ? room.width + 1 : b.width + 2),
        size.height / (room ? room.depth + 1 : b.depth + 2),
      );
    } else if (view === "inside") {
      targetPosition.current.set(
        center.x,
        1.55,
        center.z + (room ? room.depth * 0.36 : b.depth * 0.36),
      );
      targetLook.current.set(center.x, 1.4, center.z - 1.5);
    } else {
      const fit = Math.max(1.12, 1.16 / (size.width / size.height));
      targetLook.current.y = 0.45;
      targetPosition.current.set(
        center.x - extent * 0.8 * fit,
        extent * 1.12 * fit,
        center.z + extent * 1.05 * fit,
      );
      (camera as PC).zoom = 1;
    }
    camera.updateProjectionMatrix();
    moving.current = true;
  }, [view, roomId, camera, size.width, size.height, scene.rooms.length]);
  useFrame((_, delta) => {
    if (moving.current && controls.current) {
      camera.position.lerp(targetPosition.current, Math.min(delta * 9, 1));
      controls.current.target.lerp(targetLook.current, Math.min(delta * 9, 1));
      controls.current.update();
      if (camera.position.distanceTo(targetPosition.current) < 0.01)
        moving.current = false;
    }
    if (view === "inside" && keys.current.size && controls.current) {
      const forward = new Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0));
      const move = new Vector3();
      if (keys.current.has("w") || keys.current.has("arrowup"))
        move.add(forward);
      if (keys.current.has("s") || keys.current.has("arrowdown"))
        move.sub(forward);
      if (keys.current.has("d") || keys.current.has("arrowright"))
        move.add(right);
      if (keys.current.has("a") || keys.current.has("arrowleft"))
        move.sub(right);
      move.multiplyScalar(delta * 1.5);
      camera.position.add(move);
      controls.current.target.add(move);
    }
  });
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      keys.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  useEffect(() => {
    if (interactive)
      set({ capture: () => gl.domElement.toDataURL("image/png") });
  }, [gl, camera, interactive]);
  useEffect(() => {
    if (!sync) return;
    const listener = (p: Pose) => {
      if (p === lastPose.current || !controls.current) return;
      moving.current = false;
      camera.position.fromArray(p.position);
      controls.current.target.fromArray(p.target);
      camera.zoom = p.zoom;
      camera.updateProjectionMatrix();
      controls.current.update();
    };
    cameraListeners.add(listener);
    return () => {
      cameraListeners.delete(listener);
    };
  }, [sync, camera]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableRotate={view !== "2d"}
      minDistance={view === "inside" ? 0.15 : 2}
      maxDistance={40}
      minPolarAngle={view === "2d" ? 0 : view === "inside" ? 0.5 : 0.1}
      maxPolarAngle={
        view === "2d" ? 0 : view === "inside" ? 2.5 : Math.PI / 2.1
      }
      minAzimuthAngle={view === "2d" ? 0 : -Infinity}
      maxAzimuthAngle={view === "2d" ? 0 : Infinity}
      enableDamping
      dampingFactor={0.12}
      onStart={() => {
        moving.current = false;
      }}
      onEnd={() => {
        if (sync && controls.current) {
          const p = {
            position: camera.position.toArray(),
            target: controls.current.target.toArray(),
            zoom: camera.zoom,
          };
          lastPose.current = p;
          for (const l of cameraListeners) l(p);
        }
      }}
    />
  );
}
function Scene({
  scene,
  interactive,
  sync,
}: {
  scene: SceneDocument;
  interactive: boolean;
  sync: boolean;
}) {
  const { view, hideWalls, roomId, set } = useEditor();
  const b = sceneBounds(scene);
  const { gl, scene: threeScene, camera } = useThree();
  useEffect(() => {
    if (interactive)
      set({
        capture: () => {
          gl.render(threeScene, camera);
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, 1400 / gl.domElement.width);
          canvas.width = gl.domElement.width * scale;
          canvas.height = gl.domElement.height * scale;
          canvas
            .getContext("2d")!
            .drawImage(gl.domElement, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL("image/png");
        },
      });
  }, [gl, threeScene, camera, interactive]);
  return (
    <>
      {view === "2d" ? (
        <OrthographicCamera
          makeDefault
          position={[b.width / 2, 22, b.depth / 2 + 0.001]}
          zoom={80}
          near={0.01}
          far={200}
        />
      ) : (
        <PerspectiveCamera
          makeDefault
          fov={39}
          position={[-2, 8, 10]}
          near={0.03}
          far={200}
        />
      )}
      <Rig scene={scene} interactive={false} sync={sync} />
      <ambientLight intensity={scene.lighting.time === "day" ? 1.4 : 0.75} />
      <hemisphereLight args={["#f5f4e9", "#b4ad9f", 1.1]} />
      <directionalLight
        position={[-3, 9, -2]}
        intensity={scene.lighting.intensity * 2.5}
        color={scene.lighting.warmth < 4000 ? "#ffdcad" : "#fff9ee"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      <mesh
        position={[(b.minX + b.maxX) / 2, -0.12, (b.minZ + b.maxZ) / 2]}
        receiveShadow
      >
        <boxGeometry args={[b.width + 0.18, 0.22, b.depth + 0.18]} />
        <meshStandardMaterial color="#cac5b7" />
      </mesh>
      <Floor scene={scene} />
      {scene.walls.map((w) => (
        <WallMesh key={w.id} wall={w} scene={scene} cut={hideWalls} />
      ))}
      {[...scene.objects]
        .sort(
          (a, b) => (a.kind === "rug" ? -1 : 0) - (b.kind === "rug" ? -1 : 0),
        )
        .map((o) => (
          <Item
            key={o.id + JSON.stringify(o)}
            object={o}
            interactive={interactive}
          />
        ))}
      {view === "2d" &&
        scene.rooms.map((r) => (
          <Html
            key={r.id}
            center
            position={[r.x + r.width / 2, 0.04, r.z + r.depth / 2]}
            zIndexRange={[5, 0]}
            style={{ pointerEvents: "none" }}
          >
            <span className="room-label">
              {r.name}
              <small>
                {(r.width * r.depth).toFixed(1).replace(".", ",")} m² aprox.
              </small>
            </span>
          </Html>
        ))}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[b.width / 2, -0.24, b.depth / 2]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <shadowMaterial transparent opacity={0.12} />
      </mesh>
    </>
  );
}
export function Viewport({
  scene,
  interactive = true,
  sync = false,
}: {
  scene: SceneDocument;
  interactive?: boolean;
  sync?: boolean;
}) {
  const set = useEditor((s) => s.set);
  return (
    <Canvas
      shadows
      dpr={[1, 1.7]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => interactive && set({ selectedId: undefined })}
      style={{ background: "#e8e6de" }}
    >
      <Suspense fallback={null}>
        <Scene scene={scene} interactive={interactive} sync={sync} />
      </Suspense>
    </Canvas>
  );
}
