import Vec, { Vec3, Vec2 } from "./Vector.js"
import Color from "./Color.js"
import Ray from "./Ray.js"
import { memoize } from "./Utils.js"
import { CHANNELS } from "./Constants.js";

let memory = {}

async function main(inputs) {
    const {
        __vars,
        __lambda,
        __width,
        __height,
        __startRow,
        __endRow,
        __dependencies,
        __memory,
    } = inputs;
    memory = {...memory, ...__memory };
    const bufferSize = __width * (__endRow - __startRow + 1) * CHANNELS;
    const image = new Float32Array(bufferSize);
    let index = 0;
    const func = getLambda(__lambda, __dependencies);
    // the order does matter
    for (let i = __startRow; i < __endRow; i++) {
        for (let x = 0; x < __width; x++) {
            const y = __height - 1 - i;
            const color = func(x, y, __vars, memory);
            if (!color) continue;
            image[index++] = color.red;
            image[index++] = color.green;
            image[index++] = color.blue;
            image[index++] = color.alpha;
        }
    }
    return { image, startRow: __startRow, endRow: __endRow };
}

const getLambda = memoize((lambda, dependencies) => {
    const __lambda = eval(`
        ${dependencies.map(d => d.toString()).join("\n")}
        const __lambda = ${lambda};
        __lambda;
    `)
    return __lambda;
});


onmessage = async message => {
    const input = message.data;
    const output = await main(input);
    postMessage(output);
};