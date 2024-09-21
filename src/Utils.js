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

export function memoize(func) {
    const cache = {}
    return (...args) => {
        const key = JSON.stringify(args.map(x => typeof x === "object" ? JSON.stringify(x) : x.toString()));
        if (key in cache) return cache[key];
        const ans = func(...args);
        cache[key] = ans;
        return ans;
    }
}

class MyWorker {
    constructor(path) {
        this.path = path;
        try {
            this.worker = new Worker(path, { type: 'module' });
        } catch (e) {
            console.log("Caught error while importing worker", e);
        }
    }

    onMessage(lambda) {
        if (this.__lambda) {
            this.worker.removeEventListener('message', this.__lambda);
        }
        this.__lambda = message => lambda(message.data);
        this.worker.addEventListener("message", this.__lambda);
        this.worker.addEventListener("error", e => console.log("Caught error on worker", e));
    }

    postMessage(message) {
        return this.worker.postMessage(message);
    }
}

export default MyWorker;