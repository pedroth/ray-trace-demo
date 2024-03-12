import Box from "./Box.js";
import { argmin } from "./Math.js";

export default class Scene {
  constructor() {
    this.id2ElemMap = {};
    this.sceneElements = [];
    this.boundingBox = new Box();
  }

  add(...elements) {
    return this.addList(elements);
  }

  addList(elements) {
    for (let i = 0; i < elements.length; i++) {
      const elem = elements[i];
      const { name } = elem;
      this.boundingBox = this.boundingBox.add(elem.getBoundingBox());
      this.id2ElemMap[name] = elem;
      this.sceneElements.push(elem);
    }
    return this;
  }

  clear() {
    this.id2ElemMap = {};
    this.sceneElements = [];
  }

  getElements() {
    return this.sceneElements;
  }

  interceptWith(ray) {
    const elements = this.sceneElements;
    let closestDistance = Number.MAX_VALUE;
    let closest = undefined;
    if (!this.boundingBox.interceptWith(ray)) return;
    for (let i = 0; i < elements.length; i++) {
      const interception = elements[i].interceptWith(ray)
      if (!interception) continue;
      const [pos, _] = interception;
      const distance = ray
        .init
        .sub(pos)
        .length();
      if (distance < closestDistance) {
        closest = interception;
        closestDistance = distance;
      }
    }
    return closest;
  }

  getElementNear(p) {
    return this.sceneElements[argmin(this.sceneElements, x => x.distanceToPoint(p))];
  }

  debug(params) {
    return params.canvas;
  }
}
