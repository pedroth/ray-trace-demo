import Color from "./Color.js";
import Ray from "./Ray.js";
import { randomPointInSphere } from "./Utils.js";
import { Vec3, Vec2 } from "./Vector.js";

export function rayTrace(ray, scene, options) {
    const { bounces, importanceSampling, useCache } = options;
    if (bounces < 0) return importanceSampling ? colorFromLight(ray.init, scene) : Color.BLACK;
    const hit = scene.interceptWith(ray)
    if (!hit) return Color.BLACK;
    const [_, p, e] = hit;
    if (useCache) {
        const rayOut = Ray(p, ray.dir.scale(-1));
        const cachedColor = cache.get(rayOut);
        if (cachedColor) { return cachedColor; }
    }
    const albedo = e.color ?? e.colors[0];
    const mat = e.material;
    const isEmissive = e.emissive;
    if (isEmissive) {
        if (useCache) { cache.set(Ray(p, ray.dir.scale(-1)), albedo); }
        return albedo;
    }
    let scatterRay = (importanceSampling && Math.random() < 0.1) ?
        rayFromLight(p, scene) :
        mat.scatter(ray, p, e);
    let scatterColor = rayTrace(
        scatterRay,
        scene,
        { ...options, bounces: bounces - 1 }
    );
    const attenuation = Math.abs(e.normalToPoint(p).dot(scatterRay.dir));
    const finalColor = albedo.mul(scatterColor).scale(attenuation);
    if (useCache) { cache.set(scatterRay, finalColor); }
    return finalColor;
}


function rayFromLight(p, scene) {
    const emissiveElements = scene.getElements().filter((e) => e.emissive);
    let dirAcc = Vec3();
    let numberOfLights = 0;
    for (let i = 0; i < emissiveElements.length; i++) {
        const light = emissiveElements[i];
        const lightP = light.sample();
        const v = lightP.sub(p);
        const dir = v.normalize();
        const hit = scene.interceptWith(Ray(p, dir));
        if (!hit) continue;
        if (hit) {
            const [_, p, e] = hit;
            const color = e.color ?? e.colors[0];
            if (e.emissive) {
                dirAcc = dirAcc.add(dir);
                numberOfLights++;
            }
        }
    }
    return Ray(p, dirAcc.scale(1 / numberOfLights).normalize());
}

function colorFromLight(p, scene) {
    const emissiveElements = scene.getElements().filter((e) => e.emissive);
    let c = Color.BLACK
    let numberOfLights = 0;
    for (let i = 0; i < emissiveElements.length; i++) {
        const light = emissiveElements[i];
        const lightP = light.sample();
        const v = lightP.sub(p);
        const dir = v.normalize();
        const hit = scene.interceptWith(Ray(p, dir));
        if (!hit) continue;
        if (hit) {
            const [_, p, e] = hit;
            const color = e.color ?? e.colors[0];
            if (e.emissive) {
                const n = e.normalToPoint(p);
                const dot = dir.dot(n);
                const attenuation = Math.abs(dot);
                if (attenuation > 0) {
                    c = c.add(color.scale(attenuation));
                    numberOfLights++;
                }
            }
        }
    }
    return c;
}

const radianceCache = (gridSpace) => {
    const point2ColorMap = {};
    const point2Ite = {};
    const ans = {};
    ans.hash = (ray) => {
        const invGrid = 1 / gridSpace;

        // --- Position hash ---
        const x = Math.floor(ray.init.x * invGrid); // same as floor for positives
        const y = Math.floor(ray.init.y * invGrid);
        const z = Math.floor(ray.init.z * invGrid);

        let h = x * 73856093 ^ y * 19349663 ^ z * 83492791;

        // --- Direction hash (normalized to L1) ---
        const dir = ray.dir;
        const L1 = Math.abs(dir.x) + Math.abs(dir.y) + Math.abs(dir.z);
        let nx = dir.x / L1, ny = dir.y / L1, nz = dir.z / L1;

        if (nz < 0) {
            nx = Math.sign(nx) * (1 - Math.abs(ny));
            ny = Math.sign(ny) * (1 - Math.abs(nx));
            nz = 0;
        }

        const dx = Math.floor(nx * invGrid);
        const dy = Math.floor(ny * invGrid);

        let h2 = dx * 19349663 ^ dy * 83492791;

        return ((h ^ h2) >>> 0) % 1e6; // unsigned 32-bit
    };

    ans.set = (ray, c) => {
        const h = ans.hash(ray);
        if (h in point2ColorMap) {
            point2Ite[h] = point2Ite[h] + 1;
            point2ColorMap[h] = point2ColorMap[h].add(c.sub(point2ColorMap[h]).scale(1 / point2Ite[h]));
        } else {
            point2Ite[h] = 1;
            point2ColorMap[h] = c;
        }
        return ans;
    }
    ans.get = (ray) => {
        const samples = 10;
        const coin = Math.random() < 0.25;
        if (!coin) return undefined;
        let validSamples = 0;
        const h = ans.hash(ray);
        let accColor = point2ColorMap[h];
        if (!accColor) return undefined;
        for (let i = 0; i < samples; i++) {
            const epsilon = randomPointInSphere(3).scale(gridSpace);
            const epsilon2 = randomPointInSphere(3).scale(gridSpace);
            const p2 = ray.init.add(epsilon);
            const dir2 = ray.dir.add(epsilon2).normalize();
            const h = ans.hash(Ray(p2, dir2));
            if (h in point2ColorMap) {
                accColor = accColor.add(point2ColorMap[h]);
                validSamples++;
            }
        }
        if (validSamples === 0) return undefined;
        return accColor.scale(1 / validSamples);
        // const h = ans.hash(p);
        // return Math.random() < 0.5 ? point2ColorMap[h] : undefined;
    }
    return ans;
}
const cache = radianceCache(0.05);
