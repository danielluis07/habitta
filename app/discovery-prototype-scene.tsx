"use client";

// Throwaway geometry and camera rig for the discovery decision, not final assets.
import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildings, type Variant } from "@/app/discovery-prototype-data";
import { Button } from "@/components/ui/button";

export type SceneHandle = {
  select: (index: number | null) => void;
  arrive: (immediate?: boolean) => void;
  reset: () => void;
  motion: (reduced: boolean) => void;
};

export default function PrototypeScene({ variant, entered, selected, onSelect, apiRef, onReady }: {
  variant: Variant; entered: boolean; selected: number | null;
  onSelect: (index: number) => void; onReady: (reduced: boolean) => void;
  apiRef: RefObject<SceneHandle | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const callbacks = useRef({ onSelect, onReady });
  const [failed, setFailed] = useState(false);
  useEffect(() => { callbacks.current = { onSelect, onReady }; }, [onSelect, onReady]);

  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { queueMicrotask(() => setFailed(true)); callbacks.current.onReady(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xcddbe0, 0);
    element.prepend(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "Three residential concepts in a continuous highland district. Use the named buttons to select a building.");

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xd6e0df, 0.006);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    const overview = new THREE.Vector3(56, 42, 72);
    const overviewTarget = new THREE.Vector3(0, 5, 0);
    camera.position.copy(variant === "A" ? new THREE.Vector3(85, 40, 110) : overview);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(overviewTarget);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 24;
    controls.maxDistance = 130;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI / 2.25;
    let active = variant !== "A";
    controls.enabled = active;
    controls.update();

    const sunlight = new THREE.DirectionalLight(0xffefd8, 3.1);
    sunlight.position.set(-40, 65, 25);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    Object.assign(sunlight.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 180 });
    sunlight.shadow.normalBias = 0.08;
    scene.add(sunlight, new THREE.HemisphereLight(0xe6efff, 0x6d7564, 2.8));

    const stone = new THREE.MeshStandardMaterial({ color: 0xd2cec3, roughness: 0.92 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x547076, roughness: 0.3, metalness: 0.25 });
    const green = new THREE.MeshStandardMaterial({ color: 0x798772, roughness: 1 });
    const road = new THREE.MeshStandardMaterial({ color: 0xbabbb4, roughness: 1 });
    const boxGeometry = new THREE.BoxGeometry();
    function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) {
      const mesh = new THREE.Mesh(boxGeometry, material);
      mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
      mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    }

    // One continuous landscape: the buildings share a road and physical ground.
    const terrainGeometry = new THREE.PlaneGeometry(240, 240, 70, 70);
    terrainGeometry.rotateX(-Math.PI / 2);
    const positions = terrainGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i);
      const distance = Math.hypot(x, z);
      const hills = Math.sin(x * 0.055) * Math.cos(z * 0.045) * 6;
      positions.setY(i, distance < 42 ? -0.4 : -0.4 + hills * Math.min(1, (distance - 42) / 25) - Math.max(0, distance - 60) * 0.13);
    }
    terrainGeometry.computeVertexNormals();
    const terrain = new THREE.Mesh(terrainGeometry, new THREE.MeshStandardMaterial({ color: 0x9ba48c, roughness: 1 }));
    terrain.receiveShadow = true; scene.add(terrain);
    box(scene, 0, -0.15, 14, 95, 0.12, 3.5, road);
    box(scene, 1, -0.12, -8, 3, 0.13, 48, road);

    const groups: THREE.Group[] = [];
    buildings.forEach((building, index) => {
      const group = new THREE.Group(); group.position.set(building.position[0], building.position[1], building.position[2]);
      group.userData.index = index; scene.add(group); groups.push(group);
      const cladding = new THREE.MeshStandardMaterial({ color: building.color, roughness: 0.8 });
      box(group, 0, 0, 0, 16, 0.7, 14, stone);
      const floorHeight = building.height / building.floors;
      for (let floor = 0; floor < building.floors; floor++) {
        const width = index === 0 ? 13 - floor * 1.2 : index === 1 ? 7 : 13;
        const depth = index === 1 ? 7 : 9;
        const x = index === 0 ? -floor * 0.45 : 0;
        const y = floor * floorHeight + 0.8;
        if (index === 2) {
          box(group, -4.5, y + floorHeight / 2, 0, 3.5, floorHeight, depth, glass);
          box(group, 4.5, y + floorHeight / 2, 0, 3.5, floorHeight, depth, glass);
          box(group, 0, y + floorHeight / 2, -3, 6, floorHeight, 3, glass);
          box(group, -4.5, y, 0, 4.5, 0.3, depth + 1, cladding);
          box(group, 4.5, y, 0, 4.5, 0.3, depth + 1, cladding);
          box(group, 0, y, -3.5, 6, 0.3, 3, cladding);
        } else {
          box(group, x, y + floorHeight / 2, 0, width - 1, floorHeight - 0.25, depth - 1, glass);
          box(group, x, y, 0, width + 1.5, 0.3, depth + 1.5, cladding);
          for (let column = -1; column <= 1; column++) {
            box(group, x + column * (width / 2 - 0.6), y + floorHeight / 2, depth / 2 - 0.25, 0.23, floorHeight, 0.3, cladding);
          }
          if (index === 0) box(group, x + width / 2 - 0.4, y + 0.5, 0, 0.65, 0.8, depth, green);
        }
      }
      if (index !== 2) box(group, index === 0 ? -1.8 : 0, building.height + 0.8, 0, index === 0 ? 9 : 8.5, 0.4, index === 0 ? 10.5 : 8.5, cladding);
      box(group, 0, -0.04, 10, 2, 0.1, 6, stone);
    });

    const treeGeometry = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 65; i++) {
      const x = Math.sin(i * 12.73) * 52, z = Math.cos(i * 4.37) * 39;
      if (Math.abs(z - 14) < 4 || Math.abs(x - 1) < 4 || buildings.some(b => Math.abs(x - b.position[0]) < 10 && Math.abs(z - b.position[2]) < 9)) continue;
      const height = 1.6 + (i % 4) * 0.45;
      box(scene, x, height / 2, z, 0.2, height, 0.2, stone);
      const crown = new THREE.Mesh(treeGeometry, green);
      crown.position.set(x, height + 0.5, z); crown.scale.set(1.2, height * 0.8, 1.2);
      crown.castShadow = true; scene.add(crown);
    }

    const cloudCanvas = document.createElement("canvas"); cloudCanvas.width = cloudCanvas.height = 128;
    const context = cloudCanvas.getContext("2d")!;
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(250,251,248,0.7)"); gradient.addColorStop(0.4, "rgba(250,251,248,0.45)"); gradient.addColorStop(1, "rgba(250,251,248,0)");
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
    const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
    const cloudMaterial = new THREE.SpriteMaterial({ map: cloudTexture, transparent: true, depthWrite: false, opacity: 0.65 });
    const clouds: THREE.Sprite[] = [];
    for (let i = 0; i < 34; i++) {
      const cloud = new THREE.Sprite(cloudMaterial);
      const angle = i * 2.399;
      const radius = 52 + (i % 5) * 9;
      cloud.position.set(Math.cos(angle) * radius, -1 + (i % 3), Math.sin(angle) * radius);
      cloud.scale.set(40 + (i % 4) * 8, 13, 1);
      clouds.push(cloud); scene.add(cloud);
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = media.matches;
    let chosen: number | null = null;
    let saved = { position: overview.clone(), target: overviewTarget.clone() };
    let movement: { start: number; from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3; duration: number } | null = null;
    const travel = (position: THREE.Vector3, target: THREE.Vector3, immediate = false) => {
      controls.enabled = false;
      if (reduced || immediate) { camera.position.copy(position); controls.target.copy(target); movement = null; controls.enabled = active; controls.update(); }
      else movement = { start: performance.now(), from: camera.position.clone(), to: position.clone(), targetFrom: controls.target.clone(), targetTo: target.clone(), duration: 1500 };
    };
    const setMotion = (value: boolean) => {
      reduced = value; controls.enableDamping = !value;
      if (value && movement) travel(movement.to, movement.targetTo, true);
    };
    setMotion(reduced);
    apiRef.current = {
      select(index) {
        if (chosen === null && index !== null) saved = { position: camera.position.clone(), target: controls.target.clone() };
        chosen = index;
        if (index === null) { travel(saved.position, saved.target); return; }
        const building = buildings[index];
        const target = new THREE.Vector3(building.position[0], building.height * 0.45, building.position[2]);
        travel(target.clone().add(new THREE.Vector3(25, 13, 34)), target);
      },
      arrive(immediate = false) { active = true; travel(overview, overviewTarget, immediate); },
      reset() { chosen = null; saved = { position: overview.clone(), target: overviewTarget.clone() }; active = true; travel(overview, overviewTarget); },
      motion: setMotion,
    };
    const onMotion = () => { setMotion(media.matches); callbacks.current.onReady(media.matches); };
    media.addEventListener("change", onMotion);
    callbacks.current.onReady(reduced);

    const resize = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      renderer.setSize(width, height); camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix();
    });
    resize.observe(element);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
    const pointerUp = (event: PointerEvent) => {
      if (!active || movement || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(groups, true)[0];
      if (hit) {
        let object = hit.object;
        while (object.parent && object.userData.index === undefined) object = object.parent;
        if (object.userData.index !== undefined) callbacks.current.onSelect(object.userData.index);
      }
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const projected = new THREE.Vector3();
    let previousTime = 0;
    renderer.setAnimationLoop((time) => {
      const delta = Math.min((time - previousTime) / 1000, 0.05); previousTime = time;
      if (movement) {
        const progress = Math.min((performance.now() - movement.start) / movement.duration, 1);
        const eased = progress * progress * (3 - 2 * progress);
        camera.position.lerpVectors(movement.from, movement.to, eased);
        controls.target.lerpVectors(movement.targetFrom, movement.targetTo, eased);
        if (progress === 1) { movement = null; controls.enabled = active; }
      }
      controls.update();
      clouds.forEach((cloud) => { if (!reduced) cloud.position.x += delta * 0.12; if (cloud.position.x > 100) cloud.position.x = -100; });
      buildings.forEach((building, index) => {
        const label = labels.current[index]; if (!label) return;
        projected.set(building.position[0], building.height + 3, building.position[2]).project(camera);
        label.style.left = `${(projected.x + 1) * 50}%`; label.style.top = `${(-projected.y + 1) * 50}%`;
        label.style.visibility = projected.z > 1 || Math.abs(projected.x) > 0.96 || Math.abs(projected.y) > 0.9 ? "hidden" : "visible";
      });
      renderer.render(scene, camera);
    });
    return () => {
      apiRef.current = null; resize.disconnect(); media.removeEventListener("change", onMotion);
      renderer.setAnimationLoop(null); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
      scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        if (object instanceof THREE.Mesh) geometries.add(object.geometry);
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
      } });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); cloudTexture.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [apiRef, variant]);

  return <div ref={host} className="prototype-scene">
    {failed ? <p className="scene-failure">The 3D view is unavailable on this device. You can still explore every concept using the building index.</p> : null}
    <div className="scene-labels" hidden={!entered || failed}>
      {buildings.map((building, index) => <div className="scene-label" ref={node => { labels.current[index] = node; }} key={building.name}>
        <Button variant={selected === index ? "default" : "outline"} onClick={() => onSelect(index)} aria-label={`Select ${building.name}`} aria-pressed={selected === index}>{building.name}<span aria-hidden="true">↗</span></Button>
        <span className="label-stem" />
      </div>)}
    </div>
  </div>;
}
