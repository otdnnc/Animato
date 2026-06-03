import type {
  ModelFrame,
  ModelInfo,
  SceneNode,
  UploadedModel,
  Vec3,
} from "@/types/model";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

interface ThreeViewerProps {
  model: UploadedModel;
  activeClipIndex: number | null;
  isPlaying: boolean;
  onLoaded: (info: ModelInfo) => void;
  onError: (message: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

function getExtension(name: string) {
  const dot = name.lastIndexOf(".");

  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

const RAD2DEG = 180 / Math.PI;

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;

  // Normalize -0 to 0 so the serialized text stays clean.
  return (Math.round(value * factor) || 0) / factor;
}

/**
 * Best-effort semantic label for a bone from its name, so the AI knows which
 * physical body part a bone drives (and which side). Heuristic; covers common
 * Mixamo / standard humanoid naming. Order matters: most specific first.
 */
function inferRole(raw: string): string | undefined {
  const n = raw.toLowerCase();

  const side = /left|(^|[_.])l([_.\d]|$)/.test(n)
    ? "left "
    : /right|(^|[_.])r([_.\d]|$)/.test(n)
      ? "right "
      : "";

  const part = /thumb|index|middle|ring|pinky|finger/.test(n)
    ? "finger"
    : /toe/.test(n)
      ? "toes"
      : /foot|ankle/.test(n)
        ? "foot/ankle"
        : /upleg|thigh|upperleg/.test(n)
          ? "upper leg (hip joint)"
          : /leg|shin|calf|knee/.test(n)
            ? "lower leg (knee)"
            : /forearm|lowerarm/.test(n)
              ? "forearm (elbow)"
              : /(upper)?arm|shoulder|clavicle/.test(n)
                ? "upper arm/shoulder"
                : /hand|wrist/.test(n)
                  ? "hand"
                  : /head/.test(n)
                    ? "head"
                    : /neck/.test(n)
                      ? "neck"
                      : /spine|chest|back/.test(n)
                        ? "spine/torso"
                        : /hip|pelvis|root/.test(n)
                          ? "hips/root"
                          : undefined;

  return part ? (side + part).trim() : undefined;
}

/**
 * For a small POSITIVE rotation about the bone's local X/Y/Z axis, return the
 * unit WORLD direction the bone's tip (first child) moves. Temporarily rotates
 * the bone and reconstructs its world matrix manually (no global mutation), so
 * the result tells the AI which axis & sign actually produce a desired motion.
 */
function computeAxisProbes(
  bone: THREE.Object3D,
  childBone: THREE.Object3D,
): [Vec3, Vec3, Vec3] {
  const parentWorld = bone.parent
    ? bone.parent.matrixWorld
    : new THREE.Matrix4();
  const restQuat = bone.quaternion.clone();
  const childLocal = childBone.position.clone();
  const mat = new THREE.Matrix4();
  const delta = new THREE.Quaternion();
  const angle = (12 * Math.PI) / 180;

  const tipWorld = (q: THREE.Quaternion) => {
    bone.quaternion.copy(q);
    bone.updateMatrix();
    mat.multiplyMatrices(parentWorld, bone.matrix);

    return childLocal.clone().applyMatrix4(mat);
  };

  const rest = tipWorld(restQuat);
  const axes: Vec3[] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  const probes = axes.map((ax): Vec3 => {
    const test = restQuat
      .clone()
      .multiply(delta.setFromAxisAngle(new THREE.Vector3(...ax), angle));
    const moved = tipWorld(test).sub(rest);

    if (moved.lengthSq() < 1e-10) return [0, 0, 0];
    moved.normalize();

    return [round(moved.x, 2), round(moved.y, 2), round(moved.z, 2)];
  }) as [Vec3, Vec3, Vec3];

  // Restore the bone's rest transform.
  bone.quaternion.copy(restQuat);
  bone.updateMatrix();

  return probes;
}

function buildBoneTree(root: THREE.Object3D): SceneNode[] {
  root.updateMatrixWorld(true);

  const worldOf = (b: THREE.Object3D) =>
    b.getWorldPosition(new THREE.Vector3());

  const isBoneNode = (c: THREE.Object3D) => (c as THREE.Bone).isBone;

  // FBX rigs (incl. Mixamo) often carry zero-length helper/end bones that sit
  // exactly on their parent and DUPLICATE its name. They have no length, they
  // break direction/probe math (a point at the bone's own origin never moves,
  // so probes come out [0,0,0]), and they double the tree. Treat a childless
  // bone at ~zero local offset as degenerate and drop it from the skeleton.
  const isDegenerate = (b: THREE.Object3D) =>
    !b.children.some(isBoneNode) && b.position.length() < 1e-4;

  const fromBone = (bone: THREE.Object3D, parentName?: string): SceneNode => {
    const childBones = bone.children
      .filter(isBoneNode)
      .filter((c) => !isDegenerate(c));
    const wp = worldOf(bone);
    const name = bone.name || "(unnamed)";

    const node: SceneNode = {
      name,
      type: bone.type,
      childCount: childBones.length,
      position: [
        round(bone.position.x),
        round(bone.position.y),
        round(bone.position.z),
      ],
      rotation: [
        round(bone.rotation.x * RAD2DEG, 2),
        round(bone.rotation.y * RAD2DEG, 2),
        round(bone.rotation.z * RAD2DEG, 2),
      ],
      quaternion: [
        round(bone.quaternion.x, 5),
        round(bone.quaternion.y, 5),
        round(bone.quaternion.z, 5),
        round(bone.quaternion.w, 5),
      ],
      scale: [round(bone.scale.x), round(bone.scale.y), round(bone.scale.z)],
      worldPosition: [round(wp.x, 3), round(wp.y, 3), round(wp.z, 3)],
      children: childBones.map((child) => fromBone(child, name)),
    };

    if (parentName) node.parent = parentName;

    const role = inferRole(name);

    if (role) node.role = role;

    // World-space rest rotation, so a world-space pose intent can be converted
    // into the local delta a keyframe quaternion needs.
    const wq = bone.getWorldQuaternion(new THREE.Quaternion());

    node.worldQuaternion = [
      round(wq.x, 5),
      round(wq.y, 5),
      round(wq.z, 5),
      round(wq.w, 5),
    ];

    // Full world matrix (THREE column-major 16 floats) — the exact ground-truth
    // transform incl. baked FBX scale, for AIs that ask for matrixWorld.elements.
    node.worldMatrix = bone.matrixWorld.elements.map((n) => round(n, 4));

    // Direction "down the bone" = toward its first child.
    if (childBones.length) {
      const dir = worldOf(childBones[0]).sub(wp);
      const len = dir.length();

      if (len > 1e-6) {
        const u = dir.clone().normalize();

        node.childDirection = [round(u.x, 3), round(u.y, 3), round(u.z, 3)];
        node.length = round(len, 3);
      }

      // A child bone's local position is already expressed in THIS bone's local
      // frame, so normalizing it gives the bone's long axis in the space its
      // keyframe quaternions act in — the key to choosing twist vs bend axes.
      const local = childBones[0].position;
      const localLen = local.length();

      if (localLen > 1e-6) {
        node.localChildDir = [
          round(local.x / localLen, 3),
          round(local.y / localLen, 3),
          round(local.z / localLen, 3),
        ];
      }

      // Per-axis world-direction probes, so the AI picks the right rotation axis
      // & sign instead of guessing (fixes limbs that bend backward or swap
      // left/right). Computed for EVERY bone with a tip regardless of whether the
      // role heuristic matched — so legs/arms always carry tip+X/+Y/+Z. Skip only
      // fingers/toes (by name) to keep the prompt lean.
      if (
        !/thumb|index|middle|ring|pinky|finger|toe/.test(name.toLowerCase())
      ) {
        node.axisProbes = computeAxisProbes(bone, childBones[0]);
      }
    }

    return node;
  };

  const roots: SceneNode[] = [];

  root.traverse((obj) => {
    const isBone = (obj as THREE.Bone).isBone;
    const parentIsBone = obj.parent ? (obj.parent as THREE.Bone).isBone : false;

    if (isBone && !parentIsBone) roots.push(fromBone(obj));
  });

  return roots;
}

/** Capture the model's global orientation/units for direction reasoning. */
function buildModelFrame(
  root: THREE.Object3D,
  sizeWorld: THREE.Vector3,
): ModelFrame {
  root.updateMatrixWorld(true);

  // Up axis = tallest bounding-box dimension.
  const upAxis: Vec3 =
    sizeWorld.y >= sizeWorld.x && sizeWorld.y >= sizeWorld.z
      ? [0, 1, 0]
      : sizeWorld.z >= sizeWorld.x
        ? [0, 0, 1]
        : [1, 0, 0];

  const s = root.getWorldScale(new THREE.Vector3());
  const unitScale = round((s.x + s.y + s.z) / 3, 5);

  // Estimate facing from a left/right bone pair (shoulders, then hips).
  const find = (re: RegExp) => {
    let hit: THREE.Object3D | undefined;

    root.traverse((o) => {
      if (!hit && (o as THREE.Bone).isBone && re.test(o.name.toLowerCase())) {
        hit = o;
      }
    });

    return hit;
  };
  const left =
    find(/left.*(arm|shoulder|clavicle)/) ?? find(/left.*(upleg|thigh)/);
  const right =
    find(/right.*(arm|shoulder|clavicle)/) ?? find(/right.*(upleg|thigh)/);

  let forwardEstimate: Vec3 | undefined;
  let leftAxis: Vec3 | undefined;

  if (left && right) {
    // Vector from the right bone to the left bone points toward the body's left.
    const sideways = left
      .getWorldPosition(new THREE.Vector3())
      .sub(right.getWorldPosition(new THREE.Vector3()));

    if (sideways.lengthSq() > 1e-6) {
      const l = sideways.clone().normalize();

      leftAxis = [round(l.x, 3), round(l.y, 3), round(l.z, 3)];
    }

    const fwd = new THREE.Vector3()
      .crossVectors(sideways, new THREE.Vector3(...upAxis))
      .normalize();

    if (fwd.lengthSq() > 1e-6) {
      forwardEstimate = [round(fwd.x, 3), round(fwd.y, 3), round(fwd.z, 3)];
    }
  }

  return {
    upAxis,
    forwardEstimate,
    leftAxis,
    unitScale,
    sizeWorld: [
      round(sizeWorld.x, 3),
      round(sizeWorld.y, 3),
      round(sizeWorld.z, 3),
    ],
  };
}

function describeClip(clip: THREE.AnimationClip) {
  const targets = new Set<string>();
  const properties = new Set<string>();

  clip.tracks.forEach((track) => {
    // Track names look like "BoneName.position" or "BoneName.bones[Hips].quaternion".
    const dot = track.name.lastIndexOf(".");

    if (dot === -1) {
      targets.add(track.name);

      return;
    }
    targets.add(track.name.slice(0, dot));
    properties.add(track.name.slice(dot + 1));
  });

  return {
    targets: Array.from(targets),
    properties: Array.from(properties),
  };
}

function collectStats(root: THREE.Object3D) {
  let meshes = 0;
  let bones = 0;
  let vertices = 0;
  const materials = new Set<THREE.Material>();

  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) bones += 1;

    const mesh = obj as THREE.Mesh;

    if (mesh.isMesh) {
      meshes += 1;
      const position = mesh.geometry?.getAttribute("position");

      if (position) vertices += position.count;

      const mat = mesh.material;

      if (Array.isArray(mat)) mat.forEach((m) => materials.add(m));
      else if (mat) materials.add(mat);
    }
  });

  return { meshes, bones, vertices, materials: materials.size };
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;

    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mat = mesh.material;

      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  });
}

