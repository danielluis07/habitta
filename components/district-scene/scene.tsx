"use client";

import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { getConsoleFunction, NeutralToneMapping, setConsoleFunction, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import WebGL from "three/addons/capabilities/WebGL.js";
import { Atmosphere, cameraFar, type AtmosphereColors } from "@/components/district-scene/atmosphere";
import { DistrictCamera } from "@/components/district-scene/camera";
import { QualityEffects } from "@/components/district-scene/effects";
import { useEnvironment } from "@/components/district-scene/environment";
import { SceneLoading, type SceneProps } from "@/components/district-scene";
import { bindBuilding, configureLoader, shade, useDetailedBuilding } from "@/components/district-scene/models";
import {
  FrameRateMonitor, initialTier, lowerTier, qualityTiers, readDevice, rendererName, type QualityTier, type TierSettings,
} from "@/components/district-scene/quality";
import { Button } from "@/components/ui/button";
import { collection, type ConceptSlug } from "@/lib/collection";
import { selectedSlug } from "@/lib/journey";

type LabelRefs = RefObject<Partial<Record<ConceptSlug, HTMLButtonElement>>>;

// On Windows, ANGLE compiles shaders as Direct3D HLSL, and three.js prints
// the compiler's notes. Two come from shaders the scene uses but doesn't own,
// and change nothing on screen: three.js's PMREM prefilter folds constants
// with a rounding note (X4122), and N8AO's denoise blur samples inside a
// loop, where derivatives are undefined (X3595), from targets with no mips.
const benignShaderNote = /^\(\d+,\d+(-\d+)?\): warning X(4122|3595): /;
function benignProgramLog(message: string, log: unknown) {
  // ANGLE ends its logs with a NUL character.
  return message === "THREE.WebGLProgram: Program Info Log:" && typeof log === "string" &&
    log.replaceAll("\0", "").split("\n").every((line) => !line.trim() || benignShaderNote.test(line.trim()));
}

// @react-three/fiber 9 (through 9.8) creates a THREE.Clock for every Canvas,
// which three r183 deprecated in favour of THREE.Timer. That notice and the
// shader notes above are dropped; every other three.js message prints as it
// would by default.
const threeConsole = getConsoleFunction();
setConsoleFunction((type, message, ...params) => {
  if (type === "warn" && message.startsWith("THREE.Clock: This module has been deprecated")) return;
  if (type === "warn" && benignProgramLog(message, params[0])) return;
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

function DistrictModel({ labels, onReady, onMotionFrame, environmentUpgrade, ...props }: SceneProps & {
  labels: LabelRefs;
  onReady: (placeholder: boolean) => void;
  onMotionFrame: (seconds: number) => void;
  /** A better environment map to fetch once the scene has opened. */
  environmentUpgrade: string | null;
}) {
  const gltf = useLoader(GLTFLoader, "/models/district-low.glb", configureLoader);
  const environment = useEnvironment(environmentUpgrade);
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

  // Before a model's first frame, and again when a better map arrives.
  useLayoutEffect(() => {
    shade(model, environment);
    if (detail) shade(detail.model, environment);
    invalidate();
  }, [detail, environment, invalidate, model]);

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
    const { top, right, bottom, left } = props.clearance;
    for (const { slug, anchor } of bindings) {
      const label = labels.current[slug];
      if (!label) continue;
      anchor.getWorldPosition(projected).project(camera);
      const x = (projected.x + 1) * size.width / 2;
      const y = (1 - projected.y) * size.height / 2;
      // Anchors offscreen or under the page's own layers must not leave
      // hidden controls in the tab order.
      const visible = projected.z > -1 && projected.z < 1 &&
        x >= left + label.offsetWidth / 2 && x <= size.width - right - label.offsetWidth / 2 &&
        y >= top + label.offsetHeight && y <= size.height - bottom;
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
      <DistrictCamera {...props} model={model} onMotionFrame={onMotionFrame} />
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
  // The tier is chosen once the renderer names its GPU, and the scene waits
  // for it, so nothing is drawn or allocated for another tier. It only ever
  // steps down after that.
  const [device] = useState(readDevice);
  const [tier, setTier] = useState<QualityTier | null>(null);
  const settings: TierSettings = qualityTiers[tier ?? "base"];
  const [monitor] = useState(() => new FrameRateMonitor());
  const onMotionFrame = useCallback((seconds: number) => {
    const lower = tier && lowerTier(tier);
    if (!lower || !monitor.sample(seconds)) return;
    monitor.reset();
    setTier(lower);
  }, [monitor, tier]);
  useEffect(() => {
    // Frames stop while the tab is hidden; the first one back isn't slow.
    const onVisibility = () => { if (document.hidden) monitor.pause(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [monitor]);
  // The desktop pack waits until the scene has opened.
  const environmentUpgrade = ready && settings.environmentMap !== qualityTiers.base.environmentMap
    ? settings.environmentMap
    : null;
  const colors = useMemo((): AtmosphereColors => {
    const style = getComputedStyle(document.documentElement);
    const token = (name: string) => style.getPropertyValue(`--color-scene-${name}`).trim();
    return { haze: token("haze"), zenith: token("sky-zenith"), sun: token("sun"), ground: token("terrain-grass") };
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
        dpr={[1, settings.maxPixelRatio]}
        // PCF shadow maps, drawn only while the tier's sun casts a shadow.
        shadows="percentage"
        camera={{ fov: 42, near: 0.5, far: cameraFar }}
        // Khronos PBR Neutral keeps the buildings' true material hues; the
        // warmth comes from the sun, not from a tint over the image.
        gl={{ antialias: true, alpha: true, powerPreference: "low-power", toneMapping: NeutralToneMapping }}
        style={{ background: colors.haze }}
        onCreated={({ gl }) => {
          // Labels are the keyboard interface; the canvas has no tab stop.
          gl.domElement.setAttribute("aria-hidden", "true");
          gl.domElement.tabIndex = -1;
          setTier(initialTier({ ...device, renderer: rendererName(gl.getContext()) }));
        }}>
        {tier ? (
          <>
            <Atmosphere colors={colors} shadows={settings.shadows} />
            <Suspense fallback={null}>
              <DistrictModel
                {...props}
                labels={labels}
                onReady={onReady}
                onMotionFrame={onMotionFrame}
                environmentUpgrade={environmentUpgrade} />
            </Suspense>
            <QualityEffects settings={settings} />
          </>
        ) : null}
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
