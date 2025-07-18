import * as kokomi from "kokomi.js";
import * as THREE from "three";

import TestObject from "./TestObject";
import WindowManager from "../WindowManager";

const useDefaultCube = false;

export default class World extends kokomi.Component {
  constructor(base) {
    super(base);

    /** 🔌 WEB‑SOCKET SETUP **********************************************/
    this.socket = new WebSocket("ws://localhost:8080");

    // nilai strength global yang bisa diubah lewat WS
    this.remoteStrength = 0;

    // terima data remote
    this.socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "strength") {
          this.remoteStrength = data.value;
        }
      } catch (_) {}
    };
    /*******************************************************************/

    // ========== LOGIKA ASLI ALPHARDEX ========== //
    this.base.am.on("ready", () => {
      this.handleWindow();
    });
  }

  handleWindow() {
    let that = this;

    const t = THREE;
    let camera = this.base.camera;
    let scene = this.base.scene;
    let renderer = this.base.renderer;
    let world;
    let cubes = [];
    let sceneOffsetTarget = { x: 0, y: 0 };
    let sceneOffset = { x: 0, y: 0 };

    const colors = ["#054df5", "#f5c105"];

    let today = new Date();
    today.setHours(0, 0, 0, 0);
    today = today.getTime();

    let internalTime = getTime();
    let windowManager;
    let initialized = false;

    function getTime() {
      return (new Date().getTime() - today) / 1000.0;
    }

    if (new URLSearchParams(window.location.search).get("clear")) {
      localStorage.clear();
    } else {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "hidden" && !initialized) init();
      });
      window.onload = () => {
        if (document.visibilityState !== "hidden") init();
      };
    }

    /** ********   INISIALISASI   ******** */
    const init = () => {
      initialized = true;
      setTimeout(() => {
        setupScene();
        setupWindowManager();
        updateWindowShape(false);
        render();
        document.querySelector(".loader-screen")?.classList.add("hollow");
      }, 1500);
    };

    const setupScene = () => {
      world = new t.Group();
      scene.add(world);
    };

    const setupWindowManager = () => {
      windowManager = new WindowManager();
      windowManager.setWinShapeChangeCallback(updateWindowShape);
      windowManager.setWinChangeCallback(windowsUpdated);

      windowManager.init({ foo: "bar" });
      windowsUpdated(); // panggilan awal
    };

    /* ---------- kalau jumlah window berubah ---------- */
    const windowsUpdated = () => {
      updateNumberOfCubes();
    };

    /* ---------- tambahkan / hapus cube sesuai banyak window ---------- */
    const updateNumberOfCubes = () => {
      let wins = windowManager.getWindows();

      cubes.forEach((c) => {
        useDefaultCube ? world.remove(c) : world.remove(c.points);
      });
      cubes = [];

      for (let i = 0; i < wins.length; i++) {
        let win = wins[i];
        let c = new t.Color(i < 2 ? colors[i] : `hsl(${i * 36},100%,50%)`);
        let s = i < 2 ? 220 - i * 80 : 160 + i * 60;

        if (useDefaultCube) {
          const cube = new t.Mesh(
            new t.BoxGeometry(s, s, s),
            new t.MeshBasicMaterial({ color: c, wireframe: true })
          );
          world.add(cube);
          cube.position.set(
            win.shape.x + win.shape.w * 0.5,
            win.shape.y + win.shape.h * 0.5,
            0
          );
          cubes.push(cube);
        } else {
          const cube = new TestObject(that.base, { color: c, scale: s, id: i });
          cube.container = world;
          cube.addExisting();
          cube.points.position.set(
            win.shape.x + win.shape.w * 0.5,
            win.shape.y + win.shape.h * 0.5,
            0
          );
          cubes.push(cube);
        }
      }
    };

    /* ---------- update posisi world saat window dipindah ---------- */
    const updateWindowShape = (easing = true) => {
      sceneOffsetTarget = { x: -window.screenX, y: -window.screenY };
      if (!easing) sceneOffset = sceneOffsetTarget;
    };

    /** ********   RENDER LOOP   ******** */
    const render = () => {
      let tsec = getTime();

      windowManager.update();

      const falloff = 0.05;
      sceneOffset.x += (sceneOffsetTarget.x - sceneOffset.x) * falloff;
      sceneOffset.y += (sceneOffsetTarget.y - sceneOffset.y) * falloff;
      world.position.set(sceneOffset.x, sceneOffset.y, 0);

      let wins = windowManager.getWindows();

      /* ======= Efek entangle antar dua window ======= */
      if (wins.length === 2 && cubes.length === 2) {
        // hitung strength lokal (jarak antar cube)
        const p0 = cubes[0].points.position;
        const p1 = cubes[1].points.position;
        const dist = p0.distanceTo(p1);
        const localStrength = THREE.MathUtils.clamp(1 - dist / 800, 0, 1);

        // kirim ke socket setiap ~100 ms
        if (
          that._lastSendStrength === undefined ||
          performance.now() - that._lastSendStrength > 100
        ) {
          that._lastSendStrength = performance.now();
          if (that.socket.readyState === WebSocket.OPEN) {
            that.socket.send(
              JSON.stringify({ type: "strength", value: localStrength })
            );
          }
        }

        // strength final = max(local, remote) → bikin keduanya sinkron
        const finalStrength = Math.max(localStrength, that.remoteStrength);

        // hidupkan gaya attract di kedua cube
        cubes.forEach((c) => {
          c.attractEnabled = true;
          c.attractMesh.material.color.set(c.color);
          c.attractPos = p1.clone(); // gunakan p1 sbg target
          c.strength = finalStrength; // kalau TestObject mendukung
        });
      } else {
        cubes.forEach((c) => (c.attractEnabled = false));
      }

      /** -------- update setiap cube -------- */
      cubes.forEach((cube, i) => {
        const win = wins[i];
        const posTarget = {
          x: win.shape.x + win.shape.w * 0.5,
          y: win.shape.y + win.shape.h * 0.5,
        };
        if (useDefaultCube) {
          cube.position.x += (posTarget.x - cube.position.x) * falloff;
          cube.position.y += (posTarget.y - cube.position.y) * falloff;
          cube.rotation.x = tsec * 0.5;
          cube.rotation.y = tsec * 0.3;
        } else {
          cube.update_();
          cube.points.position.x +=
            (posTarget.x - cube.points.position.x) * falloff;
          cube.points.position.y +=
            (posTarget.y - cube.points.position.y) * falloff;
        }
      });

      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
  }
}
