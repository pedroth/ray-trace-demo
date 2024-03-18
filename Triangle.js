import Box from "./Box.js";
import Color from "./Color.js";
import { Vec2, Vec3 } from "./Vector.js";

export default class Triangle {
    constructor({ name, positions, colors, texCoords, normals, texture, emissive }) {
        this.name = name;
        this.colors = colors;
        this.normals = normals;
        this.texture = texture;
        this.positions = positions;
        this.texCoords = texCoords;
        this.emissive = emissive;
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

    normalToPoint() {
        return this.faceNormal;
    }

    interceptWith(ray) {
        const v = ray.dir;
        const p = ray.init.sub(this.positions[0]);
        const n = this.faceNormal;
        const t = - n.dot(p) / n.dot(v);
        if (t <= 1e-9) return;
        const x = ray.trace(t);
        for (let i = 0; i < this.positions.length; i++) {
            const xi = this.positions[i];
            const u = x.sub(xi);
            const ni = n.cross(this.edges[i]).normalize();
            const dot = ni.dot(u);
            if (dot < 0) return;
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

    static builder() {
        return new TriangleBuilder();
    }
}

const indx = [1, 2, 3];
class TriangleBuilder {
    constructor() {
        this._name;
        this._texture;
        this._normals = indx.map(() => Vec3());
        this._colors = indx.map(() => Color.BLACK);
        this._positions = indx.map(() => Vec3());
        this._texCoords = indx.map(() => Vec2());
        this._emissive = false;
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

    texCoords(t1, t2, t3) {
        if ([t1, t2, t3].some(x => !x)) return this;
        this._texCoords = [t1, t2, t3];
        return this;
    }

    normals(n1, n2, n3) {
        if ([n1, n2, n3].some(x => !x)) return this;
        this._normals = [n1, n2, n3];
        return this;
    }

    texture(image) {
        this._texture = image
        return this;
    }

    emissive(isEmissive) {
        this._emissive = isEmissive;
        return this;
    }

    build() {
        const attrs = {
            name: this._name,
            colors: this._colors,
            normals: this._normals,
            positions: this._positions,
            texCoords: this._texCoords,
            emissive: this._emissive
        };
        if (Object.values(attrs).some((x) => x === undefined)) {
            throw new Error("Triangle is incomplete");
        }
        return new Triangle({ ...attrs, texture: this._texture });
    }
}