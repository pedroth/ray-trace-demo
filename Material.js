import Ray from "./Ray.js";
import Vec from "./Vector.js";

export function Lambertian() {
    return {
        scatter(inRay, point, element) {
            let normal = element.normalToPoint(point);
            const randomInSphere = randomPointInSphere();
            if (randomInSphere.dot(normal) >= 0) return Ray(point, randomInSphere);
            return Ray(point, randomInSphere.scale(-1));
        }
    }
}

export function Metallic(fuzz = 0) {
    return {
        scatter(inRay, point, element) {
            fuzz = Math.min(1, Math.max(0, fuzz));
            let normal = element.normalToPoint(point);
            // normal = inRay.dir.dot(normal) <= 0 ? normal : normal.scale(-1);
            const v = inRay.dir;
            let reflected = v.sub(normal.scale(2 * v.dot(normal)));
            reflected = reflected.add(randomPointInSphere().scale(fuzz)).normalize();
            return Ray(point, reflected);
        }
    }
}

export function Transparent(alpha=1) {
    return {
        scatter(inRay, point, element) {
            if(Math.random() < alpha) return Lambertian().scatter(inRay, point, element);
            return Ray(point, inRay.dir.scale(-1));
        }
    }
}

function randomPointInSphere() {
    let randomInSphere = undefined;
    while (true) {
        const random = Vec.RANDOM(3).map(x => 2 * x - 1);
        if (random.squareLength() >= 1) continue;
        randomInSphere = random.normalize();
        break;
    }
    return randomInSphere;
}