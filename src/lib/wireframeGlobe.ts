/**
 * Real (orthographically-projected) 3D wireframe sphere used by both the
 * Relight and Angle Generator dials — the Higgsfield look, where the whole
 * wireframe globe visibly *rotates* as you drag and the light/camera marker
 * rides on its surface, rather than a lone marker gliding over a static
 * globe.
 *
 * Everything projects into the same 0-100 coordinate space PreviewStage's
 * `viewBox="0 0 100 100"` overlays use, so raw numbers line up 1:1 with the
 * percentage-based HTML markers layered on top.
 *
 * Convention: the subject card sits flat at the origin facing the viewer
 * (+z toward the viewer). `azimuth` yaws the sphere around the vertical
 * axis (0 = marker in front of the subject, 90 = to its right, 180 = behind,
 * 270 = left). `elevation` pitches it (90 = marker directly overhead, -90 =
 * directly underneath, 0 = eye level).
 */

export const GLOBE_R = 38;

/** Rotate a point: yaw around Y by `azimuth`, then pitch around X by `-elevation`. */
function rotate(x: number, y: number, z: number, azimuth: number, elevation: number) {
  const a = (azimuth * Math.PI) / 180;
  const b = (-elevation * Math.PI) / 180;
  // yaw around Y
  const x1 = x * Math.cos(a) + z * Math.sin(a);
  const y1 = y;
  const z1 = -x * Math.sin(a) + z * Math.cos(a);
  // pitch around X
  const x2 = x1;
  const y2 = y1 * Math.cos(b) - z1 * Math.sin(b);
  const z2 = y1 * Math.sin(b) + z1 * Math.cos(b);
  return { x: x2, y: y2, z: z2 };
}

/** Orthographic projection to screen space (0-100, y flipped so up is up). */
function project(p: { x: number; y: number; z: number }) {
  return { x: 50 + p.x, y: 50 - p.y, z: p.z };
}

export interface GlobeLine {
  /** SVG polyline `points` string in 0-100 space. */
  points: string;
  /** 0-1 — front-facing lines are drawn brighter, back-facing dimmer, for depth. */
  opacity: number;
}

const MERIDIANS = [0, 30, 60, 90, 120, 150];
const PARALLELS = [-60, -30, 0, 30, 60];

/**
 * Builds the sphere's meridian + parallel polylines for the given
 * orientation. Each line's average depth drives its opacity so the globe
 * reads as a rotating 3D form rather than a flat disc.
 */
export function buildGlobeLines(azimuth: number, elevation: number): GlobeLine[] {
  const lines: GlobeLine[] = [];

  const emit = (raw: { x: number; y: number; z: number }[]) => {
    let zSum = 0;
    const pts = raw.map((p) => {
      const s = project(p);
      zSum += s.z;
      return `${s.x.toFixed(1)},${s.y.toFixed(1)}`;
    });
    const avgZ = zSum / raw.length; // -R..R
    const opacity = 0.05 + Math.max(0, Math.min(1, (avgZ / GLOBE_R + 1) / 2)) * 0.16;
    lines.push({ points: pts.join(" "), opacity });
  };

  // Meridians: fixed longitude, sweep latitude pole to pole.
  for (const phi of MERIDIANS) {
    const pr = (phi * Math.PI) / 180;
    const raw = [];
    for (let th = -90; th <= 90; th += 12) {
      const t = (th * Math.PI) / 180;
      raw.push(
        rotate(
          GLOBE_R * Math.cos(t) * Math.sin(pr),
          GLOBE_R * Math.sin(t),
          GLOBE_R * Math.cos(t) * Math.cos(pr),
          azimuth,
          elevation
        )
      );
    }
    emit(raw);
  }

  // Parallels: fixed latitude, full 360 sweep of longitude.
  for (const th of PARALLELS) {
    const t = (th * Math.PI) / 180;
    const raw = [];
    for (let phi = 0; phi <= 360; phi += 18) {
      const pr = (phi * Math.PI) / 180;
      raw.push(
        rotate(
          GLOBE_R * Math.cos(t) * Math.sin(pr),
          GLOBE_R * Math.sin(t),
          GLOBE_R * Math.cos(t) * Math.cos(pr),
          azimuth,
          elevation
        )
      );
    }
    emit(raw);
  }

  return lines;
}

export interface MarkerPoint {
  x: number;
  y: number;
  /** Scaled 0.82..1.18 by depth so nearer markers read slightly larger. */
  scale: number;
  /** True when the marker is on the far side of the sphere (render behind the card). */
  behind: boolean;
}

/**
 * The single point on the sphere's surface where the light/camera sits, in
 * the same orientation as `buildGlobeLines` — so it always rides *on* the
 * rotating globe. Local "handle" is the front pole (0,0,R); rotating the
 * sphere carries it around.
 */
export function globeMarker(azimuth: number, elevation: number): MarkerPoint {
  const p = project(rotate(0, 0, GLOBE_R, azimuth, elevation));
  return {
    x: p.x,
    y: p.y,
    scale: 1 + (p.z / GLOBE_R) * 0.18,
    behind: p.z < -0.5,
  };
}
