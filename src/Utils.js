import Vec from "./Vector.js";

export function randomPointInSphere() {
    let randomInSphere = undefined;
    while (true) {
        const random = Vec.RANDOM(3).map(x => 2 * x - 1);
        if (random.squareLength() >= 1) continue;
        randomInSphere = random.normalize();
        break;
    }
    return randomInSphere;
}