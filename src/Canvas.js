import { CHANNELS, MAX_8BIT } from "./Constants.js";

export default class Canvas {

  constructor(canvas) {
    this._canvas = canvas;
    this._width = canvas.width;
    this._height = canvas.height;
    this._ctx = this._canvas.getContext("2d", { willReadFrequently: true });
    this._imageData = this._ctx.getImageData(0, 0, this._width, this._height);
    this._image = this._imageData.data; // by changing this, imageData is change magically
  }

  get width() {
    return this._canvas.width;
  }

  get height() {
    return this._canvas.height;
  }

  get DOM() {
    return this._canvas;
  }

  /**
    * color: Color
    */
  fill(color) {
    return this.map(() => color);
  }

  /**
   * lambda: (x: Number, y: Number, c: color) => Color
   */
  map(lambda) {
    const n = this._image.length;
    const w = this._width;
    const h = this._height;
    for (let k = 0; k < n; k += CHANNELS) {
      const i = Math.floor(k / (CHANNELS * w));
      const j = Math.floor((k / CHANNELS) % w);
      const x = j;
      const y = h - 1 - i;
      const color = lambda(x, y);
      if (!color) continue;
      this._image[k] = color.red * MAX_8BIT;
      this._image[k + 1] = color.green * MAX_8BIT;
      this._image[k + 2] = color.blue * MAX_8BIT;
      this._image[k + 3] = MAX_8BIT;
    }
    return this.paint();
  }

