import Box from "./Box.js";
import Color from "./Color.js";
import { CHANNELS, MAX_8BIT } from "./Constants.js";
import MyWorker from "./Utils.js";
import { Vec2 } from "./Vector.js";
import { mod } from "./Math.js";

const NUMBER_OF_CORES = navigator.hardwareConcurrency;
let WORKERS = [];

export default class Canvas {

  constructor(canvas) {
    this.width = Math.floor(canvas.width);;
    this.height = Math.floor(canvas.height);
    this.image = new Float32Array(CHANNELS * this.width * this.height);
    this.box = new Box(Vec2(0, 0), Vec2(this.width, this.height));
    this.canvas = canvas;
    if (this.canvas.setAttribute) this.canvas?.setAttribute('tabindex', '1'); // for canvas to be focusable
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.imageData = this.ctx.getImageData(0, 0, this.width, this.height);
  }

  get DOM() {
    return this.canvas;
  }

  paint() {
    const data = this.imageData.data;
    for (let i = 0; i < data.length; i++) {
      data[i] = this.image[i] * MAX_8BIT;
    }
    this.ctx.putImageData(this.imageData, 0, 0);
    return this;
  }

  fill(color = Color.BLACK) {
    const n = this.image.length;
    for (let k = 0; k < n; k += CHANNELS) {
      this.image[k] = color.red;
      this.image[k + 1] = color.green;
      this.image[k + 2] = color.blue;
      this.image[k + 3] = color.alpha;
    }
    return this;
  }

  /**
    * lambda: (x: Number, y: Number) => Color 
    */
  map(lambda) {
    const n = this.image.length;
    const w = this.width;
    const h = this.height;
    for (let k = 0; k < n; k += CHANNELS) {
      const i = Math.floor(k / (CHANNELS * w));
      const j = Math.floor((k / CHANNELS) % w);
      const x = j;
      const y = h - 1 - i;
      const color = lambda(x, y);
      if (!color) continue;
      this.image[k] = color.red;
      this.image[k + 1] = color.green;
      this.image[k + 2] = color.blue;
      this.image[k + 3] = color.alpha;
    }
    return this;
  }

  mapParallel(lambda, dependencies = []) {
    return {
      run: (vars = {}, memory = {}) => {
        const workersPromises = parallelWorkers(this, lambda, dependencies, vars, memory);
        return Promise
          .allSettled(workersPromises)
          .then(() => {
            return this;
          })
      }
    }
  }

