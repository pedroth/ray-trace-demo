import Camera, { rayTrace, trace } from "./Camera.js";
import Scene from "./Scene.js"

function main(inputs) {
    const {
        startRow,
        endRow,
        width,
        height,
        params,
        scene: serializedScene,
        camera: serializedCamera
    } = inputs;
    const scene = Scene.deserialize(serializedScene);
    const camera = Camera.deserialize(serializedCamera);
    const rayGen = camera.rayFromImage(width, height);
    const bufferSize = width * (endRow - startRow + 1) * 4;
    const image = new Float32Array(bufferSize);
    let index = 0;
    // the order does matter
    for (let y = startRow; y < endRow; y++) {
        for (let x = 0; x < width; x++) {
            const color = rayTrace(rayGen(x, height - 1 - y), scene, params);
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