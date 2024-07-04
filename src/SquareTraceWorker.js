import Camera from "./Camera.js";
import Scene from "./Scene.js"
import Vec, { Vec3 } from "./Vector.js"
import Ray from "./Ray.js"
import { rayTrace, trace, traceWithCache } from "./RayTrace.js";


function main(inputs) {
    const {
        width,
        height,
        params,
        scene: serializedScene,
        camera: serializedCamera,
    } = inputs;
    const scene = Scene.deserialize(serializedScene);
    const camera = Camera.deserialize(serializedCamera);
    const bounces = params.bounces;
    const samplesPerPxl = params.samplesPerPxl;
    const variance = params.variance;
    const gamma = params.gamma;
    const invSamples = (bounces || 1) / samplesPerPxl;
    const isImportanceSampling = params.importanceSampling;
    const useCache = params.useCache;
    const budget = params.budget;
    const xs = [];
    const ys = [];
    const colors = [];
    // the order does matter
    for (let i = 0; i < budget; i++) {
        const xp = Math.random();
        const yp = Math.random();
        const dirInLocal = [
            (xp - 0.5),
            (yp - 0.5),
            camera.distanceToPlane
        ]
        const dir = Vec3(
            camera.basis[0].x * dirInLocal[0] + camera.basis[1].x * dirInLocal[1] + camera.basis[2].x * dirInLocal[2],
            camera.basis[0].y * dirInLocal[0] + camera.basis[1].y * dirInLocal[1] + camera.basis[2].y * dirInLocal[2],
            camera.basis[0].z * dirInLocal[0] + camera.basis[1].z * dirInLocal[1] + camera.basis[2].z * dirInLocal[2]
        )
            .normalize();
        const ray = Ray(camera.position, dir);
        const epsilon = Vec.RANDOM(3).scale(variance);
        const epsilonOrtho = epsilon.sub(ray.dir.scale(epsilon.dot(ray.dir)));
        const r = Ray(ray.init, ray.dir.add(epsilonOrtho).normalize());
        let c;
        if (useCache) c = traceWithCache(r, scene, { bounces });
        else {
            c = isImportanceSampling ?
                rayTrace(r, scene, { bounces }) :
                trace(r, scene, { bounces })
        }
        c = c.toGamma(gamma);
        xs.push(xp * width);
        ys.push(yp * height);
        colors.push(c.toArray());

    }
    return { xs, ys, colors };
}

onmessage = message => {
    const input = message.data
    const output = main(input);
    postMessage(output);
};