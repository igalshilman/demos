export const PLAYER_HALF_WIDTH = 0.35;
export const PLAYER_HEIGHT = 1.6;

const MOVE_SPEED = 6;
const GRAVITY = 24;
const JUMP_SPEED = 9;
const MAX_FRAME = 0.1;
const MAX_SUBSTEP = 1 / 120;
const EPSILON = 1e-7;

export function createPlayer(spawn) {
  const player = {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    grounded: false,
  };
  return resetPlayer(player, spawn);
}

export function resetPlayer(player, spawn) {
  player.position.x = spawn.x;
  player.position.y = spawn.y;
  player.position.z = spawn.z;
  player.velocity.x = 0;
  player.velocity.y = 0;
  player.velocity.z = 0;
  player.grounded = false;
  return player;
}

function finiteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function horizontalDirection(input) {
  let x = finiteOrZero(input && input.moveX);
  let z = finiteOrZero(input && input.moveZ);
  const length = Math.hypot(x, z);
  if (length > 1) {
    x /= length;
    z /= length;
  }
  return { x, z };
}

function overlapsY(y, solid) {
  return y < solid.max.y - EPSILON && y + PLAYER_HEIGHT > solid.min.y + EPSILON;
}

function overlapsX(x, solid) {
  return x - PLAYER_HALF_WIDTH < solid.max.x - EPSILON && x + PLAYER_HALF_WIDTH > solid.min.x + EPSILON;
}

function overlapsZ(z, solid) {
  return z - PLAYER_HALF_WIDTH < solid.max.z - EPSILON && z + PLAYER_HALF_WIDTH > solid.min.z + EPSILON;
}

function moveX(position, dx, solids) {
  if (dx === 0) return;
  let x = position.x + dx;
  for (const solid of solids) {
    if (!overlapsY(position.y, solid) || !overlapsZ(position.z, solid) || !overlapsX(x, solid)) continue;
    x = dx > 0 ? solid.min.x - PLAYER_HALF_WIDTH : solid.max.x + PLAYER_HALF_WIDTH;
  }
  position.x = x;
}

function moveZ(position, dz, solids) {
  if (dz === 0) return;
  let z = position.z + dz;
  for (const solid of solids) {
    if (!overlapsY(position.y, solid) || !overlapsX(position.x, solid) || !overlapsZ(z, solid)) continue;
    z = dz > 0 ? solid.min.z - PLAYER_HALF_WIDTH : solid.max.z + PLAYER_HALF_WIDTH;
  }
  position.z = z;
}

// Swept on Y so a fast fall can't skip through a thin platform.
// Returns "floor", "ceiling" or null.
function moveY(player, dy, solids) {
  const { position, velocity } = player;
  const from = position.y;
  let y = from + dy;
  let hit = null;
  for (const solid of solids) {
    if (!overlapsX(position.x, solid) || !overlapsZ(position.z, solid)) continue;
    if (dy < 0) {
      const top = solid.max.y;
      if (from >= top - EPSILON && y < top && (hit !== "floor" || top > y)) {
        y = top;
        hit = "floor";
      }
    } else if (dy > 0) {
      const bottom = solid.min.y - PLAYER_HEIGHT;
      if (from <= bottom + EPSILON && y > bottom && hit !== "floor" && (hit !== "ceiling" || bottom < y)) {
        y = bottom;
        hit = "ceiling";
      }
    }
  }
  position.y = y;
  if (hit) velocity.y = 0;
  return hit;
}

function substep(player, dir, h, solids, jumpPressed) {
  const { position, velocity } = player;

  velocity.x = dir.x * MOVE_SPEED;
  velocity.z = dir.z * MOVE_SPEED;

  if (jumpPressed && player.grounded) {
    velocity.y = JUMP_SPEED;
    player.grounded = false;
  }

  moveX(position, velocity.x * h, solids);
  moveZ(position, velocity.z * h, solids);

  const startVy = velocity.y;
  velocity.y = startVy - GRAVITY * h;
  const dy = ((startVy + velocity.y) / 2) * h;
  const hit = moveY(player, dy, solids);
  player.grounded = hit === "floor";
}

export function stepPlayer(player, input, dt, solids) {
  if (!(dt > 0)) return player;
  const frame = Math.min(dt, MAX_FRAME);
  const count = Math.ceil(frame / MAX_SUBSTEP - 1e-9);
  const h = frame / count;
  const dir = horizontalDirection(input);
  const list = solids || [];
  let jump = Boolean(input && input.jump);

  for (let i = 0; i < count; i++) {
    substep(player, dir, h, list, jump);
    jump = false;
  }
  return player;
}
