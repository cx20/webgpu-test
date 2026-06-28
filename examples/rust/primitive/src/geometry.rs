//! Native geometry generators for the nine primitives.
//!
//! Each generator returns a non-indexed triangle list: a flat `positions`
//! array (xyz) paired with a `uvs` array (uv), matching the JavaScript
//! reference that builds the same meshes with the manifold-3d library.

use std::f32::consts::PI;

pub struct Geometry {
    pub positions: Vec<f32>,
    pub uvs: Vec<f32>,
}

impl Geometry {
    fn new() -> Self {
        Self {
            positions: Vec::new(),
            uvs: Vec::new(),
        }
    }

    fn push(&mut self, p: [f32; 3], uv: [f32; 2]) {
        self.positions.extend_from_slice(&p);
        self.uvs.extend_from_slice(&uv);
    }

    pub fn vertex_count(&self) -> u32 {
        (self.positions.len() / 3) as u32
    }
}

// ========== UV mapping helpers ==========

fn spherical_uv(p: [f32; 3]) -> [f32; 2] {
    let len = (p[0] * p[0] + p[1] * p[1] + p[2] * p[2]).sqrt();
    if len == 0.0 {
        return [0.5, 0.5];
    }
    let nx = p[0] / len;
    let ny = p[1] / len;
    let nz = p[2] / len;
    let u = 0.5 - nz.atan2(nx) / (2.0 * PI);
    let v = 0.5 - ny.clamp(-1.0, 1.0).asin() / PI;
    [u, v]
}

fn box_uv(p: [f32; 3]) -> [f32; 2] {
    let (x, y, z) = (p[0], p[1], p[2]);
    let (ax, ay, az) = (x.abs(), y.abs(), z.abs());
    if ax >= ay && ax >= az {
        [(z / ax + 1.0) / 2.0, (y / ax + 1.0) / 2.0]
    } else if ay >= ax && ay >= az {
        [(x / ay + 1.0) / 2.0, (z / ay + 1.0) / 2.0]
    } else {
        [(x / az + 1.0) / 2.0, (y / az + 1.0) / 2.0]
    }
}

fn cylindrical_uv(x: f32, y: f32, z: f32, height: f32) -> [f32; 2] {
    let u = 0.5 - z.atan2(x) / (2.0 * PI);
    let v = (y + height / 2.0) / height;
    [u, v]
}

// ========== Generators ==========

pub fn plane(width: f32, height: f32, segments: usize) -> Geometry {
    let mut g = Geometry::new();
    let hw = width / 2.0;
    let hh = height / 2.0;
    let seg_w = width / segments as f32;
    let seg_h = height / segments as f32;
    for j in 0..segments {
        for i in 0..segments {
            let x0 = -hw + i as f32 * seg_w;
            let x1 = x0 + seg_w;
            let y0 = -hh + j as f32 * seg_h;
            let y1 = y0 + seg_h;
            let u0 = i as f32 / segments as f32;
            let u1 = (i + 1) as f32 / segments as f32;
            let v0 = j as f32 / segments as f32;
            let v1 = (j + 1) as f32 / segments as f32;
            g.push([x0, y0, 0.0], [u0, v0]);
            g.push([x1, y0, 0.0], [u1, v0]);
            g.push([x1, y1, 0.0], [u1, v1]);
            g.push([x0, y0, 0.0], [u0, v0]);
            g.push([x1, y1, 0.0], [u1, v1]);
            g.push([x0, y1, 0.0], [u0, v1]);
        }
    }
    g
}

pub fn circle(radius: f32, segments: usize) -> Geometry {
    let mut g = Geometry::new();
    for i in 0..segments {
        let a0 = i as f32 / segments as f32 * PI * 2.0;
        let a1 = (i + 1) as f32 / segments as f32 * PI * 2.0;
        let (x0, z0) = (a0.cos() * radius, a0.sin() * radius);
        let (x1, z1) = (a1.cos() * radius, a1.sin() * radius);
        g.push([0.0, 0.0, 0.0], [0.5, 0.5]);
        g.push([x0, 0.0, z0], [(x0 / radius + 1.0) / 2.0, (z0 / radius + 1.0) / 2.0]);
        g.push([x1, 0.0, z1], [(x1 / radius + 1.0) / 2.0, (z1 / radius + 1.0) / 2.0]);
    }
    g
}

pub fn cube(size: f32) -> Geometry {
    let h = size / 2.0;
    let c = [
        [-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h], // back  (z = -h)
        [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h],     // front (z =  h)
    ];
    let faces = [
        [4, 5, 6, 7], // front  +z
        [1, 0, 3, 2], // back   -z
        [7, 6, 2, 3], // top    +y
        [0, 1, 5, 4], // bottom -y
        [5, 1, 2, 6], // right  +x
        [0, 4, 7, 3], // left   -x
    ];
    let mut g = Geometry::new();
    for f in faces {
        let q = [c[f[0]], c[f[1]], c[f[2]], c[f[3]]];
        for &idx in &[0usize, 1, 2, 0, 2, 3] {
            let p = q[idx];
            g.push(p, box_uv(p));
        }
    }
    g
}

