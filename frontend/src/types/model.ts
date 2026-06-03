export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export interface SceneNode {
  name: string;
  type: string;
  /** Name of the parent bone, or undefined for a root bone. */
  parent?: string;
  /** Number of immediate child bones (the bone's subtree branches from here). */
  childCount?: number;
  /** Local rest-pose translation relative to the parent bone. */
  position?: Vec3;
  /** Local rest-pose rotation as Euler angles in degrees (XYZ order). */
  rotation?: Vec3;
  /**
   * Local rest-pose rotation as a raw quaternion [x, y, z, w]. This is the
   * source of truth: keyframe quaternion tracks OVERRIDE the bone's local
   * rotation, so animation poses must be authored as `restQuaternion * delta`.
   */
  quaternion?: Quat;
  /** Local rest-pose scale. */
  scale?: Vec3;
  /** World-space rest-pose position (after the model is loaded & framed). */
  worldPosition?: Vec3;
  /**
   * Unit vector (world space) from this bone toward its first child — i.e. the
   * direction the bone physically points in the rest pose ("down the bone").
   */
  childDirection?: Vec3;
  /**
   * Unit vector in THIS bone's LOCAL frame toward its first child — i.e. the
   * bone's long axis in the space its keyframe quaternions live in. Rotating
   * ABOUT this axis twists the bone; rotating about an axis perpendicular to it
   * swings/bends the joint. Use it to pick the rotation axis instead of guessing
   * which of X/Y/Z bends the limb.
   */
  localChildDir?: Vec3;
  /**
   * World-space rest rotation [x,y,z,w]. Lets you convert a world-space intent
   * (e.g. "swing the fist toward forward") into the LOCAL delta a keyframe needs.
   */
  worldQuaternion?: Quat;
  /**
   * Full world matrix as THREE's 16-element COLUMN-MAJOR array
   * (`bone.matrixWorld.elements`). The exact ground-truth world transform of
   * the bone at rest, including any baked FBX scale — translation is elements
   * [12,13,14]. Use it when you need the complete basis, not just rot+pos.
   */
  worldMatrix?: number[];
  /** World-space distance to the first child bone (bone length). */
  length?: number;
  /** Inferred semantic role/side, e.g. "left forearm (elbow)". */
  role?: string;
  /**
   * Precomputed direction probes for major joints. For a small POSITIVE
   * rotation about the bone's local X, Y, Z axis respectively, each entry is
   * the unit WORLD direction the bone's tip (first child) moves. Lets the AI
   * pick the correct rotation axis AND sign instead of guessing — the cure for
   * limbs that bend backward or swap left/right. Use a negative angle to move
   * the tip opposite a probe. Omitted for fingers/toes and tipless bones.
   */
  axisProbes?: [Vec3, Vec3, Vec3];
  children: SceneNode[];
}

/** Global orientation/units of the model, for reasoning about directions. */
export interface ModelFrame {
  /** Up axis as a unit vector (tallest bounding-box dimension), e.g. [0,1,0]. */
  upAxis: Vec3;
  /** Estimated direction the character faces; verify against world positions. */
  forwardEstimate?: Vec3;
  /** Unit world vector toward the character's LEFT (from left/right bone pair). */
  leftAxis?: Vec3;
  /** Mean world scale applied to the root (units hint; FBX is often 0.01). */
  unitScale: number;
  /** Overall world-space bounding-box size. */
  sizeWorld: Vec3;
}

export interface AnimationInfo {
  name: string;
  duration: number;
  trackCount: number;
  /** Unique names of the nodes/bones driven by this clip. */
  targets?: string[];
  /** Unique animated properties on this clip (e.g. position, quaternion, scale). */
  properties?: string[];
}

export interface ModelStats {
  meshes: number;
  bones: number;
  vertices: number;
  materials: number;
}

export interface ModelInfo {
  fileName: string;
  format: string;
  animations: AnimationInfo[];
  bones: SceneNode[];
  frame: ModelFrame;
  stats: ModelStats;
}

/** A model that has been uploaded to the backend (see POST /api/upload). */
export interface UploadedModel {
  /** Stored filename under public/upload/. */
  filename: string;
  /** Byte size of the stored file. */
  size: number;
  /** Path-relative URL, e.g. /public/upload/model.fbx. */
  url: string;
  /** Absolute URL including the backend origin — what the viewer loads from. */
  absolute_url: string;
}

// The backend (app/config.py ALLOWED_EXTENSIONS) accepts these; .glb is NOT
// allowed server-side, so it is intentionally excluded here to avoid 400s.
export const ACCEPTED_MODEL_EXTENSIONS = [".gltf", ".fbx", ".obj"] as const;

export const ACCEPT_ATTR = ACCEPTED_MODEL_EXTENSIONS.join(",");
