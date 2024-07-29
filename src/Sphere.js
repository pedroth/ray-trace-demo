import Box from "./Box.js";
import Color from "./Color.js";
import { Diffuse, MATERIALS } from "./Material.js";
import Vec, { Vec2, Vec3 } from "./Vector.js";

class Sphere {
    constructor({ name, position, color, radius, emissive, material }) {
        this.name = name;
        this.color = color;
        this.radius = radius;
        this.position = position;
        this.emissive = emissive;
        this.material = material;
    }

    distanceToPoint(p) {
        return this.position.sub(p).length() - this.radius;
    }

    normalToPoint(p) {
        const r = p.sub(this.position);
        const length = r.length();
        return length > this.radius ? r.normalize() : r.scale(-1).normalize();
    }

    interceptWith(ray) {
        const epsilon = 1e-9;
        const t = sphereInterception(this, ray);
        if (t) {
            let pointOfIntersection = ray.trace(t - epsilon);
            return [pointOfIntersection, this];
        }
    }

    getBoundingBox() {
        if (this.boundingBox) return this.boundingBox;
        const n = this.position.dim;
        this.boundingBox = new Box(
            this.position.add(Vec.ONES(n).scale(-this.radius)),
            this.position.add(Vec.ONES(n).scale(this.radius))
        );
        return this.boundingBox;
    }

    sample() {
        let randomInSphere = undefined;
        while (true) {
            const random = Vec.RANDOM(this.position.dim).map(x => 2 * x - 1);
            if (random.squareLength() >= 1) continue;
            randomInSphere = random.normalize();
            break;
        }
        return randomInSphere.scale(this.radius).add(this.position);
    }

    isInside(p) {
        return p.sub(this.position).length() < this.radius;
    }

    serialize() {
        return {
            type: Sphere.name,
            name: this.name,
            radius: this.radius,
            emissive: this.emissive,
            color: this.color.toArray(),
            position: this.position.toArray(),
            material: {type: this.material.type, args: this.material.args}
        }
    }

    static deserialize(json) {
        const {type, args} = json.material;
        return Sphere
            .builder()
            .name(json.name)
            .radius(json.radius)
            .position(Vec.fromArray(json.position))
            .color(new Color(json.color))
            .emissive(json.emissive)
            .material(MATERIALS[type](...args))
            .build()
    }

    static builder() {
        return new SphereBuilder();
    }
}

class SphereBuilder {
    constructor() {
        this._name;
        this._radius = 1;
        this._color = Color.BLACK;
        this._position = Vec3();
        this._emissive = false;
        this._material = Diffuse();
    }

    name(name) {
        this._name = name;
        return this;
    }

    color(color) {
        if (!color) return this;
        this._color = color;
        return this;
    }

    radius(radius) {
        if (!radius) return this;
        this._radius = radius;
        return this;
    }

    position(posVec3) {
        if (!posVec3) return this;
        this._position = posVec3;
        return this;
    }

    emissive(isEmissive) {
        this._emissive = isEmissive;
        return this;
    }

    material(material) {
        this._material = material;
        return this;
    }

    build() {
        const attrs = {
            name: this._name,
            color: this._color,
            radius: this._radius,
            position: this._position,
            emissive: this._emissive,
            material: this._material
        }
        if (Object.values(attrs).some((x) => x === undefined)) {
            throw new Error("Sphere is incomplete");
        }
        return new Sphere({ ...attrs, });
    }
}


function sphereInterception(point, ray) {
    const { init, dir } = ray;
    const diff = init.sub(point.position);
    const b = 2 * dir.dot(diff);
    const c = diff.squareLength() - point.radius * point.radius;
    const discriminant = b * b - 4 * c; // a = 1
    if (discriminant < 0) return;
    const sqrt = Math.sqrt(discriminant);
    const [t1, t2] = [(-b - sqrt) / 2, (-b + sqrt) / 2];
    const t = Math.min(t1, t2);
    const tM = Math.max(t1, t2);
    if (t1 * t2 < 0) return tM;
    return t1 >= 0 && t2 >= 0 ? t : undefined;
}

export default Sphere;