import { CLUSTER, SYSTEMS } from "./cluster-data.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function latticeValues(extent, spacing) {
  const result = [];
  for (let value = -extent; value <= extent + 1e-8; value += spacing) {
    result.push(Number(value.toFixed(6)));
  }
  return result;
}

/**
 * Small purpose-built SVG 3D projector. It deliberately avoids WebGL because
 * the cluster view only needs points and lines, making SVG lighter, sharper,
 * and easier to embed in Foundry/Forge.
 */
export class ClusterView {
  constructor(svg, options = {}) {
    this.svg = svg;
    this.systems = options.systems ?? SYSTEMS;
    this.extent = options.extent ?? CLUSTER.halfExtentLy;
    this.gridSpacing = options.gridSpacing ?? CLUSTER.defaultGridSpacingLy;
    this.onSelectionChange = options.onSelectionChange ?? (() => {});

    this.state = {
      yaw: -0.62,
      pitch: 0.40,
      zoom: 1,
      panX: 0,
      panY: 0,
    };

    this.origin = null;
    this.destination = null;
    this.drag = null;
    this.pinch = null;
    this.activePointers = new Map();
    this.suppressClickUntil = 0;
    this.gridSegments = [];
    this.starNodes = new Map();

    this.#buildScene();
    this.#attachEvents();
    this.render();
  }

  destroy() {
    this.svg.removeEventListener("pointerdown", this._onPointerDown);
    this.svg.removeEventListener("pointermove", this._onPointerMove);
    this.svg.removeEventListener("pointerup", this._onPointerUp);
    this.svg.removeEventListener("pointercancel", this._onPointerUp);
    this.svg.removeEventListener("wheel", this._onWheel);
    this.svg.removeEventListener("dblclick", this._onDoubleClick);
  }

  setGridSpacing(spacing) {
    const value = Number(spacing);
    if (![1, 2].includes(value)) return;
    this.gridSpacing = value;
    this.#rebuildGrid();
    this.render();
  }

  resetView() {
    Object.assign(this.state, { yaw: -0.62, pitch: 0.40, zoom: 1, panX: 0, panY: 0 });
    this.render();
  }

  clearSelection() {
    this.origin = null;
    this.destination = null;
    this.#syncSelectionClasses();
    this.onSelectionChange(null, null);
    this.render();
  }

  #buildScene() {
    this.svg.replaceChildren();
    this.svg.setAttribute("viewBox", "0 0 1000 700");
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const defs = svgElement("defs");
    const glow = svgElement("filter", { id: "oscm-star-glow", x: "-200%", y: "-200%", width: "400%", height: "400%" });
    glow.append(
      svgElement("feGaussianBlur", { stdDeviation: "3", result: "blur" }),
      svgElement("feMerge"),
    );
    const merge = glow.lastElementChild;
    merge.append(svgElement("feMergeNode", { in: "blur" }), svgElement("feMergeNode", { in: "SourceGraphic" }));
    defs.append(glow);
    this.svg.append(defs);

    this.gridLayer = svgElement("g", { class: "oscm-grid-layer" });
    this.axisLayer = svgElement("g", { class: "oscm-axis-layer" });
    this.routeLayer = svgElement("g", { class: "oscm-route-layer" });
    this.starLayer = svgElement("g", { class: "oscm-star-layer" });
    this.svg.append(this.gridLayer, this.axisLayer, this.routeLayer, this.starLayer);

