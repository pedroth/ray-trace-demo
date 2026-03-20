import Color from "./Color.js";
import Ray from "./Ray.js";

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
    let firstHitIsDiffuse = false;
    let totalColor = Color.BLACK;

    for (let i = 0; i <= bounces; i++) {
        const hit = scene.interceptWith(currentRay);
        if (!hit) {
            if (useCache && firstHitIsDiffuse) cache.set(firstHitPosition, totalColor);
            return totalColor;
        }

        const [t, p, e] = hit;
        const mat = e.material;
        const isDiffuse = mat.type === "Diffuse";

        if (i === 0) {
            firstHitPosition = p;
            firstHitIsDiffuse = isDiffuse;
        }

        // 1. Cache Lookup
        if (useCache && isDiffuse) {
            const cachedColor = cache.get(p);
            if (cachedColor) {
                const result = totalColor.add(cachedColor.mul(albedoAcc));
                if (firstHitIsDiffuse) cache.set(firstHitPosition, result);
                return result;
            }
        }

        // 2. Hit a Light Source (Emissive)
        if (e.emissive) {
            const lightColor = e.color ?? e.colors[0];
            const finalColor = totalColor.add(lightColor.mul(albedoAcc));
            if (useCache && firstHitIsDiffuse) cache.set(firstHitPosition, finalColor);
            return finalColor;
        }

        const albedo = e.color ?? e.colors[0];
        const normal = e.normalToPoint(p);

        // 3. Explicit Light Sampling (Next Event Estimation)
        if (importanceSampling && isDiffuse) {
            const directLight = albedoAcc.mul(albedo).mul(colorFromLight(p, normal, scene, { bounces }));
            totalColor = totalColor.add(directLight);
        }

        // Last bounce: no more scattering (matches recursive bounces=0)
        if (i === bounces) {
            if (useCache && firstHitIsDiffuse) cache.set(firstHitPosition, totalColor);
            return totalColor;
        }

        // 4. Prepare for next bounce
        const scatterRay = mat.scatter(currentRay, p, e);
        const cosTheta = Math.abs(normal.dot(scatterRay.dir));

        albedoAcc = albedoAcc.mul(albedo).scale(cosTheta);
        currentRay = scatterRay;
    }

    return totalColor;
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

/**
 * Simple Spatial Hash Cache
 */
const lightColorCache = (gridSpace) => {
    const point2ColorMap = {};
    const point2Ite = {};
    const ans = {};

    ans.hash = (p) => {
        const x = Math.floor(p.x / gridSpace);
        const y = Math.floor(p.y / gridSpace);
        const z = Math.floor(p.z / gridSpace);
        return Math.abs((x * 92837111) ^ (y * 689287499) ^ (z * 283923481));
    };

    ans.set = (p, c) => {
        const h = ans.hash(p);
        point2Ite[h] = (point2Ite[h] ?? 0) + 1;
        const prevColor = point2ColorMap[h] ?? Color.BLACK;
        point2ColorMap[h] = prevColor.add(c.sub(prevColor).scale(1 / point2Ite[h]));
    };

    ans.get = (p) => {
        if (Math.random() > 0.25) return undefined;
        const h = ans.hash(p);
        return point2ColorMap[h];
    };

    return ans;
};

const cache = lightColorCache(0.05);