import Color from "./Color.js";
import Ray from "./Ray.js";
import { randomPointInSphere } from "./Utils.js";
import { Vec3 } from "./Vector.js";


export function rayTrace(ray, scene, options) {
    const { bounces, importanceSampling, useCache } = options;
    if (bounces < 0) return importanceSampling ? colorFromLight(ray.init, scene) : Color.BLACK;
    const hit = scene.interceptWith(ray)
    if (!hit) return Color.BLACK;

    const [_, p, e] = hit;
    if (useCache) {
        const cachedColor = cache.get(p);
        if (cachedColor) { return cachedColor; }
    }
    const albedo = e.color ?? e.colors[0];
    const mat = e.material;
    const isEmissive = e.emissive;

    if (isEmissive) {
        if (useCache) { cache.set(p, albedo); }
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
    let attenuation = scatterRay.dir.dot(e.normalToPoint(p));
    attenuation = Math.abs(attenuation)
    const finalColor = albedo.mul(scatterColor).scale(attenuation);
    if (useCache) { cache.set(p, finalColor); }
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
                const attenuation = dot <= 0 ? -dot : dot;
                if (attenuation > 0) {
                    c = c.add(color.scale(attenuation));
                    numberOfLights++;
                }
            }
        }
    }
    return c;
}


const lightColorCache = (gridSpace) => {
    const point2ColorMap = {};
    const point2Ite = {};
    const ans = {};
    ans.hash = (p) => {
        const integerCoord = p.map(z => Math.floor(z / gridSpace));
        const h = (integerCoord.x * 92837111) ^ (integerCoord.y * 689287499) ^ (integerCoord.z * 283923481);
        return Math.abs(h);
    }
    ans.set = (p, c) => {
        const h = ans.hash(p);
        if (h in point2ColorMap) {
            point2Ite[h] = point2Ite[h] + 1;
            point2ColorMap[h] = point2ColorMap[h].add(c.sub(point2ColorMap[h]).scale(1 / point2Ite[h]));
        } else {
            point2Ite[h] = 1;
            point2ColorMap[h] = c;
        }

        return ans;
    }
    ans.get = (p) => {
        const samples = 10;
        const coin = Math.random() < 0.25;
        if (!coin) return undefined;
        let validSamples = 0;
        const h = ans.hash(p);
        let accColor = point2ColorMap[h];
        if (!accColor) return undefined;
        for (let i = 0; i < samples; i++) {
            const epsilon = randomPointInSphere(3).scale(gridSpace);
            const p2 = p.add(epsilon);
            const h = ans.hash(p2);
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
const cache = lightColorCache(0.025);