  exposure(time = Number.MAX_VALUE) {
    let it = 1;
    const ans = {};
    for (let key of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), key);
      if (descriptor && typeof descriptor.value === 'function') {
        ans[key] = descriptor.value.bind(this);
      }
    }
    ans.width = this.width;
    ans.height = this.height;
    ans.map = (lambda) => {
      const n = this._image.length;
      const w = this._width;
      const h = this._height;
      for (let k = 0; k < n; k += CHANNELS) {
        const i = Math.floor(k / (CHANNELS * w));
        const j = Math.floor((k / CHANNELS) % w);
        const x = j;
        const y = h - 1 - i;
        const color = lambda(x, y);
        if (!color) continue;
        this._image[k] = this._image[k] + (color.red * MAX_8BIT - this._image[k]) / it;
        this._image[k + 1] = this._image[k + 1] + (color.green * MAX_8BIT - this._image[k + 1]) / it;
        this._image[k + 2] = this._image[k + 2] + (color.blue * MAX_8BIT - this._image[k + 2]) / it;
        this._image[k + 3] = MAX_8BIT;
      }
      if (it < time) it++
      return this.paint();
    }

    ans.drawSquare = (minP, maxP, shader) => {
      for (let x = minP.x; x < maxP.x; x++) {
        for (let y = minP.y; y < maxP.y; y++) {
          ans.setPxl(x, y, shader(x, y));
        }
      }
      return this;
    }

    ans.setPxl = (x, y, color) => {
      const w = this._width;
      const [i, j] = this.canvas2grid(x, y);
      let index = 4 * (w * i + j);
      this._image[index] = this._image[index] + (color.red * MAX_8BIT - this._image[index]) / it;
      this._image[index + 1] = this._image[index + 1] + (color.green * MAX_8BIT - this._image[index + 1]) / it;
      this._image[index + 2] = this._image[index + 2] + (color.blue * MAX_8BIT - this._image[index + 2]) / it;
      this._image[index + 3] = MAX_8BIT;
      return this;
    }

    ans.setPxlData = (index, [r, g, b]) => {
      this._image[index] = this._image[index] + (r * MAX_8BIT - this._image[index]) / it;
      this._image[index + 1] = this._image[index + 1] + (g * MAX_8BIT - this._image[index + 1]) / it;
      this._image[index + 2] = this._image[index + 2] + (b * MAX_8BIT - this._image[index + 2]) / it;
      this._image[index + 3] = MAX_8BIT;
      return ans;
    }

    ans.paint = () => {
      if (it < time) it++
      return this.paint();
    }
    return ans;
  }

  paint() {
    this._ctx.putImageData(this._imageData, 0, 0);
    return this;
  }

  onMouseDown(lambda) {
    this._canvas.addEventListener("mousedown", handleMouse(this, lambda), false);
    this._canvas.addEventListener("touchstart", handleMouse(this, lambda), false);
    return this;
  }

  onMouseUp(lambda) {
    this._canvas.addEventListener("mouseup", handleMouse(this, lambda), false);
    this._canvas.addEventListener("touchend", handleMouse(this, lambda), false);
    return this;
  }

  onMouseMove(lambda) {
    this._canvas.addEventListener("mousemove", handleMouse(this, lambda), false);
    this._canvas.addEventListener("touchmove", handleMouse(this, lambda), false);
    return this;
  }

  onMouseWheel(lambda) {
    this._canvas.addEventListener("wheel", lambda, false)
  }

  drawLine(p1, p2, shader) {
    const w = this._width;
    const h = this._height;
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
      const index = 4 * (i * w + j);
      const color = shader(x, y);
      if (!color) continue;
      this._image[index] = color.red * MAX_8BIT;
      this._image[index + 1] = color.green * MAX_8BIT;
      this._image[index + 2] = color.blue * MAX_8BIT;
      this._image[index + 3] = 255;
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
    this._canvas.width = width;
    this._canvas.height = height;
    this._width = this._canvas.width;
    this._height = this._canvas.height;
    this._ctx = this._canvas.getContext("2d", { willReadFrequently: true });
    this._imageData = this._ctx.getImageData(0, 0, this._width, this._height);
    this._image = this._imageData.data;
  }

  startVideoRecorder() {
    let responseBlob;
    const canvasSnapshots = [];
    const stream = this._canvas.captureStream();
    const recorder = new MediaRecorder(stream);
    recorder.addEventListener("dataavailable", e => canvasSnapshots.push(e.data));
    recorder.start();
    recorder.onstop = () => (responseBlob = new Blob(canvasSnapshots, { type: 'video/webm' }));
    return {
      stop: () => new Promise((re) => {
        recorder.stop();
        setTimeout(() => re(responseBlob));
      })
    };
  }

  grid2canvas(i, j) {
    const h = this.height;
    const x = j;
    const y = h - 1 - i;
    return [x, y]
  }

  canvas2grid(x, y) {
    const h = this._height;
    const j = Math.floor(x);
    const i = Math.floor(h - 1 - y);
    return [i, j];
  }

  setPxl(x, y, color) {
    const w = this._width;
    const [i, j] = this.canvas2grid(x, y);
    let index = 4 * (w * i + j);
    this._image[index] = color.red * MAX_8BIT;
    this._image[index + 1] = color.green * MAX_8BIT;
    this._image[index + 2] = color.blue * MAX_8BIT;
    this._image[index + 3] = MAX_8BIT;
    return this;
  }

  getPxl(x, y) {
    const w = this._width;
    const h = this._height;
    let [i, j] = this.canvas2grid(x, y);
    i = mod(i, h);
    j = mod(j, w);
    let index = 4 * (w * i + j);
    return Color.ofRGBRaw(this._image[index], this._image[index + 1], this._image[index + 2], this._image[index + 3]);
  }

  setPxlData(index, [r, g, b]) {
    this._image[index] = r * MAX_8BIT;
    this._image[index + 1] = g * MAX_8BIT;
    this._image[index + 2] = b * MAX_8BIT;
    this._image[index + 3] = MAX_8BIT;
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

  static ofDOM(canvasDOM) {
    return new Canvas(canvasDOM);
  }

  static ofCanvas(canvas) {
    return new Canvas(canvas._canvas);
  }

  static ofUrl(url) {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      img.src = url;
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(Canvas.ofDOM(canvas));
      };
    });
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
    const rect = canvas._canvas.getBoundingClientRect();
    // different coordinates from canvas DOM image data
    const mx = (event.clientX - rect.left) / rect.width, my = (event.clientY - rect.top) / rect.height;
    const x = Math.floor(mx * w);
    const y = Math.floor(h - 1 - my * h);
    return lambda(x, y);
  }
}