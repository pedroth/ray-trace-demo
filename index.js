import Camera from "./Camera.js";
import Canvas from "./Canvas.js";
import Color from "./Color.js";
import Scene from "./Scene.js";
import Triangle from "./Triangle.js";
import Point from "./Point.js";
import { Vec2, Vec3 } from "./Vector.js";

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
        sphericalCoords: Vec3(7, 0, 0),
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
            .positions(Vec3(), Vec3(3, 0, 0), Vec3(3, 0, 3))
            .build(),
        Triangle
            .builder()
            .name("left-2")
            .colors(Color.RED, Color.RED, Color.RED)
            .positions(Vec3(3, 0, 3), Vec3(0, 0, 3), Vec3())
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
            .positions(Vec3(0, 0, 3), Vec3(3, 0, 3), Vec3(3, 3, 3))
            .build(),
        Triangle
            .builder()
            .name("top-2")
            .colors(Color.WHITE, Color.WHITE, Color.WHITE)
            .positions(Vec3(3, 3, 3), Vec3(0, 3, 3), Vec3(0, 0, 3))
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
    )
    // add light and sphere
    scene.add(
        Triangle
            .builder()
            .name("light")
            .colors(Color.WHITE, Color.WHITE, Color.WHITE)
            .positions(Vec3(1, 0, 0), Vec3(0, 1, 0), Vec3(0, 0, 1))
            .emissive(true)
            .build(),
        Point
            .builder()
            .radius(0.5)
            .name("sphere")
            .color(Color.WHITE)
            // .emissive(true)
            .position(Vec3(1.5, 1.5, 1.5))
            .build(),
    )

    // play
    const play = async ({ time, oldT }) => {
        const newT = new Date().getTime();
        const dt = (new Date().getTime() - oldT) * 1e-3;
        camera.sceneShot(scene).to(exposedCanvas);
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
    document.body.appendChild(canvas.DOM);
})()