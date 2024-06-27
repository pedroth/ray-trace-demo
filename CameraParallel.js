import { Vec2, Vec3 } from "./Vector.js";

const PARAMS = {
  samplesPerPxl: 1,
  bounces: 10,
  variance: 0.001,
  gamma: 0.5,
  importanceSampling: true
};

const N = navigator.hardwareConcurrency;
export const WORKERS = [...Array(N)].map(() => new Worker("./RayTraceWorker.js", { type: 'module' }));

export default class CameraParallel {
  constructor(props = {}) {
    const { lookAt, distanceToPlane, position, orientCoords, orbitCoords } = props;
    this.lookAt = lookAt ?? Vec3(0, 0, 0);
    this.distanceToPlane = distanceToPlane ?? 1;
    this.position = position ?? Vec3(3, 0, 0);
    this._orientCoords = orientCoords ?? Vec2();
    this._orbitCoords = orbitCoords;
    if(this._orbitCoords) this.orbit(...this._orbitCoords.toArray());
    else this.orient(...this._orientCoords.toArray());
  }

  clone() {
    return new CameraParallel({
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


  toCameraCoord(x) {
    let pointInCamCoord = x.sub(this.position);
    pointInCamCoord = Vec3(
      this.basis[0].dot(pointInCamCoord),
      this.basis[1].dot(pointInCamCoord),
      this.basis[2].dot(pointInCamCoord)
    )
    return pointInCamCoord;
  }

  sceneShot(scene, params = PARAMS) {
    let it = 1;
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
          .then(() => {
            it++;
            canvas.paint()
          })
      }
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
    return new CameraParallel({
      lookAt: Vec.fromArray(json.lookAt),
      distanceToPlane: json.distanceToPlane,
      position: Vec.fromArray(json.position),
      orientCoords: Vec.fromArray(json.orientCoords),
      orbitCoords: Vec.fromArray(json.orbitCoords)
    })
  }
}