  exposure(time = Number.MAX_VALUE) {
    let it = 1;
    const ans = {};
    // chatGPT
    for (let key of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), key);
      if (descriptor && typeof descriptor.value === 'function') {
        ans[key] = descriptor.value.bind(this);
      }
    }
    // end of chatGPT
    ans.width = this.width;
    ans.height = this.height;
    ans.map = (lambda) => {
      const n = this.image.length;
      const w = this.width;
      const h = this.height;
      for (let k = 0; k < n; k += 4) {
        const i = Math.floor(k / (4 * w));
        const j = Math.floor((k / 4) % w);
        const x = j;
        const y = h - 1 - i;
        const color = lambda(x, y);
        if (!color) continue;
        this.image[k] = this.image[k] + (color.red - this.image[k]) / it;
        this.image[k + 1] = this.image[k + 1] + (color.green - this.image[k + 1]) / it;
        this.image[k + 2] = this.image[k + 2] + (color.blue - this.image[k + 2]) / it;
        this.image[k + 3] = this.image[k + 3] + (color.alpha - this.image[k + 3]) / it;
      }
      if (it < time) it++
      return this;
    }

    ans.mapParallel = (lambda, dependencies = []) => {
      return {
        run: (vars = {}, memory = {}) => {
          const workersPromises = parallelWorkers(ans, lambda, dependencies, vars, memory);
          return Promise
            .allSettled(workersPromises)
            .then(() => {
              return ans;
            })
        }
      }
    }

    ans.setPxl = (x, y, color) => {
      const w = this.width;
      const [i, j] = this.canvas2grid(x, y);
      let index = 4 * (w * i + j);
      this.image[index] = this.image[index] + (color.red - this.image[index]) / it;
      this.image[index + 1] = this.image[index + 1] + (color.green - this.image[index + 1]) / it;
      this.image[index + 2] = this.image[index + 2] + (color.blue - this.image[index + 2]) / it;
      this.image[index + 3] = this.image[index + 3] + (color.alpha - this.image[index + 3]) / it;
      return this;
    }

    ans.setPxlData = (index, color) => {
      this.image[index] = this.image[index] + (color.red - this.image[index]) / it;
      this.image[index + 1] = this.image[index + 1] + (color.green - this.image[index + 1]) / it;
      this.image[index + 2] = this.image[index + 2] + (color.blue - this.image[index + 2]) / it;
      this.image[index + 3] = this.image[index + 3] + (color.alpha - this.image[index + 3]) / it;
      return ans;
    }

    ans.drawSquare = (minP, maxP, shader) => {
      for (let x = minP.x; x < maxP.x; x++) {
        for (let y = minP.y; y < maxP.y; y++) {
          ans.setPxl(x, y, shader(x, y));
        }
      }
      return ans;
    }

    ans.paint = () => {
      if (it < time) it++
      return this.paint();
    }

    ans.reset = () => {
      it = 1;
      return ans;
    }
    return ans;
  }


  gradual(size = 3, time = Number.MAX_VALUE) {
    let it = 1;
    let t_0 = 0;
    const nn = size * size;

    const ans = {};
    // chatGPT
    for (let key of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), key);
      if (descriptor && typeof descriptor.value === 'function') {
        ans[key] = descriptor.value.bind(this);
      }
    }
    // end of chatGPT
    ans.width = this.width;
    ans.height = this.height;
    ans.map = (lambda) => {
      const n = this.image.length;
      const w = this.width;
      const h = this.height;
      for (let k = 0; k < n; k += 4) {
        const i = Math.floor(k / (4 * w));
        const j = Math.floor((k / 4) % w);
        const x = j;
        const y = h - 1 - i;
        const i_0 = x % size;
        const j_0 = y % size;
        if ((size * j_0 + i_0) !== t_0) continue;
        const color = lambda(x, y);
        if (!color) continue;
        this.image[k] = this.image[k] + (color.red - this.image[k]) / it;
        this.image[k + 1] = this.image[k + 1] + (color.green - this.image[k + 1]) / it;
        this.image[k + 2] = this.image[k + 2] + (color.blue - this.image[k + 2]) / it;
        this.image[k + 3] = this.image[k + 3] + (color.alpha - this.image[k + 3]) / it;
      }
      t_0 = (t_0 + 1) % nn;
      if (it < time) it++
      return this;
    }

    return ans;
  }

  onMouseDown(lambda) {
    this.canvas.addEventListener("mousedown", handleMouse(this, lambda), false);
    this.canvas.addEventListener("touchstart", handleTouch(this, lambda), false);
    return this;
  }

  onMouseUp(lambda) {
    this.canvas.addEventListener("mouseup", handleMouse(this, lambda), false);
    this.canvas.addEventListener("touchend", handleTouch(this, lambda), false);
    return this;
  }

  onMouseMove(lambda) {
    this.canvas.addEventListener("mousemove", handleMouse(this, lambda), false);
    this.canvas.addEventListener("touchmove", handleTouch(this, lambda), false);
    return this;
  }

  onMouseWheel(lambda) {
    this.canvas.addEventListener("wheel", lambda, false);
    return this;
  }

  drawLine(p1, p2, shader) {
    const w = this.width;
    const h = this.height;
    const line = [p1, p2];
    if (line.length <= 1) return;
    const [pi, pf] = line;
    const v = pf.sub(pi);
    const n = v.map(Math.abs).fold((e, x) => e + x);
    for (let k = 0; k < n; k++) {
      const s = k / n;
      const lineP = pi.add(v.scale(s)).map(Math.floor);
      const [x, y] = lineP.toArray();
      const j = x;
      const i = h - 1 - y;
      const index = CHANNELS * (i * w + j);
      const color = shader(x, y);
      if (!color) continue;
      this.image[index] = color.red;
      this.image[index + 1] = color.green;
      this.image[index + 2] = color.blue;
      this.image[index + 3] = color.alpha;
    }
    return this;
  }

  drawSquare(minP, maxP, shader) {
    for (let x = minP.x; x < maxP.x; x++) {
      for (let y = minP.y; y < maxP.y; y++) {
        this.setPxl(x, y, shader(x, y));
      }
    }
    return this;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.imageData = this.ctx.getImageData(0, 0, this._width, this._height);
    this.image = this.imageData.data;
  }

  grid2canvas(i, j) {
    const h = this.height;
    const x = j;
    const y = h - 1 - i;
    return [x, y]
  }

  canvas2grid(x, y) {
    const h = this.height;
    const j = Math.floor(x);
    const i = Math.floor(h - 1 - y);
    return [i, j];
  }

  getPxl(x, y) {
    const w = this.width;
    const h = this.height;
    let [i, j] = this.canvas2grid(x, y);
    i = mod(i, h);
    j = mod(j, w);
    let index = 4 * (w * i + j);
    return Color.ofRGB(this.image[index], this.image[index + 1], this.image[index + 2], this.image[index + 3]);
  }

  setPxl(x, y, color) {
    const w = this.width;
    const [i, j] = this.canvas2grid(x, y);
    let index = CHANNELS * (w * i + j);
    this.image[index] = color.red;
    this.image[index + 1] = color.green;
    this.image[index + 2] = color.blue;
    this.image[index + 3] = color.alpha;
    return this;
  }

  setPxlData(index, color) {
    this.image[index] = color.red;
    this.image[index + 1] = color.green;
    this.image[index + 2] = color.blue;
    this.image[index + 3] = color.alpha;
    return this;
  }

  //========================================================================================
  /*                                                                                      *
   *                                    Static Methods                                    *
   *                                                                                      */
  //========================================================================================


  static ofSize(width, height) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('width', width);
    canvas.setAttribute('height', height);
    return new Canvas(canvas);
  }

}

