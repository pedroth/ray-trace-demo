import Camera from "./Camera.js";
import Scene from "./Scene.js"
import Vec from "./Vector.js"
import Color from "./Color.js"
import Ray from "./Ray.js"
import { rayTrace } from "./RayTrace.js";
import { randomPointInSphere } from "./Utils.js";

function main(inputs) {
    const {
        startRow,
        endRow,
        width,
        height,
        params,
        scene: serializedScene,
        camera: serializedCamera,
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
    // the order does matters
    for (let y = startRow; y < endRow; y++) {
        for (let x = 0; x < width; x++) {
            let c = Color.BLACK;
            const ray = rayGen(x, height - 1 - y)
            for (let i = 0; i < samplesPerPxl; i++) {
                const epsilon = randomPointInSphere().scale(variance);
                const epsilonOrtho = epsilon.sub(ray.dir.scale(epsilon.dot(ray.dir)));
                const r = Ray(ray.init, ray.dir.add(epsilonOrtho).normalize());
                c = c.add(rayTrace(r, scene, params));
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