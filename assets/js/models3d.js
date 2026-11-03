/* KVK — interactive 3D structural models (Three.js r128, self-hosted).
   Models are schematic, procedurally generated representations. */
(function () {
  'use strict';
  if (!window.THREE) return;
  var V3 = THREE.Vector3;

  /* ---------- materials ---------- */
  function mat(c, o) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.5, roughness: 0.5 }, o || {}));
  }
  var M = {
    steel: mat(0x9db6cf),
    dark: mat(0x3d5f86),
    orange: mat(0xf28b2c, { metalness: 0.35, roughness: 0.55 }),
    pipe: mat(0xcfd9e4, { metalness: 0.6, roughness: 0.35 }),
    pipeOr: mat(0xf28b2c, { metalness: 0.4, roughness: 0.4 }),
    concrete: mat(0x7d8da0, { metalness: 0.05, roughness: 0.9 }),
    deck: mat(0x56677d, { metalness: 0.05, roughness: 0.85 }),
    glass: mat(0x5db4ee, { transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, metalness: 0, roughness: 0.2 }),
    belt: mat(0x17222f, { metalness: 0.1, roughness: 0.8 }),
    field: mat(0x2f6b4f, { metalness: 0, roughness: 1 })
  };

  /* ---------- helpers ---------- */
  function P(a) { return new V3(a[0], a[1], a[2]); }

  // square/rect section member between two points (w = width, h = height of section)
  function member(g, a, b, w, m, h) {
    a = P(a); b = P(b);
    var len = a.distanceTo(b);
    if (len < 1e-4) return null;
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h || w, len), m || M.steel);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.lookAt(b);
    g.add(mesh);
    return mesh;
  }
  // round tube between two points
  function tube(g, a, b, r, m, seg) {
    a = P(a); b = P(b);
    var dir = b.clone().sub(a), len = dir.length();
    if (len < 1e-4) return null;
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 14), m || M.pipe);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir.normalize());
    g.add(mesh);
    return mesh;
  }
  // flat slab (box) with given centre and size
  function slab(g, cx, cy, cz, sx, sy, sz, m) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m || M.deck);
    mesh.position.set(cx, cy, cz);
    g.add(mesh);
    return mesh;
  }
  // annular sector in plan, extruded upward from y
  function arcBand(g, r1, r2, t0, t1, y, thick, m, steps) {
    var s = new THREE.Shape(), n = steps || 40, i, t;
    for (i = 0; i <= n; i++) {
      t = t0 + (t1 - t0) * i / n;
      var x = r2 * Math.cos(t), z = r2 * Math.sin(t);
      if (i === 0) s.moveTo(x, -z); else s.lineTo(x, -z);
    }
    for (i = n; i >= 0; i--) {
      t = t0 + (t1 - t0) * i / n;
      s.lineTo(r1 * Math.cos(t), -r1 * Math.sin(t));
    }
    s.closePath();
    var geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    var mesh = new THREE.Mesh(geo, m);
    mesh.position.y = y;
    g.add(mesh);
    return mesh;
  }
  function arcPt(r, t, y) { return [r * Math.cos(t), y, r * Math.sin(t)]; }

  // X-bracing in a rectangle defined by 4 corners (a,b along bottom, c,d top)
  function xbrace(g, p1, p2, p3, p4, w, m) {
    member(g, p1, p3, w, m);
    member(g, p2, p4, w, m);
  }

  /* =====================================================
     MODEL 1 — Curved steel composite girder bridge
     ===================================================== */
  function bridge(g) {
    var R = 18, span = Math.PI * 0.6, N = 30, H = 1.2, t0 = -span / 2, t1 = span / 2;
    var offs = [-3.9, -1.3, 1.3, 3.9], i, j, o;
    offs.forEach(function (o) {
      for (i = 0; i < N; i++) {
        var a = t0 + span * i / N, b = t0 + span * (i + 1) / N;
        member(g, arcPt(R + o, a, H), arcPt(R + o, b, H), 0.75, M.orange, 0.14);       // top flange
        member(g, arcPt(R + o, a, 0), arcPt(R + o, b, 0), 0.9, M.orange, 0.16);         // bottom flange
        member(g, arcPt(R + o, a, H / 2), arcPt(R + o, b, H / 2), 0.07, M.steel, H);     // web
      }
    });
    // cross frames
    for (i = 0; i <= N; i += 3) {
      var t = t0 + span * i / N;
      for (j = 0; j < offs.length - 1; j++) {
        var A = R + offs[j], B = R + offs[j + 1];
        member(g, arcPt(A, t, H), arcPt(B, t, H), 0.1, M.dark);
        member(g, arcPt(A, t, 0), arcPt(B, t, 0), 0.1, M.dark);
        member(g, arcPt(A, t, 0), arcPt(B, t, H), 0.08, M.dark);
        member(g, arcPt(A, t, H), arcPt(B, t, 0), 0.08, M.dark);
      }
    }
    // concrete deck
    arcBand(g, R - 5.4, R + 5.4, t0 - 0.01, t1 + 0.01, H, 0.3, M.deck, 60);
    // parapets
    [-5.2, 5.2].forEach(function (o) {
      for (i = 0; i < 30; i++) {
        var a = t0 + span * i / 30, b = t0 + span * (i + 1) / 30;
        member(g, arcPt(R + o, a, H + 0.7), arcPt(R + o, b, H + 0.7), 0.18, M.concrete, 0.8);
      }
    });
    // piers
    [t0 + 0.03, t0 + span * 0.5, t1 - 0.03].forEach(function (t, k) {
      var depth = 8;
      member(g, arcPt(R - 5, t, -0.7), arcPt(R + 5, t, -0.7), 1.3, M.concrete, 1.0);
      [-2.6, 2.6].forEach(function (o) {
        var p = arcPt(R + o, t, 0);
        var col = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, depth, 20), M.concrete);
        col.position.set(p[0], -depth / 2 - 0.2, p[2]);
        g.add(col);
        var foot = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 3), M.concrete);
        foot.position.set(p[0], -depth - 0.2, p[2]);
        g.add(foot);
      });
    });
  }

  /* =====================================================
     MODEL 2 — Industrial process building (multi-level frame)
     ===================================================== */
  function process(g) {
    var nx = 4, nz = 3, bx = 4.4, bz = 5, lv = [0, 4.2, 8.4, 12.6, 16], ox = -nx * bx / 2, oz = -nz * bz / 2;
    var i, j, k;
    for (k = 0; k < lv.length - 1; k++) {
      for (i = 0; i <= nx; i++) for (j = 0; j <= nz; j++)
        member(g, [ox + i * bx, lv[k], oz + j * bz], [ox + i * bx, lv[k + 1], oz + j * bz], 0.38, M.steel);
    }
    for (k = 1; k < lv.length; k++) {
      for (j = 0; j <= nz; j++) for (i = 0; i < nx; i++)
        member(g, [ox + i * bx, lv[k], oz + j * bz], [ox + (i + 1) * bx, lv[k], oz + j * bz], 0.26, M.orange, 0.34);
      for (i = 0; i <= nx; i++) for (j = 0; j < nz; j++)
        member(g, [ox + i * bx, lv[k], oz + j * bz], [ox + i * bx, lv[k], oz + (j + 1) * bz], 0.26, M.orange, 0.34);
      // intermediate secondary beams
      for (j = 0; j < nz; j++)
        member(g, [ox, lv[k], oz + (j + 0.5) * bz], [ox + nx * bx, lv[k], oz + (j + 0.5) * bz], 0.14, M.dark, 0.2);
    }
    // vertical bracing on the two long faces and ends
    for (k = 0; k < lv.length - 1; k++) {
      [0, nz].forEach(function (jj) {
        [0, nx - 1].forEach(function (ii) {
          xbrace(g,
            [ox + ii * bx, lv[k], oz + jj * bz], [ox + (ii + 1) * bx, lv[k], oz + jj * bz],
            [ox + (ii + 1) * bx, lv[k + 1], oz + jj * bz], [ox + ii * bx, lv[k + 1], oz + jj * bz], 0.1, M.dark);
        });
      });
      [0, nx].forEach(function (ii) {
        xbrace(g,
          [ox + ii * bx, lv[k], oz], [ox + ii * bx, lv[k], oz + bz],
          [ox + ii * bx, lv[k + 1], oz + bz], [ox + ii * bx, lv[k + 1], oz], 0.1, M.dark);
      });
    }
    // floor plates
    [1, 2, 3].forEach(function (k2) {
      slab(g, 0, lv[k2] + 0.2, -bz * 0.5 * 0, nx * bx - 0.2, 0.1, nz * bz - 0.2, M.glass);
    });
    // equipment: hopper + cone on the roof, cylindrical bin through the middle
    var bin = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 6, 28), M.pipe);
    bin.position.set(-2, 11.4, 0); g.add(bin);
    var cone = new THREE.Mesh(new THREE.ConeGeometry(2.3, 3, 28), M.orange);
    cone.rotation.x = Math.PI; cone.position.set(-2, 7.0, 0); g.add(cone);
    var cap = new THREE.Mesh(new THREE.SphereGeometry(2.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.pipe);
    cap.position.set(-2, 14.4, 0); g.add(cap);
    // roof equipment frame + stack
    tube(g, [5, 16, -3], [5, 24, -3], 0.55, M.pipe, 20);
    // stair tower
    var sx = ox + nx * bx + 2.4;
    for (k = 0; k < lv.length - 1; k++) {
      [[0, 0], [2.4, 0], [0, 3], [2.4, 3]].forEach(function (c) {
        member(g, [sx - 1.2 + c[0], lv[k], oz + c[1]], [sx - 1.2 + c[0], lv[k + 1], oz + c[1]], 0.18, M.dark);
      });
      member(g, [sx - 1.2, lv[k], oz], [sx + 1.2, lv[k + 1], oz], 0.14, M.orange);
      member(g, [sx - 1.2, lv[k], oz + 3], [sx + 1.2, lv[k + 1], oz + 3], 0.14, M.orange);
      member(g, [sx - 1.2, lv[k], oz], [sx - 1.2, lv[k], oz + 3], 0.14, M.dark);
    }
  }

  /* =====================================================
     MODEL 3 — Refinery pipe rack, tower and vessel
     ===================================================== */
  function refinery(g) {
    var bents = 7, sp = 5, W = 6.4, tiers = [0, 4.2, 8.2], i, k;
    var x0 = -bents * sp / 2 + sp / 2;
    for (i = 0; i < bents; i++) {
      var x = x0 + i * sp;
      [-W / 2, W / 2].forEach(function (z) {
        member(g, [x, 0, z], [x, tiers[2] + 0.4, z], 0.4, M.steel);
        member(g, [x, 0, z], [x + 0.0, 0, z], 0.4, M.steel);
      });
      tiers.slice(1).forEach(function (y) {
        member(g, [x, y, -W / 2], [x, y, W / 2], 0.3, M.orange, 0.4);
      });
      // knee braces
      [1, 2].forEach(function (t) {
        member(g, [x, tiers[t] - 1.3, -W / 2], [x, tiers[t], -W / 2 + 1.3], 0.12, M.dark);
        member(g, [x, tiers[t] - 1.3, W / 2], [x, tiers[t], W / 2 - 1.3], 0.12, M.dark);
      });
    }
    // longitudinal beams + bracing in the first and last bays
    tiers.slice(1).forEach(function (y) {
      [-W / 2, 0, W / 2].forEach(function (z) {
        member(g, [x0, y, z], [x0 + (bents - 1) * sp, y, z], 0.2, M.dark, 0.28);
      });
    });
    [0, bents - 2].forEach(function (b) {
      [-W / 2, W / 2].forEach(function (z) {
        xbrace(g, [x0 + b * sp, 0, z], [x0 + (b + 1) * sp, 0, z], [x0 + (b + 1) * sp, tiers[1], z], [x0 + b * sp, tiers[1], z], 0.11, M.dark);
      });
    });
    // pipes
    var len = (bents - 1) * sp + 3;
    [[tiers[1], [-2.4, -1.2, 0, 1.4, 2.6], [0.32, 0.22, 0.45, 0.2, 0.28]],
     [tiers[2], [-2.5, -0.9, 0.9, 2.5], [0.26, 0.4, 0.3, 0.2]]].forEach(function (row) {
      row[1].forEach(function (z, n) {
        var r = row[2][n], y = row[0] + 0.2 + r;
        tube(g, [x0 - 1.5, y, z], [x0 + len - 1.5, y, z], r, n % 2 ? M.pipeOr : M.pipe, 16);
      });
    });
    // distillation tower
    var tx = x0 - 8, h = 22;
    var tw = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, h, 32), M.pipe);
    tw.position.set(tx, h / 2 + 1, 0); g.add(tw);
    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 1.2, 32), M.dark);
    skirt.position.set(tx, 0.6, 0); g.add(skirt);
    var dome = new THREE.Mesh(new THREE.SphereGeometry(1.7, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.pipe);
    dome.position.set(tx, h + 1, 0); g.add(dome);
    for (k = 0; k < 5; k++) {
      var py = 5 + k * 3.8;
      var pl = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.07, 6, 36), M.orange);
      pl.rotation.x = Math.PI / 2; pl.position.set(tx, py, 0); g.add(pl);
      var floor = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.25, 32), M.glass);
      floor.rotation.x = -Math.PI / 2; floor.position.set(tx, py, 0); g.add(floor);
    }
    member(g, [tx + 1.8, 1, 0], [tx + 1.8, h, 0], 0.08, M.dark);
    // tower → rack connection
    tube(g, [tx + 1.7, 12, 1], [x0 - 1.5, 12, 1], 0.3, M.pipeOr, 14);
    tube(g, [x0 - 1.5, 12, 1], [x0 - 1.5, tiers[2] + 0.7, 1], 0.3, M.pipeOr, 14);
    // horizontal vessel
    var vx = x0 + (bents - 1) * sp + 9, vz = -1;
    var vc = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 10, 28), M.pipe);
    vc.rotation.z = Math.PI / 2; vc.position.set(vx, 3.6, vz); g.add(vc);
    [-5, 5].forEach(function (d) {
      var e = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.pipe);
      e.rotation.z = d > 0 ? -Math.PI / 2 : Math.PI / 2; e.position.set(vx + d, 3.6, vz); g.add(e);
    });
    [-3, 3].forEach(function (d) {
      member(g, [vx + d, 0, vz - 1.4], [vx + d, 2.6, vz - 1.4], 0.35, M.orange);
      member(g, [vx + d, 0, vz + 1.4], [vx + d, 2.6, vz + 1.4], 0.35, M.orange);
      member(g, [vx + d, 1.6, vz - 1.4], [vx + d, 1.6, vz + 1.4], 0.3, M.dark);
    });
    tube(g, [x0 + (bents - 1) * sp + 1.5, tiers[1] + 0.5, 0], [vx - 5.5, tiers[1] + 0.5, 0], 0.4, M.pipeOr, 14);
    tube(g, [vx - 5.5, tiers[1] + 0.5, 0], [vx - 5.5, 3.6, vz], 0.25, M.pipe, 12);
  }

  /* =====================================================
     MODEL 4 — Horizontally curved conveyor gallery
     ===================================================== */
  function gallery(g) {
    var R = 24, span = Math.PI * 0.55, N = 24, W = 3.6, Hh = 3.2, E = 8, t0 = -span / 2, i;
    var rin = R - W / 2, rout = R + W / 2;
    for (i = 0; i <= N; i++) {
      var t = t0 + span * i / N;
      var a = arcPt(rin, t, E), b = arcPt(rout, t, E), c = arcPt(rout, t, E + Hh), d = arcPt(rin, t, E + Hh);
      member(g, a, b, 0.16, M.dark); member(g, b, c, 0.16, M.dark);
      member(g, c, d, 0.16, M.dark); member(g, d, a, 0.16, M.dark);
      if (i < N) {
        var t2 = t0 + span * (i + 1) / N, rr;
        [rin, rout].forEach(function (r, s) {
          var a1 = arcPt(r, t, E), a2 = arcPt(r, t2, E), c1 = arcPt(r, t, E + Hh), c2 = arcPt(r, t2, E + Hh);
          member(g, a1, a2, 0.2, M.orange, 0.22);
          member(g, c1, c2, 0.2, M.orange, 0.22);
          // diagonals alternating
          if (i % 2 === 0) member(g, a1, c2, 0.1, M.steel); else member(g, c1, a2, 0.1, M.steel);
        });
        // belt line & floor
        member(g, arcPt(R, t, E + 0.5), arcPt(R, t2, E + 0.5), 1.6, M.belt, 0.1);
        // carrying idler posts / top roof sheet
      }
    }
    arcBand(g, rin, rout, t0, t0 + span, E + Hh, 0.06, M.glass, 40);
    arcBand(g, rin, rout, t0, t0 + span, E - 0.12, 0.1, M.deck, 40);
    // support towers
    for (i = 0; i <= N; i += 4) {
      var tt = t0 + span * i / N;
      var tb = i === 0 || i === N ? 1.0 : 1.8;
      [rin, rout].forEach(function (r) {
        var sgn = r === rin ? -1 : 1;
        var top = arcPt(r, tt, E), bot = arcPt(r + sgn * tb, tt, 0);
        member(g, top, bot, 0.4, M.steel);
        // tower braces
        var mid = arcPt(r + sgn * tb * 0.5, tt, E * 0.5);
        member(g, arcPt(r + sgn * tb * 0.25, tt, E * 0.25), mid, 0.1, M.dark);
      });
      member(g, arcPt(rin - tb * 0.5, tt, E * 0.5), arcPt(rout + tb * 0.5, tt, E * 0.5), 0.24, M.dark);
      member(g, arcPt(rin - tb, tt, 0), arcPt(rout + tb, tt, 0), 0.5, M.concrete, 0.4);
      xbrace(g, arcPt(rin - tb * 0.5, tt, E * 0.5), arcPt(rout + tb * 0.5, tt, E * 0.5),
        arcPt(rout, tt, E), arcPt(rin, tt, E), 0.09, M.dark);
      xbrace(g, arcPt(rin - tb, tt, 0), arcPt(rout + tb, tt, 0),
        arcPt(rout + tb * 0.5, tt, E * 0.5), arcPt(rin - tb * 0.5, tt, E * 0.5), 0.09, M.dark);
    }
  }

  /* =====================================================
     MODEL 5 — Large-span arena with radial roof trusses
     ===================================================== */
  function arena(g) {
    var Rr = 16, nC = 24, hC = 7, rise = 5, r0 = 3.2, D = 1.3, i, k;
    function roofY(r) { return hC + rise * (1 - Math.pow(r / Rr, 2)) * 1 + 0.6; }
    // columns + ring beam
    for (i = 0; i < nC; i++) {
      var a = 2 * Math.PI * i / nC, a2 = 2 * Math.PI * (i + 1) / nC;
      member(g, arcPt(Rr, a, 0), arcPt(Rr - 0.3, a, hC), 0.55, M.steel);
      member(g, arcPt(Rr - 0.3, a, hC), arcPt(Rr - 0.3, a2, hC), 0.4, M.orange, 0.5);
      member(g, arcPt(Rr + 0.0, a, 1.5), arcPt(Rr - 0.15, a, 1.5), 0.2, M.dark);
      // façade X bracing every second bay
      if (i % 3 === 0) xbrace(g, arcPt(Rr, a, 0), arcPt(Rr, a2, 0), arcPt(Rr - 0.3, a2, hC), arcPt(Rr - 0.3, a, hC), 0.1, M.dark);
    }
    // radial trusses
    var rads = []; for (k = 0; k <= 8; k++) rads.push(r0 + (Rr - 0.3 - r0) * k / 8);
    for (i = 0; i < nC; i++) {
      var ang = 2 * Math.PI * i / nC;
      for (k = 0; k < 8; k++) {
        var ra = rads[k], rb = rads[k + 1];
        var ta = arcPt(ra, ang, roofY(ra)), tb = arcPt(rb, ang, roofY(rb));
        var ba = arcPt(ra, ang, roofY(ra) - D * (0.5 + 0.5 * ra / Rr)), bb = arcPt(rb, ang, roofY(rb) - D * (0.5 + 0.5 * rb / Rr));
        member(g, ta, tb, 0.2, M.orange, 0.22);
        member(g, ba, bb, 0.16, M.steel, 0.18);
        member(g, ta, ba, 0.09, M.dark);
        member(g, k % 2 ? ta : ba, k % 2 ? bb : tb, 0.09, M.dark);
      }
    }
    // purlin rings
    for (k = 0; k <= 8; k += 2) {
      var rr = rads[k];
      for (i = 0; i < nC; i++) {
        var q1 = 2 * Math.PI * i / nC, q2 = 2 * Math.PI * (i + 1) / nC;
        member(g, arcPt(rr, q1, roofY(rr)), arcPt(rr, q2, roofY(rr)), 0.16, M.dark, 0.16);
      }
    }
    // central compression ring
    var ring = new THREE.Mesh(new THREE.TorusGeometry(r0, 0.22, 10, 40), M.orange);
    ring.rotation.x = Math.PI / 2; ring.position.y = roofY(r0); g.add(ring);
    // roof cladding (lathe)
    var pts = [];
    for (k = 0; k <= 16; k++) { var r = r0 + (Rr - 0.3 - r0) * k / 16; pts.push(new THREE.Vector2(r, roofY(r) + 0.13)); }
    var roof = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), M.glass);
    g.add(roof);
    // seating bowl (stepped rings)
    var rings = [[6.5, 8.2, 1.0], [8.2, 9.9, 2.0], [9.9, 11.6, 3.0], [11.6, 13.3, 4.0], [13.3, 14.7, 5.0]];
    rings.forEach(function (rg) {
      var s = new THREE.Shape(); s.absarc(0, 0, rg[1], 0, Math.PI * 2, false);
      var hole = new THREE.Path(); hole.absarc(0, 0, rg[0], 0, Math.PI * 2, true); s.holes.push(hole);
      var geo = new THREE.ExtrudeGeometry(s, { depth: rg[2], bevelEnabled: false, curveSegments: 48 });
      geo.rotateX(-Math.PI / 2);
      g.add(new THREE.Mesh(geo, M.concrete));
    });
    var field = new THREE.Mesh(new THREE.CircleGeometry(6.5, 48), M.field);
    field.rotation.x = -Math.PI / 2; field.position.y = 0.05; g.add(field);
  }

  /* =====================================================
     MODEL 6 — Industrial shed with crane, silo and stack
     ===================================================== */
  function industrial(g) {
    var n = 8, sp = 6, span = 20, eave = 9, ridge = 11.6, i, k;
    var z0 = -(n - 1) * sp / 2;
    var gantry = 6.2;
    for (i = 0; i < n; i++) {
      var z = z0 + i * sp;
      member(g, [-span / 2, 0, z], [-span / 2, eave, z], 0.5, M.steel);
      member(g, [span / 2, 0, z], [span / 2, eave, z], 0.5, M.steel);
      member(g, [-span / 2, eave, z], [0, ridge, z], 0.4, M.orange, 0.55);
      member(g, [span / 2, eave, z], [0, ridge, z], 0.4, M.orange, 0.55);
      // haunches + rafter ties
      member(g, [-span / 2, eave - 2, z], [-span / 2 + 2, eave + 0.2, z], 0.2, M.dark);
      member(g, [span / 2, eave - 2, z], [span / 2 - 2, eave + 0.2, z], 0.2, M.dark);
      // crane brackets
      member(g, [-span / 2, gantry - 0.5, z], [-span / 2 + 0.9, gantry - 0.5, z], 0.28, M.dark);
      member(g, [span / 2, gantry - 0.5, z], [span / 2 - 0.9, gantry - 0.5, z], 0.28, M.dark);
    }
    // purlins & side rails
    for (k = 0; k <= 6; k++) {
      var f = k / 6;
      [[-span / 2 + f * span / 2, eave + f * (ridge - eave)], [span / 2 - f * span / 2, eave + f * (ridge - eave)]].forEach(function (p) {
        member(g, [p[0], p[1] + 0.3, z0], [p[0], p[1] + 0.3, z0 + (n - 1) * sp], 0.14, M.dark, 0.18);
      });
    }
    [2.5, 5, 7.5].forEach(function (y) {
      member(g, [-span / 2, y, z0], [-span / 2, y, z0 + (n - 1) * sp], 0.12, M.dark);
      member(g, [span / 2, y, z0], [span / 2, y, z0 + (n - 1) * sp], 0.12, M.dark);
    });
    // wall + roof bracing in end bays
    [0, n - 2].forEach(function (b) {
      var za = z0 + b * sp, zb = z0 + (b + 1) * sp;
      [-span / 2, span / 2].forEach(function (x) { xbrace(g, [x, 0, za], [x, 0, zb], [x, eave, zb], [x, eave, za], 0.1, M.dark); });
      xbrace(g, [-span / 2, eave, za], [-span / 2, eave, zb], [0, ridge, zb], [0, ridge, za], 0.09, M.dark);
      xbrace(g, [span / 2, eave, za], [span / 2, eave, zb], [0, ridge, zb], [0, ridge, za], 0.09, M.dark);
    });
    // cladding (partial for visibility)
    var wall = new THREE.Mesh(new THREE.PlaneGeometry((n - 1) * sp, 4.5), M.glass);
    wall.rotation.y = Math.PI / 2; wall.position.set(-span / 2 - 0.05, 2.25, 0); g.add(wall);
    [-1, 1].forEach(function (s) {
      var len = Math.sqrt(span * span / 4 + (ridge - eave) * (ridge - eave));
      var rp = new THREE.Mesh(new THREE.PlaneGeometry(len, (n - 1) * sp), M.glass);
      rp.rotation.x = -Math.PI / 2;
      var ang = Math.atan2(ridge - eave, span / 2);
      var holder = new THREE.Group();
      holder.add(rp);
      holder.rotation.z = -s * ang;
      holder.position.set(s * span / 4, (eave + ridge) / 2 + 0.55, 0);
      g.add(holder);
    });
    // crane runway beams + bridge crane
    [-span / 2 + 0.9, span / 2 - 0.9].forEach(function (x) {
      member(g, [x, gantry, z0 - 1], [x, gantry, z0 + (n - 1) * sp + 1], 0.5, M.orange, 0.7);
    });
    var cz = z0 + 2.5 * sp;
    member(g, [-span / 2 + 0.9, gantry + 0.9, cz], [span / 2 - 0.9, gantry + 0.9, cz], 0.5, M.orange, 0.9);
    member(g, [-span / 2 + 0.9, gantry + 0.9, cz + 1.6], [span / 2 - 0.9, gantry + 0.9, cz + 1.6], 0.5, M.orange, 0.9);
    member(g, [-span / 2 + 0.9, gantry + 0.9, cz], [-span / 2 + 0.9, gantry + 0.9, cz + 1.6], 0.5, M.dark);
    member(g, [span / 2 - 0.9, gantry + 0.9, cz], [span / 2 - 0.9, gantry + 0.9, cz + 1.6], 0.5, M.dark);
    slab(g, 3, gantry + 1.7, cz + 0.8, 1.8, 0.6, 1.5, M.dark);
    tube(g, [3, gantry + 1.4, cz + 0.8], [3, gantry - 3.2, cz + 0.8], 0.04, M.dark, 6);
    slab(g, 3, gantry - 3.5, cz + 0.8, 0.5, 0.5, 0.5, M.orange);
    // silo + stack
    var sx = span / 2 + 6, sz = z0 + 6;
    var silo = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 12, 32), M.pipe);
    silo.position.set(sx, 8, sz); g.add(silo);
    var sc = new THREE.Mesh(new THREE.ConeGeometry(2.8, 3.2, 32), M.orange);
    sc.rotation.x = Math.PI; sc.position.set(sx, 0.4, sz); g.add(sc);
    [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(function (c) {
      member(g, [sx + c[0], 0, sz + c[1]], [sx + c[0] * 1.15, 9.6, sz + c[1] * 1.15], 0.3, M.steel);
    });
    [3, 6.5, 9.5].forEach(function (y) {
      member(g, [sx - 2.2, y, sz - 2.2], [sx + 2.2, y, sz - 2.2], 0.14, M.dark);
      member(g, [sx - 2.2, y, sz + 2.2], [sx + 2.2, y, sz + 2.2], 0.14, M.dark);
      member(g, [sx - 2.2, y, sz - 2.2], [sx - 2.2, y, sz + 2.2], 0.14, M.dark);
      member(g, [sx + 2.2, y, sz - 2.2], [sx + 2.2, y, sz + 2.2], 0.14, M.dark);
    });
    var stack = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.3, 26, 24), M.concrete);
    stack.position.set(sx + 1, 13, sz - 11); g.add(stack);
    [20, 23.5].forEach(function (y, q) {
      var band = new THREE.Mesh(new THREE.CylinderGeometry(0.86 - q * 0.06, 0.9 - q * 0.06, 1.6, 24), M.orange);
      band.position.set(sx + 1, y, sz - 11); g.add(band);
    });
  }

  /* =====================================================
     HERO — steel-frame building under construction + tower crane
     ===================================================== */
  function hero(g) {
    var nx = 5, nz = 3, bx = 5, bz = 5, lv = [0, 4, 8, 12, 16, 20], ox = -nx * bx / 2, oz = -nz * bz / 2, i, j, k;
    for (k = 0; k < lv.length - 1; k++) for (i = 0; i <= nx; i++) for (j = 0; j <= nz; j++)
      member(g, [ox + i * bx, lv[k], oz + j * bz], [ox + i * bx, lv[k + 1], oz + j * bz], 0.42, M.steel);
    for (k = 1; k < lv.length; k++) {
      for (j = 0; j <= nz; j++) for (i = 0; i < nx; i++)
        member(g, [ox + i * bx, lv[k], oz + j * bz], [ox + (i + 1) * bx, lv[k], oz + j * bz], 0.28, M.orange, 0.38);
      for (i = 0; i <= nx; i++) for (j = 0; j < nz; j++)
        member(g, [ox + i * bx, lv[k], oz + j * bz], [ox + i * bx, lv[k], oz + (j + 1) * bz], 0.28, M.orange, 0.38);
      if (k < 5) slab(g, 0, lv[k] + 0.22, 0, nx * bx - 0.3, 0.12, nz * bz - 0.3, M.glass);
    }
    for (k = 0; k < lv.length - 1; k++) [0, nz].forEach(function (jj) { [1, 3].forEach(function (ii) {
      xbrace(g, [ox + ii * bx, lv[k], oz + jj * bz], [ox + (ii + 1) * bx, lv[k], oz + jj * bz],
        [ox + (ii + 1) * bx, lv[k + 1], oz + jj * bz], [ox + ii * bx, lv[k + 1], oz + jj * bz], 0.1, M.dark); }); });
    // tower crane
    var cx = ox + nx * bx + 6, cz = oz - 1, mh = 34, w = 1.2, jib = 26, cjib = 9;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      member(g, [cx + c[0] * w / 2, 0, cz + c[1] * w / 2], [cx + c[0] * w / 2, mh, cz + c[1] * w / 2], 0.18, M.orange);
    });
    for (k = 0; k < mh; k += 2.4) {
      member(g, [cx - w / 2, k, cz - w / 2], [cx + w / 2, k + 2.4, cz - w / 2], 0.07, M.dark);
      member(g, [cx - w / 2, k, cz + w / 2], [cx + w / 2, k + 2.4, cz + w / 2], 0.07, M.dark);
      member(g, [cx - w / 2, k, cz - w / 2], [cx - w / 2, k + 2.4, cz + w / 2], 0.07, M.dark);
      member(g, [cx + w / 2, k, cz - w / 2], [cx + w / 2, k + 2.4, cz + w / 2], 0.07, M.dark);
    }
    var jy = mh + 1.2;
    member(g, [cx, jy, cz], [cx - jib, jy, cz], 0.32, M.orange);
    member(g, [cx, jy + 1.6, cz], [cx - jib * 0.9, jy, cz], 0.08, M.pipe);
    member(g, [cx, jy, cz], [cx + cjib, jy, cz], 0.32, M.orange);
    member(g, [cx, jy + 1.6, cz], [cx + cjib, jy, cz], 0.08, M.pipe);
    member(g, [cx, mh, cz], [cx, jy + 2.4, cz], 0.2, M.steel);
    slab(g, cx + cjib - 1.4, jy - 0.9, cz, 2.4, 1.4, 1.6, M.concrete);
    slab(g, cx - 0.2, jy + 0.9, cz, 1.2, 1.2, 1.4, M.dark);
    tube(g, [cx - jib * 0.62, jy - 0.2, cz], [cx - jib * 0.62, 15, cz], 0.03, M.pipe, 6);
    slab(g, cx - jib * 0.62, 14.6, cz, 0.7, 0.7, 0.7, M.orange);
    slab(g, cx - jib * 0.62, 13.4, cz, 1.6, 1.2, 1.2, M.steel);
  }

  var MODELS = { hero: hero, bridge: bridge, process: process, refinery: refinery, gallery: gallery, arena: arena, industrial: industrial };

  /* =====================================================
     Viewer plumbing
     ===================================================== */
  var viewers = [];

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function createViewer(el) {
    var canvas = el.querySelector('canvas'), build = MODELS[el.dataset.model];
    if (!canvas || !build) return null;
    var isHero = el.dataset.mode === 'hero';
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdbe9ff, 0x14263d, 0.95));
    var key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(30, 50, 25); scene.add(key);
    var fill = new THREE.DirectionalLight(0x7fb5ff, 0.45); fill.position.set(-30, 20, -25); scene.add(fill);

    var group = new THREE.Group(); build(group); scene.add(group);

    var box = new THREE.Box3().setFromObject(group);
    var size = box.getSize(new V3()), center = box.getCenter(new V3());
    var maxDim = Math.max(size.x, size.y, size.z);

    var grid = new THREE.GridHelper(Math.max(size.x, size.z) * (isHero ? 1.8 : 1.5), 24, 0x2f6aa3, 0x1a3a5e);
    grid.position.set(center.x, box.min.y - 0.02, center.z);
    grid.material.transparent = true; grid.material.opacity = 0.55;
    scene.add(grid);

    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1000);
    var dist = (size.length() * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (isHero ? 1.28 : 0.92);
    camera.position.copy(center).add(new V3(0.85, isHero ? 0.42 : 0.55, 1).normalize().multiplyScalar(dist));

    var controls;
    if (isHero) {
      controls = { update: function () {} };
      camera.lookAt(center);
    } else {
      controls = new THREE.OrbitControls(camera, canvas);
      controls.target.copy(center);
      controls.enableDamping = true; controls.dampingFactor = 0.08;
      controls.enablePan = false; controls.enableZoom = false;
      controls.autoRotate = !reduce; controls.autoRotateSpeed = 1.1;
      controls.maxPolarAngle = Math.PI * 0.495;
      controls.update();
      canvas.style.touchAction = 'pan-y';
      var resumeTimer;
      controls.addEventListener('start', function () { controls.autoRotate = false; clearTimeout(resumeTimer); el.classList.add('touched'); });
      controls.addEventListener('end', function () { resumeTimer = setTimeout(function () { controls.autoRotate = !reduce; }, 3500); });
    }

    var v = { el: el, renderer: renderer, scene: scene, camera: camera, controls: controls, group: group, hero: isHero, visible: false, t0: null, mx: 0, my: 0, shown: -1 };

    if (isHero) {
      v.reveal = group.children.slice().sort(function (a, b) { return a.position.y - b.position.y; });
      if (!reduce) v.reveal.forEach(function (m) { m.visible = false; });
      window.addEventListener('mousemove', function (e) { v.mx = e.clientX / window.innerWidth - 0.5; v.my = e.clientY / window.innerHeight - 0.5; });
    }

    // explode slider
    var rng = el.querySelector('.vexplode');
    if (rng) {
      var parts = group.children.map(function (m) { var d = m.position.clone().sub(center); d.y *= 1.5; return { m: m, p: m.position.clone(), d: d }; });
      rng.addEventListener('input', function () {
        var k = rng.value / 100 * 0.6;
        parts.forEach(function (q) { q.m.position.copy(q.p).addScaledVector(q.d, k); });
        controls.autoRotate = false; el.classList.add('touched');
      });
    }

    function resize() {
      var w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      if (isHero) camera.setViewOffset(w, h, w > 850 ? -w * 0.2 : 0, h * 0.04, w, h);
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(el); else window.addEventListener('resize', resize);
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); el.classList.remove('live'); });
    el.classList.add('live');
    return v;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    for (var i = 0; i < viewers.length; i++) {
      var v = viewers[i];
      if (!v.visible || v.el.classList.contains('showref')) continue;
      if (v.hero) {
        if (v.t0 === null) v.t0 = now;
        var t = (now - v.t0) / 1000;
        if (v.reveal && !reduce && v.shown < v.reveal.length) {
          var p = Math.min(1, t / 5.5), n = Math.floor(v.reveal.length * (1 - Math.pow(1 - p, 2)));
          if (p >= 1) n = v.reveal.length;
          if (n !== v.shown) { for (var q = 0; q < v.reveal.length; q++) v.reveal[q].visible = q < n; v.shown = n; }
        }
        if (!reduce) { v.group.rotation.y = t * 0.1 + v.mx * 0.7; v.group.rotation.x = v.my * 0.06; }
      } else v.controls.update();
      v.renderer.render(v.scene, v.camera);
    }
  }

  function boot() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.viewer[data-model]'));
    if (!els.length) return;
    els.forEach(function (el) {
      var btn = el.querySelector('.vtoggle');
      if (btn) btn.addEventListener('click', function () {
        var showing = el.classList.toggle('showref');
        btn.textContent = showing ? 'View 3D model' : 'View reference image';
        btn.setAttribute('aria-pressed', showing ? 'true' : 'false');
      });
    });
    var started = false;
    function add(el) {
      var v = createViewer(el);
      if (v) { el._v = v; viewers.push(v); if (!started) { started = true; requestAnimationFrame(loop); } } else el._failed = true;
      return v;
    }
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var el = en.target;
        if (en.isIntersecting && !el._v && !el._failed) add(el);
        if (el._v) el._v.visible = en.isIntersecting;
      });
    }, { rootMargin: '150px' }) : null;
    els.forEach(function (el) {
      if (io) io.observe(el); else { var v = add(el); if (v) v.visible = true; }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