async function loadModel(
  url: string,
  fileName: string,
): Promise<{ root: THREE.Object3D; animations: THREE.AnimationClip[] }> {
  const ext = getExtension(fileName);

  switch (ext) {
    case "glb":
    case "gltf": {
      const gltf = await new GLTFLoader().loadAsync(url);

      return { root: gltf.scene, animations: gltf.animations };
    }
    case "fbx": {
      const object = await new FBXLoader().loadAsync(url);

      return { root: object, animations: object.animations };
    }
    case "obj": {
      const object = await new OBJLoader().loadAsync(url);

      return { root: object, animations: [] };
    }
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}

export default function ThreeViewer({
  model,
  activeClipIndex,
  isPlaying,
  onLoaded,
  onError,
  onLoadingChange,
}: ThreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<THREE.AnimationAction[]>([]);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  // Read latest callbacks/state inside effects without retriggering them.
  const cbRef = useRef({ onLoaded, onError, onLoadingChange });

  cbRef.current = { onLoaded, onError, onLoadingChange };
  const isPlayingRef = useRef(isPlaying);

  isPlayingRef.current = isPlaying;

  // Scene setup (runs once).
  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0xf4f4f5);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      2000,
    );

    camera.position.set(3, 2, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);

    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 1.0);

    hemi.position.set(0, 20, 0);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);

    dir.position.set(5, 10, 7);
    scene.add(dir);

    const grid = new THREE.GridHelper(20, 20, 0xb0b0b8, 0xd9d9e0);

    grid.name = "__grid";
    scene.add(grid);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;

    const timer = new THREE.Timer();
    let raf = 0;

    const animate = (timestamp?: number) => {
      raf = requestAnimationFrame(animate);
      timer.update(timestamp);
      const delta = timer.getDelta();

      mixerRef.current?.update(delta);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const observer = new ResizeObserver(resize);

    observer.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Load model whenever the uploaded model changes.
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!scene || !camera || !controls) return;

    let cancelled = false;

    cbRef.current.onLoadingChange(true);

    loadModel(model.absolute_url, model.filename)
      .then(({ root, animations }) => {
        if (cancelled) return;

        // Center and frame the model.
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        root.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const fov = (camera.fov * Math.PI) / 180;
        const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.6;

        camera.near = maxDim / 100;
        camera.far = maxDim * 100;
        camera.position.set(distance, distance * 0.7, distance);
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.update();

        // Place the grid under the model's feet and scale it.
        const grid = scene.getObjectByName("__grid");

        if (grid) {
          grid.position.y = -size.y / 2;
          const targetSpan = maxDim * 2;

          grid.scale.setScalar(targetSpan / 20);
        }

        scene.add(root);
        modelRef.current = root;

        // Some exporters (notably FBX) hand us clips whose header `duration`
        // is wrong while the keyframe tracks are fine; recompute it from the
        // real track times so playback spans the whole clip.
        animations.forEach((clip) => clip.resetDuration());

        const mixer = new THREE.AnimationMixer(root);

        mixerRef.current = mixer;
        currentActionRef.current = null;
        actionsRef.current = animations.map((clip) => mixer.clipAction(clip));

        const stats = collectStats(root);

        cbRef.current.onLoaded({
          fileName: model.filename,
          format: getExtension(model.filename).toUpperCase(),
          animations: animations.map((clip) => ({
            name: clip.name,
            duration: clip.duration,
            trackCount: clip.tracks.length,
            ...describeClip(clip),
          })),
          bones: buildBoneTree(root),
          frame: buildModelFrame(root, size),
          stats,
        });
        cbRef.current.onLoadingChange(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        cbRef.current.onLoadingChange(false);
        cbRef.current.onError(
          err instanceof Error ? err.message : "Failed to load model.",
        );
      });

    return () => {
      cancelled = true;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = [];
      currentActionRef.current = null;

      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current);
        disposeObject(modelRef.current);
        modelRef.current = null;
      }
    };
  }, [model]);

  // Switch the active animation clip.
  useEffect(() => {
    const actions = actionsRef.current;
    const next =
      activeClipIndex !== null ? actions[activeClipIndex] : undefined;

    if (next) {
      if (currentActionRef.current && currentActionRef.current !== next) {
        currentActionRef.current.fadeOut(0.25);
      }
      next.reset().setEffectiveWeight(1).fadeIn(0.25).play();
      next.paused = !isPlayingRef.current;
      currentActionRef.current = next;
    } else {
      actions.forEach((action) => action.stop());
      currentActionRef.current = null;
    }
  }, [activeClipIndex]);

  // Toggle play / pause on the current clip.
  useEffect(() => {
    if (currentActionRef.current) {
      currentActionRef.current.paused = !isPlaying;
    }
  }, [isPlaying]);

  return <div ref={containerRef} className="h-full w-full" />;
}