//========================================================================================
/*                                                                                      *
 *                                         UTILS                                        *
 *                                                                                      */
//========================================================================================


function handleMouse(canvas, lambda) {
  return event => {
    const h = canvas.height;
    const w = canvas.width;
    const rect = canvas.canvas.getBoundingClientRect();
    // different coordinates from canvas DOM image data
    const mx = (event.clientX - rect.left) / rect.width, my = (event.clientY - rect.top) / rect.height;
    const x = Math.floor(mx * w);
    const y = Math.floor(h - 1 - my * h);
    return lambda(x, y);
  }
}

function handleTouch(canvas, lambda) {
  // Return the actual event handler function
  return event => {
    let touch;

    if (event.touches && event.touches.length > 0) {
      touch = event.touches[0];
    } else if (event.changedTouches && event.changedTouches.length > 0) {
      // Use the changed touch point for end or cancel events
      // Capturing the position where the finger was lifted.
      touch = event.changedTouches[0];
    } else {
      return;
    }

    const h = canvas.height;
    const w = canvas.width;
    const rect = canvas.canvas.getBoundingClientRect();
    // different coordinates from canvas DOM image data
    const mx = (touch.clientX - rect.left) / rect.width;
    const my = (touch.clientY - rect.top) / rect.height;
    const x = Math.floor(mx * w);
    const y = Math.floor(h - 1 - my * h);
    return lambda(x, y, event);
  };
}

function parallelWorkers(tela, lambda, dependencies = [], vars = {}, memory = {}) {
  // lazy loading workers
  if (WORKERS.length === 0) {
    // needs to be here...
    const isGithub = typeof window !== "undefined" && (window.location.host || window.LOCATION_HOST) === "pedroth.github.io";
    const SOURCE = isGithub ? "/ray-trace-demo" : ""
    WORKERS = [...Array(NUMBER_OF_CORES)].map(() => new MyWorker(`${SOURCE}/src/CanvasWorker.js`));
  }
  const w = tela.width;
  const h = tela.height;
  return WORKERS.map((worker, k) => {
    return new Promise((resolve) => {
      worker.onMessage(message => {
        const { image, startRow, endRow, } = message;
        let index = 0;
        const startIndex = CHANNELS * w * startRow;
        const endIndex = CHANNELS * w * endRow;
        for (let i = startIndex; i < endIndex; i += CHANNELS) {
          tela.setPxlData(i, Color.ofRGB(image[index++], image[index++], image[index++], image[index++]));
        }
        resolve();
      })
      const ratio = Math.floor(h / WORKERS.length);
      const message = {
        __vars: vars,
        __lambda: lambda.toString(),
        __width: w,
        __height: h,
        __startRow: k * ratio,
        __endRow: Math.min(h, (k + 1) * ratio),
        __dependencies: dependencies.map(d => d.toString()),
        __memory: memory
      };
      worker.postMessage(message)
    });
  })
}