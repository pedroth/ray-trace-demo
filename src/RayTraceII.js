import Color from "./Color.js";
import Ray from "./Ray.js";
import { randomPointInSphere } from "./Utils.js";
import { Vec3, Vec2 } from "./Vector.js";

//========================================================================================
// MIS helpers (Veach power heuristic)
//========================================================================================
const TWO_PI = 2 * Math.PI;
const BSDF_PDF_EFF = 1; // uniform hemisphere PDF treated as 1

function lightPdfEffective(distanceSquared, cosineLight, lightArea) {
    return TWO_PI * distanceSquared / (lightArea * Math.max(cosineLight, 1e-8));
}

function powerHeuristic(pdfA, pdfB) {
    const a2 = pdfA * pdfA;
    return a2 / (a2 + pdfB * pdfB);
}

function getAlbedo(element) {
    return element.color ?? element.colors[0];
}

function bsdfMISWeight(ray, t, p, element, importanceSampling, prevDiffuse) {
    if (!importanceSampling || !prevDiffuse || !element.area) return 1;
    const lightArea = element.area();
    const nLight = element.normalToPoint(p);
    const cosLight = Math.abs(ray.dir.dot(nLight));
    const pLight = lightPdfEffective(t * t, cosLight, lightArea);
    return powerHeuristic(BSDF_PDF_EFF, pLight);
}

function computeNEE(p, n, albedo, scene, importanceSampling, isDiffuse) {
    if (!importanceSampling || !isDiffuse) return Color.BLACK;
    return albedo.mul(colorFromLight(p, n, scene));
}

//========================================================================================

export function rayTrace(ray, scene, options) {
    const { bounces, importanceSampling, useCache } = options;
    if (bounces < 0) return Color.BLACK;
    const hit = scene.interceptWith(ray);
    if (!hit) return Color.BLACK;
    const [t, p, e] = hit;
    const mat = e.material;
    if (useCache) {
        const rayOut = Ray(p, ray.dir.scale(-1));
        const cachedColor = cache.get(rayOut);
        if (cachedColor) { return cachedColor; }
    }
    const albedo = getAlbedo(e);
    if (e.emissive) {
        const w = bsdfMISWeight(ray, t, p, e, importanceSampling, options._prevDiffuse);
        const result = albedo.scale(w);
        if (useCache) { cache.set(Ray(p, ray.dir.scale(-1)), result); }
        return result;
    }
    const n = e.normalToPoint(p);
    const isDiffuse = mat.type === "Diffuse";

    const neeColor = computeNEE(p, n, albedo, scene, importanceSampling, isDiffuse);

    if (bounces === 0) {
        if (useCache) { cache.set(Ray(p, ray.dir.scale(-1)), neeColor); }
        return neeColor;
    }

    let scatterRay = mat.scatter(ray, p, e);
    let scatterColor = rayTrace(
        scatterRay,
        scene,
        { ...options, bounces: bounces - 1, _prevDiffuse: isDiffuse }
    );
    const attenuation = Math.abs(n.dot(scatterRay.dir));
    let bsdfColor = albedo.mul(scatterColor).scale(attenuation);
    let finalColor = neeColor.add(bsdfColor);
    if (useCache) { cache.set(scatterRay, finalColor); }
    return finalColor;
}

function colorFromLight(p0, normal, scene, options) {
    const { bounces } = options ?? { bounces: 5 };
    const emissiveElements = scene.getElements().filter((e) => e.emissive);
    let accColor = Color.BLACK;
    let totalSamples = 0;
    for (let i = 0; i < emissiveElements.length; i++) {
        const light = emissiveElements[i];
        const lightArea = light.area ? light.area() : 0;
        if (lightArea <= 0) continue;
        for (let j = 0; j < bounces; j++) {
            totalSamples++;
            const lightP0 = light.sample();
            const toLight = lightP0.sub(p0);
            const distSq = toLight.squareLength();
            const dir = toLight.scale(1 / Math.sqrt(distSq));

            const cosSurface = dir.dot(normal);
            if (cosSurface <= 0) continue;

            let ray = Ray(p0, dir);
            const hit = scene.interceptWith(ray);
            if (!hit) continue;
            const [_, p, e] = hit;
            if (!e.emissive) continue;
            const color = getAlbedo(e);
            const nLight = e.normalToPoint(p);
            const cosLight = Math.abs(dir.dot(nLight));

            // MIS weight (power heuristic)
            const pLight = lightPdfEffective(distSq, cosLight, lightArea);
            const w = powerHeuristic(pLight, BSDF_PDF_EFF);

            // NEE estimator: Le * A * cos_x * cos_l / (2π * r²)
            const contribution = w * lightArea * cosSurface * cosLight / (TWO_PI * distSq);
            accColor = accColor.add(color.scale(contribution));
        }
    }
    if (totalSamples === 0) return Color.BLACK;
    return accColor.scale(1 / totalSamples);
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
