import Color from "./Color.js";
import Ray from "./Ray.js";
import { rayTrace, trace, traceWithCache } from "./RayTrace.js";
import Vec, { Vec2, Vec3 } from "./Vector.js";

const PARAMS = {
  samplesPerPxl: 1,
  bounces: 5,
  variance: 0.001,
  gamma: 0.5,
  importanceSampling: true,
  useCache: false
};

const N = navigator.hardwareConcurrency;
let WORKERS = [];
let SQUARE_WORKERS = [];


export default class Camera {
  constructor(props = {}) {
    const { lookAt, distanceToPlane, position, orientCoords, orbitCoords } = props;
    this.lookAt = lookAt ?? Vec3(0, 0, 0);
    this.distanceToPlane = distanceToPlane ?? 1;
    this.position = position ?? Vec3(3, 0, 0);
    this._orientCoords = orientCoords ?? Vec2();
    this._orbitCoords = orbitCoords;
    if (this._orbitCoords) this.orbit(...this._orbitCoords.toArray());
    else this.orient(...this._orientCoords.toArray());
  }

  clone() {
    return new Camera({
      lookAt: this.lookAt,
      position: this.position,
      distanceToPlane: this.distanceToPlane,
      orientCoords: this._orientCoords,
      orbitCoords: this._orbitCoords,
    })
  }

  look(at, up = Vec3(0, 0, 1)) {
    this.lookAt = at;
    this.basis[2] = this.position.sub(at).normalize();
    // x -axis
    this.basis[0] = this.basis[2].cross(up).normalize();
    // y - axis
    this.basis[1] = this.basis[0].cross(this.basis[2]).normalize();
    return this
  }

  orient(theta = 0, phi = 0) {
    if (theta instanceof Function) {
      this._orientCoords = theta(this._orientCoords);
      theta = this._orientCoords.x;
      phi = this._orientCoords.y;
    } else {
      this._orientCoords = Vec2(theta, phi);
    }
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);

    this.basis = [];
    // right hand coordinate system
    // z - axis
    this.basis[2] = Vec3(-cosP * cosT, -cosP * sinT, -sinP);
    // y - axis
    this.basis[1] = Vec3(-sinP * cosT, -sinP * sinT, cosP);
    // x -axis
    this.basis[0] = Vec3(-sinT, cosT, 0);

