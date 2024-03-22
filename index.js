import Camera from "./Camera.js";
import Canvas from "./Canvas.js";
import Color from "./Color.js";
import Scene from "./Scene.js";
import Triangle from "./Triangle.js";
import Point from "./Point.js";
import Vec, { Vec2, Vec3 } from "./Vector.js";
import Ray from "./Ray.js";
import { DiElectric, Metallic, Transparent } from "./Material.js";

function toggleFullScreen(elem) {
    if (!document.fullscreenElement &&    // alternative standard method
        !document.mozFullScreenElement &&
        !document.webkitFullscreenElement &&
        !document.msFullscreenElement) {  // current working methods
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    }
}

(() => {
    const w = 640 / 2;
    const h = 480 / 2;
    const canvas = Canvas.ofSize(w, h);
    let exposedCanvas = canvas.exposure();
    const camera = new Camera({
        sphericalCoords: Vec3(3, 0, 0),
        focalPoint: Vec3(1.5, 1.5, 1.5)
    });
    // mouse handling
    let mousedown = false;
    let mouse = Vec2();
    canvas.onMouseDown((x, y) => {
        mousedown = true;
        mouse = Vec2(x, y);
    })
    canvas.onMouseUp(() => {
        mousedown = false;
        mouse = Vec2();
    })
    canvas.onMouseMove((x, y) => {
        const newMouse = Vec2(x, y);
        if (!mousedown || newMouse.equals(mouse)) {
            return;
        }
        const [dx, dy] = newMouse.sub(mouse).toArray();
        camera.sphericalCoords = camera.sphericalCoords.add(
            Vec3(
                0,
                -2 * Math.PI * (dx / canvas.width),
                -2 * Math.PI * (dy / canvas.height)
            )
        );
        mouse = newMouse;
        camera.orbit();
        exposedCanvas = canvas.exposure();
    })
    canvas.onMouseWheel(({ deltaY }) => {
        camera.sphericalCoords = camera.sphericalCoords.add(Vec3(deltaY * 0.001, 0, 0));
        camera.orbit();
        exposedCanvas = canvas.exposure();
    })
    // scene
    const scene = new Scene();
    // room
    scene.add(
        Triangle
            .builder()
            .name("left-1")
            .colors(Color.RED, Color.RED, Color.RED)
            .positions(Vec3(3, 0, 3), Vec3(3, 0, 0), Vec3())
            .build(),
        Triangle
            .builder()
            .name("left-2")
            .colors(Color.RED, Color.RED, Color.RED)
            .positions(Vec3(), Vec3(0, 0, 3), Vec3(3, 0, 3))
            .build(),
        Triangle
            .builder()
            .name("right-1")
            .colors(Color.GREEN, Color.GREEN, Color.GREEN)
            .positions(Vec3(0, 3, 0), Vec3(3, 3, 0), Vec3(3, 3, 3))
            .build(),
        Triangle
            .builder()
            .name("right-2")
            .colors(Color.GREEN, Color.GREEN, Color.GREEN)
            .positions(Vec3(3, 3, 3), Vec3(0, 3, 3), Vec3(0, 3, 0))
            .build(),
        Triangle
            .builder()
            .name("bottom-1")
            .colors(Color.WHITE, Color.WHITE, Color.WHITE)
            .positions(Vec3(), Vec3(3, 0, 0), Vec3(3, 3, 0))
            .build(),
        Triangle
            .builder()
            .name("bottom-2")
            .colors(Color.WHITE, Color.WHITE, Color.WHITE)
            .positions(Vec3(3, 3, 0), Vec3(0, 3, 0), Vec3())
            .build(),
        Triangle
            .builder()
            .name("top-1")
            .colors(Color.WHITE, Color.WHITE, Color.WHITE)
            .positions(Vec3(3, 3, 3), Vec3(3, 0, 3), Vec3(0, 0, 3))
            .build(),
        Triangle
            .builder()
            .name("top-2")
            .colors(Color.WHITE, Color.WHITE, Color.WHITE)
            .positions(Vec3(0, 0, 3), Vec3(0, 3, 3), Vec3(3, 3, 3))
            .build(),
        Triangle
            .builder()
            .name("back-1")
            .colors(Color.WHITE, Color.WHITE, Color.WHITE)
            .positions(Vec3(), Vec3(0, 3, 0), Vec3(0, 3, 3))
            .build(),
        Triangle
            .builder()
            .name("back-2")
            .colors(Color.WHITE, Color.WHITE, Color.WHITE)
            .positions(Vec3(0, 3, 3), Vec3(0, 0, 3), Vec3())
            .build(),
        Triangle
            .builder()
            .name("angle")
            .colors(Color.BLUE, Color.BLUE, Color.BLUE)
            .material(Metallic(0.02))
            .positions(Vec3(2, 1, 1), Vec3(1, 2, 1), Vec3(1, 1, 2))
            .build(),

    )
    // add light and sphere
    scene.add(
        Triangle
            .builder()
            .name("light-1")
            .colors(Color.WHITE, Color.WHITE, Color.WHITE)
            .positions(Vec3(1, 1, 2.9), Vec3(2, 1, 2.9), Vec3(2, 2, 2.9))
            .emissive(true)
            .build(),
        Triangle
            .builder()
            .name("light-2")
            .colors(Color.WHITE, Color.WHITE, Color.WHITE)
            .positions(Vec3(2, 2, 2.9), Vec3(1, 2, 2.9), Vec3(1, 1, 2.9))
            .emissive(true)
            .build(),
        // Point
        //     .builder()
        //     .radius(0.25)
        //     .name("sphere")
        //     .color(Color.ofRGB(1, 0, 1))
        //     .material(Metallic(0.25))
        //     .position(Vec3(0.5, 0.5, 1.5))
        //     .build(),
        // Point
        //     .builder()
        //     .radius(0.25)
        //     .name("metal-sphere")
        //     .color(Color.WHITE)
        //     .material(Metallic())
        //     .position(Vec3(1.5, 2.5, 1.5))
        //     .build(),
        // Point
        //     .builder()
        //     .radius(0.25)
        //     .name("glass-sphere")
        //     .color(Color.ofRGB(1, 1, 1))
        //     .material(DiElectric(2))
        //     .position(Vec3(2.5, 1.5, 1.5))
        //     .build(),
        // Triangle
        //     .builder()
        //     .name("alpha-tri")
        //     .colors(Color.ofRGB(1,1,0), Color.ofRGB(1,1,0), Color.ofRGB(1,1,0))
        //     .material(Metallic())
        //     .positions(Vec3(1, 0, 0), Vec3(0, 1, 0), Vec3(0, 0, 1))
        //     .build(),
        // Triangle
        //     .builder()
        //     .name("alpha-tri-2")
        //     .colors(Color.ofRGB(1, 1, 1), Color.ofRGB(1, 1, 1), Color.ofRGB(1, 1, 1))
        //     .material(DiElectric(2))
        //     .positions(Vec3(3, 1, 1), Vec3(3, 2, 1), Vec3(3, 1.5, 2))
        //     .build(),
        // Point
        //     .builder()
        //     .radius(0.25)
        //     .name("alpha-sphere")
        //     .color(Color.ofRGB(0, 1, 1))
        //     .position(Vec3(3, 1.5, 2))
        //     .material(Transparent(0.25))
        //     .build()
    )



    function debugTrace(p, n, bounces) {
        if (bounces <= 0) return;
        function scatter() {
            let randomInSphere = undefined;
            while (true) {
                const random = Vec.RANDOM(3).map(x => 2 * x - 1);
                if (random.squareLength() >= 1) continue;
                randomInSphere = random.normalize();
                break;
            }
            if (!n) return randomInSphere;
            if (randomInSphere.dot(n) >= 0) return randomInSphere;
            return randomInSphere.scale(-1);
        }
        const v = scatter();
        const hit = scene.interceptWith(Ray(p, v))
        if (!hit) {
            if (n) camera.rasterLine({ canvas, elem: { color: Color.ofRGB(1, 0, 1), positions: [p, p.add(v.scale(2))] } });
            return;
        }
        const [hitP, elem] = hit;
        if (elem.emissive) {
            camera.rasterLine({ canvas, elem: { color: elem.color || elem.colors[0], positions: [p, hitP] } });
            return;
        }
        camera.rasterLine({ canvas, elem: { color: elem.color || elem.colors[0], positions: [p, hitP] } });
        let normal = elem.normalToPoint(hitP);
        normal = v.dot(normal) <= 0 ? normal : normal.scale(-1);
        debugTrace(hitP, normal, bounces - 1);
    }

    // play
    const play = async ({ time, oldT }) => {
        const newT = new Date().getTime();
        const dt = (new Date().getTime() - oldT) * 1e-3;
        camera.sceneShot(scene).to(exposedCanvas);
        // camera.rayShot((r) => Color.ofRGB(0.5 * (r.dir.x + 1), 0.5 * (r.dir.y + 1), 0.5 * (r.dir.z + 1))).to(canvas);
        // debugTrace(Vec3(1.5, 1.5, 1), undefined, 10);
        setTimeout(() => play({
            oldT: newT,
            time: time + dt,
        }));
    }
    setTimeout(() => play({ oldT: new Date().getTime(), time: 0 }))

    const canvasDom = canvas.DOM;
    canvasDom.addEventListener("click", () => {
        toggleFullScreen(canvasDom);
    })

    const container = document.createElement("div");
    container.setAttribute("style", "display: flex; flex-grow: 1; margin: auto");
    canvasDom.setAttribute("style", "flex-grow: 0.5")
    container.appendChild(canvasDom);
    document.body.appendChild(container);
})()