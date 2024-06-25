import Box from "./Box.js";
import Color from "./Color.js";
import { Diffuse } from "./Material.js";
import Vec, { Vec2, Vec3 } from "./Vector.js";

export default class Triangle {
    constructor({ name, positions, colors, emissive, material }) {
        this.name = name;
        this.colors = colors;
        this.positions = positions;
        this.emissive = emissive;
        this.material = material;
        this.edges = [];
        const n = this.positions.length;
        for (let i = 0; i < n; i++) {
            this.edges.push(this.positions[(i + 1) % n].sub(this.positions[i]));
        }
        this.tangents = [this.edges[0], this.edges.at(-1).scale(-1)];
        const u = this.tangents[0];
        const v = this.tangents[1];
        this.faceNormal = u.cross(v).normalize();
    }

    distanceToPoint(p) {
        // TODO
        return Number.MAX_VALUE;
    }

    normalToPoint(p) {
        const r = p.sub(this.positions[0]);
        const dot = this.faceNormal.dot(r);
        return dot >= 0 ? this.faceNormal : this.faceNormal.scale(-1);
    }

    interceptWith(ray) {
        const epsilon = 1e-9
        const v = ray.dir;
        const p = ray.init.sub(this.positions[0]);
        const n = this.faceNormal;
        const t = - n.dot(p) / n.dot(v);
        if (t <= epsilon) return;
        const x = ray.trace(t);
        for (let i = 0; i < this.positions.length; i++) {
            const xi = this.positions[i];
            const u = x.sub(xi);
            const ni = n.cross(this.edges[i]).normalize();
            const dot = ni.dot(u);
            if (dot <= epsilon) return;
        }
        return [x, this];
    }

    getBoundingBox() {
        if (this.boundingBox) return this.boundingBox;
        this.boundingBox = this.positions.reduce((box, x) => box.add(new Box(x, x)), Box.EMPTY);
        return this.boundingBox;
    }

    sample() {
        return this.tangents[0].scale(Math.random()).add(this.tangents[1].scale(Math.random())).add(this.positions[0]);
    }

    isInside(p) {
        return this.faceNormal.dot(p.sub(this.positions[0])) >= 0;
    }

    serialize() {
        return {
            type: Triangle.name,
            name: this.name,
            emissive: this.emissive,
            colors: this.colors.map(x => x.toArray()),
            positions: this.positions.map(x => x.toArray()),
        }
    }

    static deserialize(json) {
        return Triangle
            .builder()
            .name(json.name)
            .positions(...json.positions.map(x => Vec.fromArray(x)))
            .colors(...json.colors.map(x => new Color(x)))
            .emissive(json.emissive)
            .build()
    }

    static builder() {
        return new TriangleBuilder();
    }
}

const indx = [1, 2, 3];
class TriangleBuilder {
    constructor() {
        this._name;
        this._colors = indx.map(() => Color.BLACK);
        this._positions = indx.map(() => Vec3());
        this._emissive = false;
        this._material = Diffuse();
    }

    name(name) {
        this._name = name;
        return this;
    }

    positions(v1, v2, v3) {
        if ([v1, v2, v3].some(x => !x)) return this;
        this._positions = [v1, v2, v3];
        return this;
    }

    colors(c1, c2, c3) {
        if ([c1, c2, c3].some(x => !x)) return this;
        this._colors = [c1, c2, c3];
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
            colors: this._colors,
            positions: this._positions,
            emissive: this._emissive,
            material: this._material
        };
        if (Object.values(attrs).some((x) => x === undefined)) {
            throw new Error("Triangle is incomplete");
        }
        return new Triangle({ ...attrs });
    }
}