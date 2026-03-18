import Color from "./Color.js";
import Ray from "./Ray.js";
import { randomPointInSphere } from "./Utils.js";

//========================================================================================
// MIS helpers (Veach power heuristic)
//========================================================================================
const TWO_PI = 2 * Math.PI;
const BSDF_PDF_EFF = 1; // code convention: uniform hemisphere PDF treated as 1

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

function computeNEE(p, n, albedoAcc, albedo, scene, importanceSampling, isDiffuse) {
    if (!importanceSampling || !isDiffuse) return Color.BLACK;
    return albedoAcc.mul(albedo).mul(colorFromLight(p, n, scene));
}

//========================================================================================

export function rayTraceFor(ray, scene, options) {
    const { bounces, importanceSampling, useCache } = options;
    let albedoAcc = Color.WHITE;
    let currentRay = ray;
    let firstHit = undefined;
    let prevDiffuse = false;
    let result = Color.BLACK;
    for (let i = 0; i < bounces; i++) {
        const hit = scene.interceptWith(currentRay)
        if (!hit) return result;

        const [t, p, e] = hit;
        const mat = e.material;
        if (i === 0) {
            firstHit = p;
        }
        if (useCache && mat.type === "Diffuse") {
            const cachedColor = cache.get(p);
            if (cachedColor) { return result.add(cachedColor); }
        }
        if (e.emissive) {
            const emissiveColor = getAlbedo(e);
            const w = bsdfMISWeight(currentRay, t, p, e, importanceSampling, prevDiffuse);
            const attenuation = e.normalToPoint(p).dot(currentRay.dir);
            const finalColor = albedoAcc.mul(emissiveColor).scale(w * 2 * attenuation);
            if (useCache && mat.type === "Diffuse") { cache.set(firstHit, finalColor); }
            return result.add(finalColor);
        }
        const albedo = getAlbedo(e);
        const n = e.normalToPoint(p);
        const isDiffuse = mat.type === "Diffuse";

        result = result.add(computeNEE(p, n, albedoAcc, albedo, scene, importanceSampling, isDiffuse));

        let scatterRay = mat.scatter(currentRay, p, e);
        const attenuation = Math.abs(n.dot(scatterRay.dir));
        albedoAcc = albedoAcc.mul(albedo).scale(attenuation);
        currentRay = scatterRay;
        prevDiffuse = isDiffuse;
    }
    return result;
}

export function rayTrace(ray, scene, options) {
    const { bounces, importanceSampling, useCache } = options;
    if (bounces < 0) return Color.BLACK;
    const hit = scene.interceptWith(ray)
    if (!hit) return Color.BLACK;
    const [t, p, e] = hit;
    const mat = e.material;
    if (useCache && mat.type === "Diffuse") {
        const cachedColor = cache.get(p);
        if (cachedColor) { return cachedColor; }
    }
    const albedo = getAlbedo(e);
    if (e.emissive) {
        const w = bsdfMISWeight(ray, t, p, e, importanceSampling, options._prevDiffuse);
        const result = albedo.scale(w);
        if (useCache) { cache.set(p, result); }
        return result;
    }
    const n = e.normalToPoint(p);
    const isDiffuse = mat.type === "Diffuse";

    const neeColor = computeNEE(p, n, Color.WHITE, albedo, scene, importanceSampling, isDiffuse);

    if (bounces === 0) {
        if (useCache && isDiffuse) { cache.set(p, neeColor); }
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
    if (useCache && isDiffuse) { cache.set(p, finalColor); }
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
            const ite = point2Ite[h];
            const prevColor = point2ColorMap[h];
            point2ColorMap[h] = prevColor.add(c.sub(prevColor).scale(1 / ite));
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
const cache = lightColorCache(0.05);