    return this;
  }

  orbit(radius, theta, phi) {
    if (radius instanceof Function) {
      this._orbitCoords = radius(this._orbitCoords);
      radius = this._orbitCoords.x;
      theta = this._orbitCoords.y;
      phi = this._orbitCoords.z;
    } else {
      this._orbitCoords = Vec3(radius, theta, phi);
    }
    this.orient(theta, phi);

    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);

    const sphereCoordinates = Vec3(
      radius * cosP * cosT,
      radius * cosP * sinT,
      radius * sinP
    );

    this.position = sphereCoordinates.add(this.lookAt);
    return this;
  }

  rayMap(lambdaWithRays, params) {
    return {
      to: canvas => {
        const w = canvas.width;
        const h = canvas.height;
        const ans = canvas.map(
          (x, y) => {
            const dirInLocal = [
              (x / w - 0.5),
              (y / h - 0.5),
              this.distanceToPlane
            ]
            const dir = Vec3(
              this.basis[0].x * dirInLocal[0] + this.basis[1].x * dirInLocal[1] + this.basis[2].x * dirInLocal[2],
              this.basis[0].y * dirInLocal[0] + this.basis[1].y * dirInLocal[1] + this.basis[2].y * dirInLocal[2],
              this.basis[0].z * dirInLocal[0] + this.basis[1].z * dirInLocal[1] + this.basis[2].z * dirInLocal[2]
            )
              .normalize();
            return lambdaWithRays(Ray(this.position, dir), params)
          })
        return ans;
      }
    }
  }

  toCameraCoord(x) {
    let pointInCamCoord = x.sub(this.position);
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

  sceneShot(scene, params = PARAMS) {
    const bounces = params.bounces;
    const samplesPerPxl = params.samplesPerPxl;
    const variance = params.variance;
    const gamma = params.gamma;
    const invSamples = (bounces || 1) / samplesPerPxl;
    const isImportanceSampling = params.importanceSampling;
    const useCache = params.useCache;
    const lambda = ray => {
      let c = Color.BLACK;
      for (let i = 0; i < samplesPerPxl; i++) {
        const epsilon = Vec.RANDOM(3).scale(variance);
        const epsilonOrto = epsilon.sub(ray.dir.scale(epsilon.dot(ray.dir)));
        const r = Ray(ray.init, ray.dir.add(epsilonOrto).normalize());
        if (useCache) c = c.add(traceWithCache(r, scene, { bounces }));
        else {
          c = isImportanceSampling ?
            c.add(rayTrace(r, scene, { bounces })) :
            c.add(trace(r, scene, { bounces }))
        }
      }
      return c.scale(invSamples).toGamma(gamma);
    }
    return this.rayMap(lambda, params);
  }

  squareShot(scene, params = PARAMS) {
    const BUDGET = params.budget ?? 10000;
    return {
      to: canvas => {
        // params
        const bounces = params.bounces;
        const variance = params.variance;
        const isImportanceSampling = params.importanceSampling;
        const useCache = params.useCache;
        const gamma = params.gamma;
        // canvas 
        const w = canvas.width;
        const h = canvas.height;
        let side = Math.sqrt(w * h / BUDGET);
        for (let i = 0; i < BUDGET; i++) {
          const xp = Math.random();
          const yp = Math.random();
          const dirInLocal = [
            (xp - 0.5),
            (yp - 0.5),
            this.distanceToPlane
          ]
          const dir = Vec3(
            this.basis[0].x * dirInLocal[0] + this.basis[1].x * dirInLocal[1] + this.basis[2].x * dirInLocal[2],
            this.basis[0].y * dirInLocal[0] + this.basis[1].y * dirInLocal[1] + this.basis[2].y * dirInLocal[2],
            this.basis[0].z * dirInLocal[0] + this.basis[1].z * dirInLocal[1] + this.basis[2].z * dirInLocal[2]
          )
            .normalize();
          const ray = Ray(this.position, dir);
          const epsilon = Vec.RANDOM(3).scale(variance);
          const epsilonOrto = epsilon.sub(ray.dir.scale(epsilon.dot(ray.dir)));
          const r = Ray(ray.init, ray.dir.add(epsilonOrto).normalize());
          let c = Color.BLACK;
          if (useCache) c = traceWithCache(r, scene, { bounces });
          else {
            c = isImportanceSampling ?
              rayTrace(r, scene, { bounces }) :
              trace(r, scene, { bounces })
          }
          canvas.drawSquare(
            Vec2(xp * w - side, yp * h - side),
            Vec2(xp * w + side, yp * h + side),
            () => c.toGamma(gamma)
          );
          // canvas.setPxl(xp * w, yp * h, c);
        }
        canvas.paint();
        return canvas;
      }
    }
  }

  parallelShot(scene, params = PARAMS) {
    if (WORKERS.length === 0) WORKERS = [...Array(N)].map(() => new Worker("./src/RayTraceWorker.js", { type: 'module' }));
    return {
      to: canvas => {
        const w = canvas.width;
        const h = canvas.height;
        return Promise
          .all(
            WORKERS.map((worker, k) => {
              return new Promise((resolve) => {
                worker.onmessage = message => {
                  const { image, startRow, endRow, } = message.data;
                  let index = 0;
                  const startIndex = 4 * w * startRow;
                  const endIndex = 4 * w * endRow;
                  for (let i = startIndex; i < endIndex; i += 4) {
                    canvas.setPxlData(i, [image[index++], image[index++], image[index++]]);
                    index++;
                  }
                  resolve();
                };
                const ratio = Math.floor(h / WORKERS.length);
                worker.postMessage({
                  startRow: k * ratio,
                  endRow: Math.min(h - 1, (k + 1) * ratio),
                  width: canvas.width,
                  height: canvas.height,
                  scene: scene.serialize(),
                  params: params,
                  camera: this.serialize()
                });
              });
            })
          )
          .then(() => canvas.paint())
      }
    }
  }

  parallelSquareShot(scene, params = PARAMS) {
    if (SQUARE_WORKERS.length === 0) SQUARE_WORKERS = [...Array(N)].map(() => new Worker("./src/SquareTraceWorker.js", { type: 'module' }));
    return {
      to: canvas => {
        const BUDGET = params.budget ?? 10000;
        const w = canvas.width;
        const h = canvas.height;
        let side = Math.sqrt(w * h / BUDGET);
        return Promise
          .all(
            SQUARE_WORKERS.map((worker, k) => {
              return new Promise((resolve) => {
                worker.onmessage = message => {
                  const { xs, ys, colors } = message.data;
                  for (let i = 0; i < xs.length; i++) {
                    const x = xs[i];
                    const y = ys[i];
                    const c = colors[i];
                    canvas.drawSquare(
                      Vec2(x * w - side, y * h - side),
                      Vec2(x * w + side, y * h + side),
                      () => Color.ofRGB(c[0], c[1], c[2])
                    );
                  }
                  resolve();
                };
                worker.postMessage({
                  params: params,
                  width: canvas.width,
                  height: canvas.height,
                  scene: scene.serialize(),
                  camera: this.serialize()
                });
              });
            })
          )
          .then(() => canvas.paint())
      }
    }
  }

  rayFromImage(width, height) {
    const w = width;
    const h = height;
    return (x, y) => {
      const dirInLocal = [
        (x / w - 0.5),
        (y / h - 0.5),
        this.distanceToPlane
      ]
      const dir = Vec3(
        this.basis[0].x * dirInLocal[0] + this.basis[1].x * dirInLocal[1] + this.basis[2].x * dirInLocal[2],
        this.basis[0].y * dirInLocal[0] + this.basis[1].y * dirInLocal[1] + this.basis[2].y * dirInLocal[2],
        this.basis[0].z * dirInLocal[0] + this.basis[1].z * dirInLocal[1] + this.basis[2].z * dirInLocal[2]
      )
        .normalize()
      return Ray(this.position, dir);
    }
  }

  serialize() {
    return {
      lookAt: this.lookAt.toArray(),
      distanceToPlane: this.distanceToPlane,
      position: this.position.toArray(),
      orientCoords: this._orientCoords.toArray(),
      orbitCoords: this._orbitCoords.toArray(),
    }
  }

  static deserialize(json) {
    return new Camera({
      lookAt: Vec.fromArray(json.lookAt),
      distanceToPlane: json.distanceToPlane,
      position: Vec.fromArray(json.position),
      orientCoords: Vec.fromArray(json.orientCoords),
      orbitCoords: Vec.fromArray(json.orbitCoords)
    })
  }
}