// Pure AABB collision helpers. No three.js dependency; inputs are never mutated.
// A box is { min: {x, y, z}, max: {x, y, z} }.
// A body is described by its feet position {x, y, z}, a horizontal radius and a height.

const GROUND_EPSILON = 0.01;
const STEP_TOLERANCE = 0.05;
const TOUCH_EPSILON = 1e-6;
const MAX_STEP_DISTANCE = 0.25;

export function aabbOverlap(a, b) {
  return (
    a.min.x < b.max.x && a.max.x > b.min.x &&
    a.min.y < b.max.y && a.max.y > b.min.y &&
    a.min.z < b.max.z && a.max.z > b.min.z
  );
}

function overlapsFootprint(box, x, z, radius) {
  return (
    x + radius > box.min.x && x - radius < box.max.x &&
    z + radius > box.min.z && z - radius < box.max.z
  );
}

// Highest box top under (x, z) that is at or below feetY (+0.01), else -Infinity.
// Without feetY, the highest top under the point.
export function groundHeightAt(boxes, x, z, feetY = Infinity, radius = 0) {
  let best = -Infinity;
  for (const box of boxes) {
    const top = box.max.y;
    if (top > feetY + GROUND_EPSILON) continue;
    const inside = radius > 0
      ? overlapsFootprint(box, x, z, radius)
      : x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z;
    if (inside && top > best) best = top;
  }
  return best;
}

function blocksHorizontally(box, p, radius, height) {
  return (
    overlapsFootprint(box, p.x, p.z, radius) &&
    p.y < box.max.y - STEP_TOLERANCE &&
    p.y + height > box.min.y + TOUCH_EPSILON
  );
}

function resolveAxis(boxes, p, v, axis, radius, height) {
  for (const box of boxes) {
    if (!blocksHorizontally(box, p, radius, height)) continue;
    const velocity = v[axis];
    let direction = Math.sign(velocity);
    if (direction === 0) {
      // Already embedded: leave through the nearer side.
      const center = (box.min[axis] + box.max[axis]) / 2;
      direction = p[axis] >= center ? -1 : 1;
    }
    if (direction > 0) p[axis] = box.min[axis] - radius;
    else p[axis] = box.max[axis] + radius;
    if (velocity !== 0) v[axis] = 0;
  }
}

function slideFeet(boxes, position, velocity, dt, radius, height) {
  const p = { x: position.x, y: position.y, z: position.z };
  const v = { x: velocity.x, y: velocity.y, z: velocity.z };

  const horizontal = Math.max(Math.abs(v.x), Math.abs(v.z)) * Math.abs(dt);
  const steps = Math.max(1, Math.ceil(horizontal / MAX_STEP_DISTANCE));
  const stepDt = dt / steps;
  for (let i = 0; i < steps; i += 1) {
    p.x += v.x * stepDt;
    resolveAxis(boxes, p, v, 'x', radius, height);
    p.z += v.z * stepDt;
    resolveAxis(boxes, p, v, 'z', radius, height);
  }

  const prevFeet = p.y;
  let grounded = false;
  p.y += v.y * dt;

  if (v.y <= 0) {
    let landing = -Infinity;
    for (const box of boxes) {
      if (!overlapsFootprint(box, p.x, p.z, radius)) continue;
      const top = box.max.y;
      if (prevFeet >= top - STEP_TOLERANCE && p.y < top && top > landing) landing = top;
    }
    if (landing > -Infinity) {
      p.y = landing;
      v.y = 0;
      grounded = true;
    }
  } else {
    const prevHead = prevFeet + height;
    let ceiling = Infinity;
    for (const box of boxes) {
      if (!overlapsFootprint(box, p.x, p.z, radius)) continue;
      const bottom = box.min.y;
      if (prevHead <= bottom + STEP_TOLERANCE && p.y + height > bottom && bottom < ceiling) {
        ceiling = bottom;
      }
    }
    if (ceiling < Infinity) {
      p.y = ceiling - height;
      v.y = 0;
    }
  }

  if (!grounded && v.y <= 0) {
    const ground = groundHeightAt(boxes, p.x, p.z, p.y, radius);
    if (ground > -Infinity && p.y - ground <= GROUND_EPSILON) {
      p.y = ground;
      v.y = 0;
      grounded = true;
    }
  }

  return { position: p, velocity: v, grounded };
}

// Moves a body for dt seconds, sliding along walls and landing on tops. Two call forms:
//   moveAndSlide(boxes, feetPosition, velocity, dt, radius, height)
//   moveAndSlide(centerPosition, velocity, halfExtents, boxes, dt)
// Both return new plain objects { position, velocity, grounded, onGround };
// positions are in the same frame (feet or centre) as the input.
export function moveAndSlide(...args) {
  if (Array.isArray(args[0])) {
    const [boxes, position, velocity, dt, radius, height] = args;
    const result = slideFeet(boxes, position, velocity, dt, radius, height);
    return { ...result, onGround: result.grounded };
  }
  const [position, velocity, half, boxes, dt] = args;
  const feet = { x: position.x, y: position.y - half.y, z: position.z };
  const result = slideFeet(boxes, feet, velocity, dt, Math.max(half.x, half.z), half.y * 2);
  return {
    position: { x: result.position.x, y: result.position.y + half.y, z: result.position.z },
    velocity: result.velocity,
    grounded: result.grounded,
    onGround: result.grounded,
  };
}
