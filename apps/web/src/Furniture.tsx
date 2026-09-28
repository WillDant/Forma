import { useMemo, useEffect } from "react";
import { MeshStandardMaterial, Color } from "three";
import { RoundedBox } from "@react-three/drei";
import type { SceneObject, Material } from "../../../packages/domain/src/index";
type Vec = [number, number, number];
export function Furniture({ object: o }: { object: SceneObject }) {
  const [w, h, d] = o.dimensions;
  const materials = useMemo(() => {
    const make = (m: Material) =>
      new MeshStandardMaterial({
        color: m.color,
        roughness: m.roughness,
        metalness: m.finish === "metal" ? 0.65 : 0,
        transparent: m.finish === "glass",
        opacity: m.finish === "glass" ? 0.24 : 1,
      });
    const base = make(o.material);
    const part = (key: string, c: string) =>
      o.parts[key]
        ? make(o.parts[key])
        : new MeshStandardMaterial({ color: c, roughness: 0.82 });
    return {
      base,
      frame: part("frame", "#a88760"),
      legs: part("legs", "#776346"),
      accent: part("accent", "#8e9a7a"),
      fabric: part("fabric", o.material.color),
      white: part("bedding", "#efede5"),
      dark: part("detail", "#353c38"),
      top: part("top", o.material.color),
      glass: make({ color: "#bbd2d1", finish: "glass", roughness: 0.06 }),
    };
  }, [o.material, o.parts]);
  useEffect(
    () => () => {
      for (const material of new Set(Object.values(materials)))
        material.dispose();
    },
    [materials],
  );
  const B = ({
    size,
    pos = [0, 0, 0],
    m = materials.base,
    r = 0,
  }: {
    size: Vec;
    pos?: Vec;
    m?: MeshStandardMaterial;
    r?: number;
  }) =>
    r ? (
      <RoundedBox
        args={size}
        radius={Math.min(r, ...size.map((v) => v / 3))}
        smoothness={2}
        position={pos}
        castShadow
        receiveShadow
        material={m}
      />
    ) : (
      <mesh position={pos} castShadow receiveShadow material={m}>
        <boxGeometry args={size} />
      </mesh>
    );
  const C = ({
    radius,
    height,
    pos = [0, 0, 0],
    m = materials.base,
    r2,
  }: {
    radius: number;
    height: number;
    pos?: Vec;
    m?: MeshStandardMaterial;
    r2?: number;
  }) => (
    <mesh position={pos} castShadow receiveShadow material={m}>
      <cylinderGeometry args={[radius, r2 ?? radius, height, 32]} />
    </mesh>
  );
  const legs = (y = h * 0.4) =>
    [-1, 1].flatMap((x) =>
      [-1, 1].map((z) => (
        <B
          key={`${x}${z}`}
          size={[0.045, y, 0.045]}
          pos={[x * w * 0.39, y / 2, z * d * 0.36]}
          m={materials.legs}
        />
      )),
    );
  if (o.kind === "sofa")
    return (
      <>
        {legs(0.12)}
        <B size={[w, h * 0.26, d * 0.9]} pos={[0, h * 0.25, 0]} r={0.05} />
        <B
          size={[w, h * 0.78, d * 0.18]}
          pos={[0, h * 0.55, -d * 0.39]}
          r={0.06}
        />
        {[-1, 1].map((x) => (
          <B
            key={x}
            size={[w * 0.1, h * 0.65, d]}
            pos={[x * w * 0.45, h * 0.43, 0]}
            r={0.04}
          />
        ))}
        {[-1, 1].map((x) => (
          <group key={x}>
            <B
              size={[w * 0.38, h * 0.17, d * 0.71]}
              pos={[x * w * 0.2, h * 0.44, d * 0.07]}
              m={materials.fabric}
              r={0.05}
            />
            <B
              size={[w * 0.36, h * 0.35, d * 0.15]}
              pos={[x * w * 0.2, h * 0.72, -d * 0.22]}
              m={materials.fabric}
              r={0.05}
            />
          </group>
        ))}
        <B
          size={[w * 0.16, h * 0.3, d * 0.19]}
          pos={[-w * 0.28, h * 0.68, d * 0.05]}
          m={materials.accent}
          r={0.05}
        />
      </>
    );
  if (o.kind === "bed")
    return (
      <>
        <B
          size={[w, 0.17, d]}
          pos={[0, 0.17, 0]}
          m={materials.frame}
          r={0.025}
        />
        <B
          size={[w, h * 0.9, 0.08]}
          pos={[0, h * 0.57, -d / 2 + 0.04]}
          m={materials.frame}
          r={0.025}
        />
        <B
          size={[w * 0.96, h * 0.42, d * 0.96]}
          pos={[0, h * 0.55, 0]}
          m={materials.white}
          r={0.06}
        />
        <B
          size={[w * 0.98, 0.055, d * 0.59]}
          pos={[0, h * 0.8, d * 0.18]}
          m={materials.fabric}
          r={0.04}
        />
        <B
          size={[w, 0.03, d * 0.17]}
          pos={[0, h * 0.86, d * 0.29]}
          m={materials.accent}
          r={0.015}
        />
        {(w > 1.15 ? [-1, 1] : [0]).map((x) => (
          <B
            key={x}
            size={[w > 1.15 ? w * 0.42 : w * 0.75, 0.115, d * 0.21]}
            pos={[x * w * 0.24, h * 0.84, -d * 0.32]}
            m={materials.white}
            r={0.05}
          />
        ))}
      </>
    );
  if (o.kind === "table")
    return (
      <>
        <C
          radius={Math.min(w, d) / 2}
          height={0.045}
          pos={[0, h - 0.025, 0]}
          m={materials.top}
        />
        <C
          radius={w * 0.16}
          r2={w * 0.22}
          height={h - 0.06}
          pos={[0, (h - 0.06) / 2, 0]}
          m={materials.frame}
        />
      </>
    );
  if (o.kind === "chair")
    return (
      <>
        {legs(h * 0.54)}
        <B
          size={[w, 0.065, d]}
          pos={[0, h * 0.57, 0]}
          m={materials.fabric}
          r={0.04}
        />
        <B
          size={[w, h * 0.4, 0.07]}
          pos={[0, h * 0.79, -d * 0.43]}
          m={materials.frame}
          r={0.04}
        />
      </>
    );
  if (["wardrobe", "cabinet", "counter"].includes(o.kind))
    return (
      <>
        <B size={[w, h, d]} pos={[0, h / 2, 0]} m={materials.frame} r={0.012} />
        {[-1, 1].map((x) => (
          <group key={x}>
            <B
              size={[w / 2 - 0.015, h - 0.04, 0.035]}
              pos={[x * w * 0.25, h / 2, d * 0.5]}
              m={materials.base}
            />
            <B
              size={[0.016, Math.min(0.2, h * 0.24), 0.018]}
              pos={[x * 0.03, h * 0.57, d * 0.5 + 0.027]}
              m={materials.dark}
            />
          </group>
        ))}
        <B
          size={[w + 0.025, 0.025, d + 0.025]}
          pos={[0, h, 0]}
          m={materials.top}
        />
      </>
    );
  if (o.kind === "fridge")
    return (
      <>
        <B size={[w, h, d]} pos={[0, h / 2, 0]} r={0.028} />
        <B
          size={[w * 0.95, 0.018, 0.015]}
          pos={[0, h * 0.69, d * 0.505]}
          m={materials.dark}
        />
        <B
          size={[0.025, h * 0.24, 0.04]}
          pos={[-w * 0.32, h * 0.46, d * 0.52]}
          m={materials.dark}
        />
      </>
    );
  if (o.kind === "stove")
    return (
      <>
        <B size={[w, h, d]} pos={[0, h / 2, 0]} />
        <B
          size={[w * 0.77, h * 0.51, 0.015]}
          pos={[0, h * 0.4, d * 0.51]}
          m={materials.dark}
          r={0.02}
        />
        <B
          size={[w * 0.75, 0.025, 0.04]}
          pos={[0, h * 0.72, d * 0.55]}
          m={materials.frame}
        />
        {[-1, 1].flatMap((x) =>
          [-1, 1].map((z) => (
            <C
              key={`${x}${z}`}
              radius={w * 0.14}
              height={0.02}
              pos={[x * w * 0.24, h + 0.01, z * d * 0.23]}
              m={materials.dark}
            />
          )),
        )}
      </>
    );
  if (o.kind === "washer")
    return (
      <>
        <B size={[w, h, d]} pos={[0, h / 2, 0]} r={0.02} />
        <group
          position={[0, h * 0.45, d * 0.51]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <C radius={w * 0.34} height={0.04} m={materials.dark} />
          <C radius={w * 0.26} height={0.048} m={materials.glass} />
        </group>
        <B
          size={[w * 0.5, 0.055, 0.02]}
          pos={[-w * 0.1, h * 0.88, d * 0.51]}
          m={materials.dark}
        />
      </>
    );
  if (o.kind === "sink")
    return (
      <>
        {h > 0.2 && (
          <B
            size={[w * 0.9, h * 0.85, d * 0.85]}
            pos={[0, h * 0.43, 0]}
            m={materials.frame}
          />
        )}
        <B size={[w, 0.07, d]} pos={[0, h - 0.035, 0]} r={0.03} />
        <B
          size={[w * 0.72, 0.015, d * 0.65]}
          pos={[0, h + 0.003, 0]}
          m={materials.glass}
          r={0.035}
        />
        <C
          radius={0.013}
          height={0.15}
          pos={[0, h + 0.075, -d * 0.32]}
          m={materials.dark}
        />
        <B
          size={[0.027, 0.027, 0.1]}
          pos={[0, h + 0.15, -d * 0.25]}
          m={materials.dark}
        />
      </>
    );
  if (o.kind === "toilet")
    return (
      <>
        <B
          size={[w * 0.9, h * 0.9, d * 0.26]}
          pos={[0, h * 0.55, -d * 0.35]}
          r={0.05}
        />
        <C
          radius={w * 0.36}
          r2={w * 0.27}
          height={h * 0.51}
          pos={[0, h * 0.26, d * 0.1]}
        />
        <mesh
          position={[0, h * 0.55, d * 0.1]}
          scale={[w * 0.5, 0.08, d * 0.44]}
          material={materials.base}
          castShadow
        >
          <sphereGeometry args={[1, 24, 12]} />
        </mesh>
      </>
    );
  if (o.kind === "shower")
    return (
      <>
        <B size={[w, 0.035, d]} pos={[0, 0.02, 0]} m={materials.white} />
        <B size={[0.015, h, d]} pos={[w / 2, h / 2, 0]} m={materials.glass} />
        <B size={[w, h, 0.015]} pos={[0, h / 2, d / 2]} m={materials.glass} />
        <B size={[w, 0.025, 0.025]} pos={[0, h, d / 2]} m={materials.dark} />
        <C
          radius={0.009}
          height={h * 0.8}
          pos={[w * 0.33, h * 0.5, -d * 0.43]}
          m={materials.dark}
        />
        <C
          radius={0.09}
          height={0.02}
          pos={[w * 0.23, h * 0.91, -d * 0.3]}
          m={materials.dark}
        />
      </>
    );
  if (o.kind === "rug")
    return (
      <>
        <B size={[w, h, d]} pos={[0, h / 2, 0]} r={0.03} />
        {[-1, 1].map((x) => (
          <B
            key={x}
            size={[0.025, 0.003, d * 0.91]}
            pos={[x * w * 0.44, h + 0.003, 0]}
            m={materials.white}
          />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <B
            key={i}
            size={[w * 0.86, 0.002, 0.004]}
            pos={[0, h + 0.005, -d * 0.43 + i * d * 0.078]}
            m={materials.white}
          />
        ))}
      </>
    );
  if (o.kind === "plant")
    return (
      <>
        <C
          radius={w * 0.28}
          r2={w * 0.22}
          height={h * 0.25}
          pos={[0, h * 0.125, 0]}
          m={materials.frame}
        />
        <C
          radius={0.013}
          height={h * 0.6}
          pos={[0, h * 0.51, 0]}
          m={materials.legs}
        />
        {Array.from({ length: 9 }, (_, i) => {
          const a = i * 2.4;
          return (
            <mesh
              key={i}
              position={[
                Math.sin(a) * w * 0.25,
                h * (0.38 + i * 0.065),
                Math.cos(a) * d * 0.24,
              ]}
              rotation={[0.35, a, 0.5]}
              scale={[w * 0.22, h * 0.16, d * 0.1]}
              material={materials.base}
              castShadow
            >
              <sphereGeometry args={[1, 12, 8]} />
            </mesh>
          );
        })}
      </>
    );
  if (o.kind === "lamp")
    return (
      <>
        <C
          radius={w * 0.4}
          height={0.035}
          pos={[0, 0.02, 0]}
          m={materials.dark}
        />
        <C
          radius={0.012}
          height={h * 0.76}
          pos={[0, h * 0.38, 0]}
          m={materials.dark}
        />
        <C
          radius={w * 0.34}
          r2={w * 0.5}
          height={h * 0.25}
          pos={[0, h * 0.86, 0]}
          m={materials.fabric}
        />
        <mesh position={[0, h * 0.8, 0]}>
          <sphereGeometry args={[w * 0.1, 12, 8]} />
          <meshStandardMaterial
            color="#fff4cc"
            emissive="#ffdba0"
            emissiveIntensity={0.6}
          />
        </mesh>
      </>
    );
  if (o.kind === "curtain")
    return (
      <>
        {Array.from({ length: 16 }, (_, i) => (
          <B
            key={i}
            size={[w / 16 + 0.009, h, d]}
            pos={[
              -w / 2 + w / 32 + (i * w) / 16,
              h / 2,
              Math.sin((i * Math.PI) / 2) * 0.025,
            ]}
            m={materials.fabric}
            r={0.012}
          />
        ))}
      </>
    );
  if (o.kind === "art")
    return (
      <>
        <B size={[w, h, d]} pos={[0, h / 2, 0]} m={materials.frame} />
        <B
          size={[w * 0.87, h * 0.91, 0.006]}
          pos={[0, h / 2, d * 0.55]}
          m={materials.white}
        />
        <mesh position={[0, h * 0.53, d * 0.6]} scale={[w * 0.29, h * 0.32, 1]}>
          <circleGeometry args={[1, 32]} />
          <meshStandardMaterial color={o.material.color} />
        </mesh>
      </>
    );
  if (o.kind === "tv")
    return (
      <>
        <B size={[w, h, d]} pos={[0, h / 2, 0]} m={materials.dark} r={0.018} />
        <B
          size={[w * 0.95, h * 0.92, 0.004]}
          pos={[0, h / 2, d * 0.6]}
          m={materials.glass}
        />
      </>
    );
  if (o.kind === "shelf")
    return (
      <>
        {[-1, 1].map((x) => (
          <B
            key={x}
            size={[0.035, h, d]}
            pos={[(x * w) / 2, h / 2, 0]}
            m={materials.frame}
          />
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((y) => (
          <B
            key={y}
            size={[w, 0.03, d]}
            pos={[0, h * y + 0.015, 0]}
            m={materials.frame}
          />
        ))}
        {[0.32, 0.6, 0.85].map((y, i) => (
          <B
            key={y}
            size={[w * 0.36, h * 0.18, d * 0.8]}
            pos={[i % 2 ? w * 0.15 : -w * 0.15, h * y, 0]}
            m={i % 2 ? materials.accent : materials.white}
          />
        ))}
      </>
    );
  return <B size={[w, h, d]} pos={[0, h / 2, 0]} />;
}
