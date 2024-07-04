import Camera from "./Camera.js";
import Scene from "./Scene.js"
import Vec from "./Vector.js"
import Color from "./Color.js"
import Ray from "./Ray.js"
import { rayTrace, trace, traceWithCache } from "./RayTrace.js";


function main(inputs) {
    const {
        startRow,
        endRow,
        width,
        height,
        params,
        scene: serializedScene,
        camera: serializedCamera,
        withCache
    } = inputs;
    const scene = Scene.deserialize(serializedScene);
    const camera = Camera.deserialize(serializedCamera);
    const rayGen = camera.rayFromImage(width, height);
    const bufferSize = width * (endRow - startRow + 1) * 4;
    const image = new Float32Array(bufferSize);
    let index = 0;
    const bounces = params.bounces;
    const samplesPerPxl = params.samplesPerPxl;
    const variance = params.variance;
    const gamma = params.gamma;
    const invSamples = (bounces || 1) / samplesPerPxl;
    const isImportanceSampling = params.importanceSampling;
    // the order does matter
    for (let y = startRow; y < endRow; y++) {
        for (let x = 0; x < width; x++) {
            let c = Color.BLACK;
            const ray = rayGen(x, height - 1 - y)
            for (let i = 0; i < samplesPerPxl; i++) {
                const epsilon = Vec.RANDOM(3).scale(variance);
                const epsilonOrto = epsilon.sub(ray.dir.scale(epsilon.dot(ray.dir)));
                const r = Ray(ray.init, ray.dir.add(epsilonOrto).normalize());
                if (withCache) c = c.add(traceWithCache(r, scene, { bounces }));
                else c = isImportanceSampling ? c.add(rayTrace(r, scene, { bounces })) : c.add(trace(r, scene, { bounces }))
            }
            const color = c.scale(invSamples).toGamma(gamma);
            image[index++] = color.red;
            image[index++] = color.green;
            image[index++] = color.blue;
            image[index++] = 1.0;
        }
    }
    return { image, startRow, endRow };
}



onmessage = message => {
    const input = message.data
    const output = main(input);
    postMessage(output);
};