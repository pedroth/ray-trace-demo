import Color from "./Color.js";
import Ray from "./Ray.js";
import Vec, { Vec2, Vec3 } from "./Vector.js";

const PARAMS = {
  samplesPerPxl: 1,
  samples: 1,
  bounces: 1,
  variance: 0.01
};
export default class Camera {
  constructor(props = {
    sphericalCoords: Vec3(5, 0, 0),
    focalPoint: Vec3(0, 0, 0),
    distanceToPlane: 1
  }) {
    const { sphericalCoords, focalPoint, distanceToPlane } = props;
    this.sphericalCoords = sphericalCoords || Vec3(5, 0, 0);
    this.focalPoint = focalPoint || Vec3(0, 0, 0);
    this.distanceToPlane = distanceToPlane || 1;
    this.orbit();
  }

  clone() {
    return new Camera({
      sphericalCoordinates: this.sphericalCoords,
      focalPoint: this.focalPoint,
      distanceToPlane: this.distanceToPlane
    })
  }

  orbit() {
    const [rho, theta, phi] = this.sphericalCoords.toArray();
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);

    this.basis = [];
    // z - axis
    this.basis[2] = Vec3(-cosP * cosT, -cosP * sinT, -sinP);
    // y - axis
    this.basis[1] = Vec3(-sinP * cosT, -sinP * sinT, cosP);
    // x -axis
    this.basis[0] = Vec3(-sinT, cosT, 0);

    const sphereCoordinates = Vec3(
      rho * cosP * cosT,
      rho * cosP * sinT,
      rho * sinP
    );
    this.eye = sphereCoordinates.add(this.focalPoint);
    return this;
  }

  rayShot(lambdaWithRays, params) {
    return {
      to: canvas => {
        const w = canvas.width;
        const h = canvas.height;
        const ans = canvas.map(
          (x, y) => {
            const dirInLocal = [
              (x / w - 0.5),
              (y / h - 0.5),
              1
            ]
            const dir = Vec3(
              this.basis[0].x * dirInLocal[0] + this.basis[1].x * dirInLocal[1] + this.basis[2].x * dirInLocal[2],
              this.basis[0].y * dirInLocal[0] + this.basis[1].y * dirInLocal[1] + this.basis[2].y * dirInLocal[2],
              this.basis[0].z * dirInLocal[0] + this.basis[1].z * dirInLocal[1] + this.basis[2].z * dirInLocal[2]
            )
              .normalize();
            return lambdaWithRays(Ray(this.eye, dir), params)
          })
        return ans;
      }
    }
  }

  sceneShot(scene, params = PARAMS) {
    const bounces = params.bounces;
    const samples = params.samples;
    const variance = params.variance;
    const samplesPerPxl = params.samplesPerPxl;
    const lambda = ray => {
      let c = Color.BLACK;
      for (let i = 0; i < samplesPerPxl; i++) {
        const epsilon = Vec.RANDOM(3).scale(variance);
        const epsilonOrto = epsilon.sub(ray.dir.scale(epsilon.dot(ray.dir)));
        const r = Ray(ray.init, ray.dir.add(epsilonOrto).normalize());
        c = c.add(trace(r, scene, { bounces, samples }));
      }
      return c.scale(1 / samplesPerPxl);
    }
    return this.rayShot(lambda, params);
  }

  toCameraCoord(x) {
    let pointInCamCoord = x.sub(this.eye);
    pointInCamCoord = Vec3(
      this.basis[0].dot(pointInCamCoord),
      this.basis[1].dot(pointInCamCoord),
      this.basis[2].dot(pointInCamCoord)
    )
    return pointInCamCoord;
  }


  rasterLine({ canvas, elem }) {
    const w = canvas.width;
    const h = canvas.height;
    const lineElem = elem;
    const { color, positions } = lineElem;
    const { distanceToPlane } = this;
    // camera coords
    const pointsInCamCoord = positions.map((p) => this.toCameraCoord(p));
    //project
    const projectedPoints = pointsInCamCoord
      .map(p => p.scale(distanceToPlane / p.z))
    // integer coordinates
    const intPoints = projectedPoints
      .map((p) => {
        let x = w / 2 + p.x * w;
        let y = h / 2 + p.y * h;
        x = Math.floor(x);
        y = Math.floor(y);
        return Vec2(x, y);
      })
    canvas.drawLine(intPoints[0], intPoints[1], () => color);
  }
}


function trace(ray, scene, options) {
  const { samples, bounces } = options;
  if (bounces < 0) return Color.BLACK;
  const interception = scene.interceptWith(ray)
  if (!interception) return Color.BLACK;
  const [p, e] = interception;
  const color = e.color ?? e.colors[0];
  if (e.emissive) return color;
  let r = scatterRay(p, e, ray);
  const finalC = trace(
    r,
    scene,
    { bounces: bounces - 1, samples }
  );
  return color.mul(finalC);
}

function scatterRay(point, element, ray) {
  let normal = element.normalToPoint(point);
  normal = ray.dir.dot(normal) <= 0 ? normal : normal.scale(-1);
  let randomInSphere = undefined;
  while (true) {
    const random = Vec.RANDOM(3).map(x => 2 * x - 1);
    if (random.squareLength() >= 1) continue;
    randomInSphere = random.normalize();
    break;
  }
  if (randomInSphere.dot(normal) >= 0) return Ray(point, randomInSphere);
  return Ray(point, randomInSphere.scale(-1));
}