pub fn sphere(radius: f32, lon_segments: usize, lat_segments: usize) -> Geometry {
    let mut g = Geometry::new();
    let point = |u: f32, v: f32| -> [f32; 3] {
        let theta = u * 2.0 * PI;
        let phi = v * PI;
        [
            radius * phi.sin() * theta.cos(),
            radius * phi.cos(),
            radius * phi.sin() * theta.sin(),
        ]
    };
    for j in 0..lat_segments {
        for i in 0..lon_segments {
            let u0 = i as f32 / lon_segments as f32;
            let u1 = (i + 1) as f32 / lon_segments as f32;
            let v0 = j as f32 / lat_segments as f32;
            let v1 = (j + 1) as f32 / lat_segments as f32;
            let p00 = point(u0, v0);
            let p10 = point(u1, v0);
            let p11 = point(u1, v1);
            let p01 = point(u0, v1);
            g.push(p00, [u0, v0]);
            g.push(p10, [u1, v0]);
            g.push(p11, [u1, v1]);
            g.push(p00, [u0, v0]);
            g.push(p11, [u1, v1]);
            g.push(p01, [u0, v1]);
        }
    }
    g
}

/// A truncated cone. `r_top == 0` produces a cone, equal radii a cylinder.
pub fn cylinder(height: f32, r_bottom: f32, r_top: f32, segments: usize) -> Geometry {
    let mut g = Geometry::new();
    let hh = height / 2.0;
    for i in 0..segments {
        let a0 = i as f32 / segments as f32 * 2.0 * PI;
        let a1 = (i + 1) as f32 / segments as f32 * 2.0 * PI;
        let (c0, s0) = (a0.cos(), a0.sin());
        let (c1, s1) = (a1.cos(), a1.sin());
        let pb0 = [r_bottom * c0, -hh, r_bottom * s0];
        let pb1 = [r_bottom * c1, -hh, r_bottom * s1];
        let pt0 = [r_top * c0, hh, r_top * s0];
        let pt1 = [r_top * c1, hh, r_top * s1];
        let uv = |p: [f32; 3]| cylindrical_uv(p[0], p[1], p[2], height);
        // Side
        g.push(pb0, uv(pb0));
        g.push(pb1, uv(pb1));
        g.push(pt1, uv(pt1));
        g.push(pb0, uv(pb0));
        g.push(pt1, uv(pt1));
        g.push(pt0, uv(pt0));
        // Bottom cap
        if r_bottom > 0.0 {
            g.push([0.0, -hh, 0.0], [0.5, 0.5]);
            g.push(pb1, [(c1 + 1.0) / 2.0, (s1 + 1.0) / 2.0]);
            g.push(pb0, [(c0 + 1.0) / 2.0, (s0 + 1.0) / 2.0]);
        }
        // Top cap
        if r_top > 0.0 {
            g.push([0.0, hh, 0.0], [0.5, 0.5]);
            g.push(pt0, [(c0 + 1.0) / 2.0, (s0 + 1.0) / 2.0]);
            g.push(pt1, [(c1 + 1.0) / 2.0, (s1 + 1.0) / 2.0]);
        }
    }
    g
}

pub fn tetrahedron(radius: f32) -> Geometry {
    let a = radius * (8.0f32 / 9.0).sqrt();
    let b = radius * (2.0f32 / 9.0).sqrt();
    let c = radius * (2.0f32 / 3.0).sqrt();
    let d = radius / 3.0;
    let vertices = [
        [0.0, radius, 0.0],
        [-c, -d, -b],
        [c, -d, -b],
        [0.0, -d, a],
    ];
    let faces = [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]];
    let mut g = Geometry::new();
    for face in faces {
        for idx in face {
            let v = vertices[idx];
            g.push(v, spherical_uv(v));
        }
    }
    g
}

pub fn octahedron(radius: f32) -> Geometry {
    let vertices = [
        [0.0, radius, 0.0],
        [0.0, -radius, 0.0],
        [radius, 0.0, 0.0],
        [-radius, 0.0, 0.0],
        [0.0, 0.0, radius],
        [0.0, 0.0, -radius],
    ];
    let faces = [
        [0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4],
        [1, 2, 4], [1, 5, 2], [1, 3, 5], [1, 4, 3],
    ];
    let mut g = Geometry::new();
    for face in faces {
        for idx in face {
            let v = vertices[idx];
            g.push(v, spherical_uv(v));
        }
    }
    g
}

pub fn torus(
    major_radius: f32,
    minor_radius: f32,
    major_segments: usize,
    minor_segments: usize,
) -> Geometry {
    let mut g = Geometry::new();
    let point = |theta: f32, phi: f32| -> [f32; 3] {
        let r = major_radius + minor_radius * phi.cos();
        [r * theta.cos(), minor_radius * phi.sin(), r * theta.sin()]
    };
    for j in 0..major_segments {
        let u0 = j as f32 / major_segments as f32;
        let u1 = (j + 1) as f32 / major_segments as f32;
        let theta0 = u0 * PI * 2.0;
        let theta1 = u1 * PI * 2.0;
        for i in 0..minor_segments {
            let v0 = i as f32 / minor_segments as f32;
            let v1 = (i + 1) as f32 / minor_segments as f32;
            let phi0 = v0 * PI * 2.0;
            let phi1 = v1 * PI * 2.0;
            let p00 = point(theta0, phi0);
            let p10 = point(theta1, phi0);
            let p01 = point(theta0, phi1);
            let p11 = point(theta1, phi1);
            g.push(p00, [u0, v0]);
            g.push(p10, [u1, v0]);
            g.push(p11, [u1, v1]);
            g.push(p00, [u0, v0]);
            g.push(p11, [u1, v1]);
            g.push(p01, [u0, v1]);
        }
    }
    g
}
