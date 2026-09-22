"use client";

import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { getConsoleFunction, setConsoleFunction, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import WebGL from "three/addons/capabilities/WebGL.js";
import { DistrictCamera } from "@/components/district-scene/camera";
import { SceneLoading, type SceneProps } from "@/components/district-scene";
import { bindBuilding, configureLoader, useDetailedBuilding } from "@/components/district-scene/models";
import { Button } from "@/components/ui/button";
import { collection, type ConceptSlug } from "@/lib/collection";
import { selectedSlug } from "@/lib/journey";

type LabelRefs = RefObject<Partial<Record<ConceptSlug, HTMLButtonElement>>>;

// @react-three/fiber 9 (through 9.8) creates a THREE.Clock for every Canvas,
// which three r183 deprecated in favour of THREE.Timer. Only that notice is
// dropped; every other three.js message prints as it would by default.
const threeConsole = getConsoleFunction();
setConsoleFunction((type, message, ...params) => {
  if (type === "warn" && message.startsWith("THREE.Clock: This module has been deprecated")) return;
  if (threeConsole) return threeConsole(type, message, ...params);
  const trace = params[0] as { isStackTrace?: boolean; getError: (message: string) => Error } | undefined;
  if (trace?.isStackTrace) console[type](trace.getError(message));
  else console[type](message, ...params);
});

// Hidden low-detail geometry still intersects rays; clicks pass through it.
function shown(object: Object3D | null) {
  for (; object; object = object.parent) if (!object.visible) return false;
  return true;
}

function DistrictModel({ labels, onReady, ...props }: SceneProps & {
  labels: LabelRefs;
  onReady: (placeholder: boolean) => void;
}) {
  const gltf = useLoader(GLTFLoader, "/models/district-low.glb", configureLoader);
  // useLoader owns the cached resources; each mounted scene owns its graph.
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const lowDetail = useMemo(() => collection.map(({ slug }) => bindBuilding(slug, model)), [model]);
  const invalidate = useThree((state) => state.invalidate);
  const detail = useDetailedBuilding(selectedSlug(props.stage), () => props.onSimpleView("assetFailed"));
  // Selection and label positioning move to the detailed model once it's in.
  const bindings = useMemo(
    () => lowDetail.map((binding) => detail?.slug === binding.slug ? detail : binding),
    [detail, lowDetail],
  );
  const projected = useMemo(() => new Vector3(), []);
  const ready = useRef(false);

  // The detail shares the district's world coordinates, so it replaces the
  // low-detail building in place, within the same frame.
  useLayoutEffect(() => {
    if (!detail) return;
    const replaced = lowDetail.find(({ slug }) => slug === detail.slug)!.target;
    replaced.visible = false;
    invalidate();
    return () => {
      replaced.visible = true;
      invalidate();
    };
  }, [detail, invalidate, lowDetail]);

  useFrame(({ camera, size }) => {
    if (props.stage.name === "residence") return;
    for (const { slug, anchor } of bindings) {
      const label = labels.current[slug];
      if (!label) continue;
      anchor.getWorldPosition(projected).project(camera);
      const x = (projected.x + 1) * size.width / 2;
      const y = (1 - projected.y) * size.height / 2;
      // Offscreen anchors must not leave invisible controls in the tab order.
      const visible = projected.z > -1 && projected.z < 1 &&
        x >= label.offsetWidth / 2 && x <= size.width - label.offsetWidth / 2 &&
        y >= label.offsetHeight && y <= size.height;
      label.style.setProperty("visibility", visible ? "visible" : "hidden");
      label.style.setProperty("transform", `translate(-50%, -100%) translate(${x}px, ${y}px)`);
    }
    if (!ready.current) {
      ready.current = true;
      onReady(gltf.scene.userData.placeholder === true);
    }
  }, -1);

  function select(event: ThreeEvent<MouseEvent>) {
    if (event.delta > 5 || !shown(event.object)) return;
    let object: Object3D | null = event.object;
    while (object) {
      const binding = bindings.find(({ target }) => target === object);
      if (binding) {
        event.stopPropagation();
        const label = labels.current[binding.slug];
        if (label) props.onSelect(binding.slug, label);
        return;
      }
      object = object.parent;
    }
  }

  return (
    <>
      <DistrictCamera {...props} model={model} />
      <primitive object={model} dispose={null} onClick={select} />
      {detail ? <primitive object={detail.model} dispose={null} onClick={select} /> : null}
    </>
  );
}

function Unavailable({ onSimpleView }: Pick<SceneProps, "onSimpleView">) {
  useEffect(() => onSimpleView("unsupported"), [onSimpleView]);
  return null;
}

export default function Scene(props: SceneProps) {
  const [supported] = useState(() => WebGL.isWebGL2Available());
  return supported ? <SupportedScene {...props} /> : <Unavailable onSimpleView={props.onSimpleView} />;
}

function SupportedScene(props: SceneProps) {
  const labels = useRef<Partial<Record<ConceptSlug, HTMLButtonElement>>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [placeholder, setPlaceholder] = useState(false);
  const slug = selectedSlug(props.stage);
  const { onSimpleView } = props;
  const onReady = useCallback((isPlaceholder: boolean) => {
    setPlaceholder(isPlaceholder);
    setReady(true);
  }, []);
  const colors = useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      paper: style.getPropertyValue("--color-paper").trim(),
      sky: style.getPropertyValue("--color-scene-sky-zenith").trim(),
      cloud: style.getPropertyValue("--color-scene-cloud").trim(),
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onContextLost(event: Event) {
      event.preventDefault();
      onSimpleView("contextLost");
    }
    canvas.addEventListener("webglcontextlost", onContextLost);
    return () => canvas.removeEventListener("webglcontextlost", onContextLost);
  }, [onSimpleView]);

  return (
    <>
      {!ready ? <SceneLoading /> : null}
      {placeholder ? (
        <p className="pointer-events-none absolute bottom-4 left-4 z-1 bg-paper-raised px-3 py-2 type-eyebrow text-ink-muted placeholder-hatch">
          Placeholder · District massing
        </p>
      ) : null}
      <Canvas
        ref={canvasRef}
        frameloop={props.stage.name === "residence" ? "never" : "demand"}
        dpr={[1, 1.5]}
        camera={{ fov: 42, near: 0.5, far: 3000 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        style={{ background: `linear-gradient(${colors.sky}, ${colors.paper} 70%)` }}
        onCreated={({ gl }) => {
          // Labels are the keyboard interface; the canvas has no tab stop.
          gl.domElement.setAttribute("aria-hidden", "true");
          gl.domElement.tabIndex = -1;
        }}>
        <fog attach="fog" args={[colors.paper, 500, 1800]} />
        <hemisphereLight args={[colors.cloud, colors.paper, 2]} />
        <directionalLight color={colors.cloud} position={[100, 160, 100]} intensity={2.5} />
        <Suspense fallback={null}>
          <DistrictModel {...props} labels={labels} onReady={onReady} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        {collection.map((concept) => (
          <Button
            key={concept.slug}
            ref={(element) => { labels.current[concept.slug] = element ?? undefined; }}
            variant={slug === concept.slug ? "default" : "outline"}
            className="pointer-events-auto absolute top-0 left-0"
            style={{ visibility: "hidden" }}
            aria-pressed={slug === concept.slug}
            onClick={(event) => props.onSelect(concept.slug, event.currentTarget)}>
            {concept.building.name}
          </Button>
        ))}
      </div>
    </>
  );
}
