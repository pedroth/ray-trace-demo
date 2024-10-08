import Color from "./Color.js";
import Ray from "./Ray.js";

export function rayTrace(ray, scene, options) {
    const { bounces, importanceSampling, useCache } = options;
    if (bounces < 0) return importanceSampling ? colorFromLight(ray.init, scene) : Color.BLACK;
    const interception = scene.interceptWith(ray)
    if (!interception) return Color.BLACK;
    const [p, e] = interception;
    const cachedColor = cache.get(p);
    if (cachedColor && useCache) return cachedColor;
    const color = e.color ?? e.colors[0];
    const mat = e.material;
    let r = mat.scatter(ray, p, e);
    let finalC = rayTrace(
        r,
        scene,
        { ...options, bounces: bounces - 1 }
    );
    const dot = Math.max(0, r.dir.dot(e.normalToPoint(p)));
    const finalColor = e.emissive ? color.scale(dot).add(color.mul(finalC)) : color.mul(finalC);
    cache.set(p, finalColor);
    return finalColor;
}

function colorFromLight(p, scene) {
    const emissiveElements = scene.getElements().filter((e) => e.emissive);
    let c = Color.BLACK
    for (let i = 0; i < emissiveElements.length; i++) {
        const light = emissiveElements[i];
        const lightP = light.sample();
        const v = lightP.sub(p);
        const dir = v.normalize();
        const hit = scene.interceptWith(Ray(p, dir));
        if (!hit) continue;
        if (hit) {
            const [p, e] = hit;
            const color = e.color ?? e.colors[0];
            if (e.emissive) {
                const n = e.normalToPoint(p);
                const dot = Math.max(0, dir.dot(n));
                c = c.add(color.scale(dot));
            }
        }
    }
    return c;
}


const lightColorCache = (gridSpace) => {
    const point2ColorMap = {};
    const ans = {};
    ans.hash = (p) => {
        const integerCoord = p.map(z => Math.floor(z / gridSpace));
        const h = (integerCoord.x * 92837111) ^ (integerCoord.y * 689287499) ^ (integerCoord.z * 283923481);
        return Math.abs(h);
    }
    ans.set = (p, c) => {
        // if(c.equals(Color.BLACK)) return ans;
        const h = ans.hash(p);
        if (h in point2ColorMap) {
            point2ColorMap[h] = point2ColorMap[h].add(c).scale(0.5);
        } else {
            point2ColorMap[h] = c;
        }
        return ans;
    }
    ans.get = p => {
        const h = ans.hash(p);
        return Math.random() < 0.5 ? point2ColorMap[h] : undefined;
    }
    return ans;
}
const cache = lightColorCache(0.05);
