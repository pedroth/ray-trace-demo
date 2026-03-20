import Color from "./Color.js";
import Ray from "./Ray.js";
import { randomPointInSphere } from "./Utils.js";
import { Vec3, Vec2 } from "./Vector.js";

const TWO_PI = 2 * Math.PI;

/**
 * Iterative version of the Ray Tracer.
 * Better for performance and avoiding stack limits.
 */
export function rayTraceFor(ray, scene, options) {
    const { bounces, importanceSampling, useCache } = options;
    let albedoAcc = Color.WHITE;
    let currentRay = ray;
    let firstHitPosition = undefined;
    let totalResult = Color.BLACK;

    for (let i = 0; i < bounces; i++) {
        const hit = scene.interceptWith(currentRay);
        if (!hit) return totalResult;

        const [t, p, e] = hit;
        const mat = e.material;
        const isDiffuse = mat.type === "Diffuse";

        if (i === 0) firstHitPosition = p;

        // 1. Cache Lookup
        if (useCache && isDiffuse) {
            const cachedColor = cache.get(p);
            if (cachedColor) return cachedColor;
        }

        // 2. Hit a Light Source (Emissive)
        if (e.emissive) {
            const lightColor = e.color ?? e.colors[0];
            if (useCache && isDiffuse) cache.set(firstHitPosition, lightColor);
            return i === 0 ? lightColor : totalResult.add(lightColor.mul(albedoAcc));
        }

        const albedo = e.color ?? e.colors[0];
        const normal = e.normalToPoint(p);

        // 3. Explicit Light Sampling (Next Event Estimation)
        if (importanceSampling && isDiffuse) {
            const directLight = albedoAcc.mul(albedo).mul(colorFromLight(p, normal, scene, { bounces: bounces }));
            totalResult = totalResult.add(directLight);
        }

        // 4. Prepare for next bounce
        const scatterRay = mat.scatter(currentRay, p, e);
        const cosTheta = Math.abs(normal.dot(scatterRay.dir));

        albedoAcc = albedoAcc.mul(albedo).scale(cosTheta);
        currentRay = scatterRay;
    }

    return totalResult;
}

/**
 * Recursive version of the Ray Tracer.
 */
export function rayTrace(ray, scene, options) {
    const { bounces, importanceSampling, useCache } = options;
    const hit = scene.interceptWith(ray);
    if (!hit) return Color.BLACK;

    const [_, p, e] = hit;
    const mat = e.material;
    const isDiffuse = mat.type === "Diffuse";

    if (useCache && isDiffuse) {
        const cachedColor = cache.get(p);
        if (cachedColor) return cachedColor;
    }

    const albedo = e.color ?? e.colors[0];

    if (e.emissive) {
        const result = albedo;
        if (useCache) cache.set(p, result);
        return result;
    }

    const n = e.normalToPoint(p);
    const directColor = (importanceSampling && isDiffuse)
        ? albedo.mul(colorFromLight(p, n, scene, { bounces: bounces }))
        : Color.BLACK;

    if (bounces === 0) return directColor;

    const scatterRay = mat.scatter(ray, p, e);
    const scatterColor = rayTrace(scatterRay, scene, {
        ...options,
        bounces: bounces - 1,
    });

    const cosTheta = Math.abs(n.dot(scatterRay.dir));
    const finalColor = directColor.add(albedo.mul(scatterColor).scale(cosTheta));

    if (useCache && isDiffuse) cache.set(p, finalColor);
    return finalColor;
}

/**
 * Samples lights directly to reduce noise.
 */
function colorFromLight(p0, normal, scene, options) {
    const { bounces } = options ?? { bounces: 5 };
    const emissiveElements = scene.getElements().filter((e) => e.emissive);
    let accColor = Color.BLACK;
    let totalSamples = 0;

    for (const light of emissiveElements) {
        const lightArea = light.area ? light.area() : 0;
        if (lightArea <= 0) continue;

        for (let j = 0; j < bounces; j++) {
            totalSamples++;
            const lightP0 = light.sample();
            const toLight = lightP0.sub(p0);
            const distSq = toLight.squareLength();
            const dir = toLight.scale(1 / Math.sqrt(distSq));

            const hit = scene.interceptWith(Ray(p0, dir));
            if (!hit || !hit[2].emissive) continue;

            const lightColor = hit[2].color ?? hit[2].colors[0];
            const cosLight = Math.abs(dir.dot(normal));

            const geometryTerm = (lightArea * cosLight) / distSq;
            const contribution = geometryTerm / TWO_PI;
            accColor = accColor.add(lightColor.scale(contribution));
        }
    }

    return totalSamples === 0 ? Color.BLACK : accColor.scale(1 / totalSamples);
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
            const oldNx = nx;
            nx = Math.sign(oldNx) * (1 - Math.abs(ny));
            ny = Math.sign(ny) * (1 - Math.abs(oldNx));
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
        return accColor.scale(1 / (validSamples + 1));
        // const h = ans.hash(p);
        // return Math.random() < 0.5 ? point2ColorMap[h] : undefined;
    }
    return ans;
}
const cache = radianceCache(0.05);
