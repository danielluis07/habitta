"use client";

import { Canvas, useFrame, useLoader, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import WebGL from "three/addons/capabilities/WebGL.js";
import { DistrictCamera } from "@/components/district-scene/camera";
import { SceneLoading, type SceneProps } from "@/components/district-scene";
import { Button } from "@/components/ui/button";
import { collection, type ConceptSlug } from "@/lib/collection";
import { selectedSlug } from "@/lib/journey";

type LabelRefs = RefObject<Partial<Record<ConceptSlug, HTMLButtonElement>>>;

function configureLoader(loader: GLTFLoader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
}

function DistrictModel({ labels, onReady, ...props }: SceneProps & {
  labels: LabelRefs;
  onReady: (placeholder: boolean) => void;
}) {
  const gltf = useLoader(GLTFLoader, "/models/district-low.glb", configureLoader);
  // useLoader owns the cached resources; each mounted scene owns its graph.
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const bindings = useMemo(() => collection.map((concept) => {
    const target = model.getObjectByName(concept.scene.selectionTarget);
    const anchor = model.getObjectByName(concept.scene.labelAnchor);
    if (!target || !anchor) throw new Error(`Missing scene binding for ${concept.slug}`);
    return { slug: concept.slug, target, anchor };
  }), [model]);
  const projected = useMemo(() => new Vector3(), []);
  const ready = useRef(false);

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
    if (event.delta > 5) return;
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
