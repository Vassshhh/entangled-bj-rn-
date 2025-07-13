import * as kokomi from "kokomi.js";
import * as THREE from "three";

import World from "./World/World";
import Debug from "./Debug";
import resources from "./resources";

export default class Experience extends kokomi.Base {
  constructor(sel = "#sketch") {
    super(sel);

    window.experience = this;

    THREE.ColorManagement.enabled = false;

    this.renderer.setClearColor(0x000000, 1);

    this.debug = new Debug();

    this.am = new kokomi.AssetManager(this, resources);

    // Setup orthographic camera
    const camera = new THREE.OrthographicCamera(
      0,
      window.innerWidth,
      0,
      window.innerHeight,
      -10000,
      10000
    );
    camera.position.z = 2.5;
    this.camera = camera;

    window.addEventListener("resize", () => {
      this.camera.right = window.innerWidth;
      this.camera.bottom = window.innerHeight;
      this.camera.updateProjectionMatrix();
    });

    new kokomi.OrbitControls(this);

    // Inisialisasi World
    this.world = new World(this);

    // =======================
    // 🔌 WEBSOCKET SECTION 🔌
    // =======================
    this.socket = new WebSocket("ws://localhost:8080");

    this.socket.onopen = () => {
      console.log("✅ WebSocket terhubung!");
    };

    this.socket.onmessage = (e) => {
      const data = JSON.parse(e.data);

      // Kirim ke World untuk diproses lebih lanjut
      if (this.world && typeof this.world.onSocketData === "function") {
        this.world.onSocketData(data);
      }
    };

    this.socket.onerror = (e) => {
      console.error("❌ WebSocket error:", e);
    };

    // Kirim data ke server saat mouse digerakkan
    window.addEventListener("mousemove", (e) => {
      const strength = e.clientX / window.innerWidth;

      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "wave",
            strength,
          })
        );
      }
    });
  }
}