    this.#rebuildGrid();
    this.#buildAxes();
    this.#buildStars();
  }

  #rebuildGrid() {
    this.gridLayer.replaceChildren();
    this.gridSegments = [];

    const values = latticeValues(this.extent, this.gridSpacing);
    const min = -this.extent;
    const max = this.extent;

    const addSegment = (a, b, constants) => {
      const major = constants.every((value) => Math.abs(value % 5) < 1e-8 || Math.abs(value) === this.extent);
      const boundary = constants.some((value) => Math.abs(value) === this.extent);
      const line = svgElement("line", {
        class: `oscm-grid-line${major ? " is-major" : ""}${boundary ? " is-boundary" : ""}`,
      });
      this.gridLayer.append(line);
      this.gridSegments.push({ a, b, el: line });
    };

    // Full cubic lattice: one line family for each axis.
    for (const y of values) {
      for (const z of values) addSegment({ x: min, y, z }, { x: max, y, z }, [y, z]);
    }
    for (const x of values) {
      for (const z of values) addSegment({ x, y: min, z }, { x, y: max, z }, [x, z]);
    }
    for (const x of values) {
      for (const y of values) addSegment({ x, y, z: min }, { x, y, z: max }, [x, y]);
    }
  }

  #buildAxes() {
    const e = this.extent;
    this.axes = [
      { a: { x: -e, y: 0, z: 0 }, b: { x: e, y: 0, z: 0 }, label: "X", className: "x" },
      { a: { x: 0, y: -e, z: 0 }, b: { x: 0, y: e, z: 0 }, label: "Y", className: "y" },
      { a: { x: 0, y: 0, z: -e }, b: { x: 0, y: 0, z: e }, label: "Z", className: "z" },
    ].map((axis) => {
      const line = svgElement("line", { class: `oscm-axis oscm-axis-${axis.className}` });
      const label = svgElement("text", { class: `oscm-axis-label oscm-axis-label-${axis.className}` });
      label.textContent = axis.label;
      this.axisLayer.append(line, label);
      return { ...axis, line, labelEl: label };
    });
  }

  #buildStars() {
    this.starNodes.clear();
    this.starLayer.replaceChildren();

    for (const system of this.systems) {
      const group = svgElement("g", {
        class: "oscm-star",
        "data-system-id": system.id,
        tabindex: "0",
        role: "button",
        "aria-label": system.name,
      });
      const hitTarget = svgElement("circle", { class: "oscm-star-hit-target", r: "24" });
      const stellarNodes = [];
      const stars = system.stars?.length ? system.stars : [{ id: "A", color: "#eaffff", coreColor: "#ffffff", radiusScale: 1 }];
      const selectionRadiusBase = stars.length > 1 ? 17 : 12.5;
      const selectionRing = svgElement("circle", { class: "oscm-star-selection-ring", r: String(selectionRadiusBase) });

      for (const star of stars) {
        const offsetX = Number(star.markerOffsetX ?? 0);
        const radiusScale = Number(star.radiusScale ?? 1);
        const stellarGroup = svgElement("g", {
          class: `oscm-stellar-component${star.anomalous ? " is-anomalous" : ""}`,
          transform: `translate(${offsetX} 0)`,
        });
        const halo = svgElement("circle", {
          class: "oscm-star-halo",
          r: (10 * radiusScale).toFixed(2),
          fill: star.color,
        });
        halo.style.setProperty("--oscm-stellar-color", star.color);
        const core = svgElement("circle", {
          class: "oscm-star-core",
          r: (4.5 * radiusScale).toFixed(2),
          fill: star.color,
          stroke: star.coreColor ?? "rgba(255,255,255,0.85)",
        });
        const innerCore = svgElement("circle", {
          class: "oscm-star-inner-core",
          r: (1.75 * radiusScale).toFixed(2),
          fill: star.coreColor ?? star.color,
        });
        stellarGroup.append(halo, core, innerCore);
        group.append(stellarGroup);
        stellarNodes.push({ group: stellarGroup, halo, core, innerCore, star, radiusScale });
      }

      const labelOffsetX = stars.length > 1 ? 15 : 10;
      const label = svgElement("text", { class: "oscm-star-label", x: String(labelOffsetX), y: "-8" });
      label.textContent = system.name;
      const coords = svgElement("text", { class: "oscm-star-coords", x: String(labelOffsetX), y: "7" });
      coords.textContent = `${system.x.toFixed(1)}, ${system.y.toFixed(1)}, ${system.z.toFixed(1)} ly`;
      const title = svgElement("title");
      title.textContent = `${system.name}: ${stars.map((star) => `${star.id} ${star.spectralType} — ${star.visibleColor}`).join("; ")}`;
      group.prepend(hitTarget, selectionRing);
      group.append(label, coords, title);
      this.starLayer.append(group);
      this.starNodes.set(system.id, { group, hitTarget, selectionRing, selectionRadiusBase, stellarNodes, label, coords, system });

      group.addEventListener("click", (event) => {
        event.stopPropagation();
        if (performance.now() < this.suppressClickUntil) return;
        this.#selectSystem(system);
      });
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.#selectSystem(system);
        }
      });
    }
  }

  #attachEvents() {
    const distanceBetween = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

    const beginSinglePointerDrag = (pointer) => {
      this.drag = {
        id: pointer.id,
        x: pointer.x,
        y: pointer.y,
        yaw: this.state.yaw,
        pitch: this.state.pitch,
        moved: false,
      };
      this.pinch = null;
      this.svg.classList.remove("is-pinching");
    };

    const beginPinch = () => {
      const pointers = [...this.activePointers.values()].slice(0, 2);
      if (pointers.length < 2) return;
      const distance = distanceBetween(pointers[0], pointers[1]);
      if (!(distance > 0)) return;

      this.drag = null;
      this.pinch = {
        ids: [pointers[0].id, pointers[1].id],
        distance,
        zoom: this.state.zoom,
      };
      this.svg.classList.remove("is-dragging");
      this.svg.classList.add("is-pinching");
      for (const pointer of pointers) this.svg.setPointerCapture?.(pointer.id);
      // A multi-touch gesture should never resolve into an accidental star tap.
      this.suppressClickUntil = performance.now() + 350;
    };

    this._onPointerDown = (event) => {
      const pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
        startsOnStar: Boolean(event.target.closest?.(".oscm-star")),
      };
      this.activePointers.set(event.pointerId, pointer);
      if (!pointer.startsOnStar) this.svg.setPointerCapture?.(event.pointerId);

      if (this.activePointers.size === 1) {
        beginSinglePointerDrag(pointer);
      } else if (this.activePointers.size >= 2) {
        beginPinch();
      }
    };

    this._onPointerMove = (event) => {
      const pointer = this.activePointers.get(event.pointerId);
      if (!pointer) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;

      if (this.activePointers.size >= 2 && this.pinch) {
        const a = this.activePointers.get(this.pinch.ids[0]);
        const b = this.activePointers.get(this.pinch.ids[1]);
        if (!a || !b) return;

        const distance = distanceBetween(a, b);
        if (distance > 0) {
          // Fingers apart => zoom in. Fingers together => zoom out.
          this.state.zoom = clamp(this.pinch.zoom * (distance / this.pinch.distance), 0.45, 3.5);
          this.suppressClickUntil = performance.now() + 350;
          this.render();
        }
        return;
      }

      if (!this.drag || event.pointerId !== this.drag.id) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      const movedDistance = Math.hypot(dx, dy);
      if (movedDistance > 5) {
        this.drag.moved = true;
        this.suppressClickUntil = performance.now() + 250;
        this.svg.setPointerCapture?.(event.pointerId);
        this.svg.classList.add("is-dragging");
      }

      this.state.yaw = this.drag.yaw + dx * 0.008;
      this.state.pitch = clamp(this.drag.pitch + dy * 0.008, -1.45, 1.45);
      this.render();
    };

    this._onPointerUp = (event) => {
      const hadPointer = this.activePointers.delete(event.pointerId);
      if (!hadPointer) return;

      this.svg.releasePointerCapture?.(event.pointerId);

      if (this.activePointers.size >= 2) {
        beginPinch();
        return;
      }

      if (this.activePointers.size === 1) {
        // Continue naturally as a one-finger rotation after one finger leaves a pinch.
        const remaining = [...this.activePointers.values()][0];
        beginSinglePointerDrag(remaining);
        return;
      }

      this.drag = null;
      this.pinch = null;
      this.svg.classList.remove("is-dragging", "is-pinching");
    };

    this._onWheel = (event) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0012);
      this.state.zoom = clamp(this.state.zoom * factor, 0.45, 3.5);
      this.render();
    };

    this._onDoubleClick = (event) => {
      if (!event.target.closest?.(".oscm-star")) this.resetView();
    };

    this.svg.addEventListener("pointerdown", this._onPointerDown);
    this.svg.addEventListener("pointermove", this._onPointerMove);
    this.svg.addEventListener("pointerup", this._onPointerUp);
    this.svg.addEventListener("pointercancel", this._onPointerUp);
    this.svg.addEventListener("wheel", this._onWheel, { passive: false });
    this.svg.addEventListener("dblclick", this._onDoubleClick);
  }

  #selectSystem(system) {
    if (!this.origin || (this.origin && this.destination)) {
      this.origin = system;
      this.destination = null;
    } else if (this.origin.id === system.id) {
      this.origin = null;
      this.destination = null;
    } else {
      this.destination = system;
    }

    this.#syncSelectionClasses();
    this.onSelectionChange(this.origin, this.destination);
    this.render();
  }

  #syncSelectionClasses() {
    for (const { group, system } of this.starNodes.values()) {
      group.classList.toggle("is-origin", this.origin?.id === system.id);
      group.classList.toggle("is-destination", this.destination?.id === system.id);
    }
  }

  #project(point) {
    const { yaw, pitch, zoom, panX, panY } = this.state;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    // Y is the visual vertical axis. Yaw reveals Z; pitch tips the cube.
    const x1 = point.x * cosY + point.z * sinY;
    const z1 = -point.x * sinY + point.z * cosY;
    const y1 = point.y;
    const y2 = y1 * cosP - z1 * sinP;
    const z2 = y1 * sinP + z1 * cosP;

    const focal = 34;
    const perspective = focal / (focal - z2);
    const scale = 36 * zoom;

    return {
      x: 500 + panX + x1 * scale * perspective,
      y: 350 + panY - y2 * scale * perspective,
      z: z2,
      perspective,
    };
  }

  render() {
    for (const segment of this.gridSegments) {
      const a = this.#project(segment.a);
      const b = this.#project(segment.b);
      segment.el.setAttribute("x1", a.x.toFixed(2));
      segment.el.setAttribute("y1", a.y.toFixed(2));
      segment.el.setAttribute("x2", b.x.toFixed(2));
      segment.el.setAttribute("y2", b.y.toFixed(2));
      const depth = (a.z + b.z) / 2;
      segment.el.style.opacity = String(clamp(0.055 + ((depth + this.extent) / (2 * this.extent)) * 0.10, 0.04, 0.18));
    }

    for (const axis of this.axes) {
      const a = this.#project(axis.a);
      const b = this.#project(axis.b);
      axis.line.setAttribute("x1", a.x.toFixed(2));
      axis.line.setAttribute("y1", a.y.toFixed(2));
      axis.line.setAttribute("x2", b.x.toFixed(2));
      axis.line.setAttribute("y2", b.y.toFixed(2));
      axis.labelEl.setAttribute("x", (b.x + 6).toFixed(2));
      axis.labelEl.setAttribute("y", (b.y - 6).toFixed(2));
    }

    const projectedStars = [];
    for (const node of this.starNodes.values()) {
      const p = this.#project(node.system);
      projectedStars.push({ node, p });
      node.group.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
      node.group.style.opacity = String(clamp(0.68 + p.perspective * 0.26, 0.65, 1));
      const perspectiveScale = clamp(p.perspective, 0.75, 1.3);
      node.selectionRing.setAttribute("r", (node.selectionRadiusBase * perspectiveScale).toFixed(2));
      for (const stellarNode of node.stellarNodes) {
        const scaled = stellarNode.radiusScale * perspectiveScale;
        stellarNode.core.setAttribute("r", (4.5 * scaled).toFixed(2));
        stellarNode.innerCore.setAttribute("r", (1.75 * scaled).toFixed(2));
        stellarNode.halo.setAttribute("r", (10 * scaled).toFixed(2));
      }
    }

    // Keep nearer labels/points visually on top.
    projectedStars.sort((a, b) => a.p.z - b.p.z);
    for (const { node } of projectedStars) this.starLayer.append(node.group);

    this.routeLayer.replaceChildren();
    if (this.origin && this.destination) {
      const a = this.#project(this.origin);
      const b = this.#project(this.destination);
      const shadow = svgElement("line", {
        class: "oscm-route-line oscm-route-line-shadow",
        x1: a.x.toFixed(2), y1: a.y.toFixed(2), x2: b.x.toFixed(2), y2: b.y.toFixed(2),
      });
      const line = svgElement("line", {
        class: "oscm-route-line",
        x1: a.x.toFixed(2), y1: a.y.toFixed(2), x2: b.x.toFixed(2), y2: b.y.toFixed(2),
      });
      this.routeLayer.append(shadow, line);
    }
  }
}
