import { Box3, Vector3 } from 'three';

export const FALL_LIMIT_Y = -12;
export const PICKUP_MARGIN = 0.35;
export const PLAYER_CENTER_OFFSET = 0.8;
export const PLAYER_HALF_WIDTH = 0.35;
export const PLAYER_HEIGHT = 1.6;

export interface PlayerInput {
  moveX: number;
  moveZ: number;
  jumpPressed: boolean;
}

export interface SessionPlayer {
  root: { position: Vector3 };
  reset(spawn: Vector3): void;
  update(dt: number, input: PlayerInput, colliders: readonly Box3[]): void;
}

export interface Collectible {
  id: string;
  position: Vector3;
  radius: number;
}

export interface SessionLevel {
  spawn: Vector3;
  colliders: readonly Box3[];
  collectibles: readonly Collectible[];
  goal: Box3;
  collect(id: string): void;
  reset(): void;
}

export type SessionStatus = 'playing' | 'won';

export interface SessionSnapshot {
  collected: number;
  total: number;
  goalUnlocked: boolean;
  status: SessionStatus;
}

export class GameSession {
  private readonly collectedIds = new Set<string>();
  private currentStatus: SessionStatus = 'playing';
  private readonly center = new Vector3();
  private readonly playerBox = new Box3();

  constructor(
    private readonly player: SessionPlayer,
    private readonly level: SessionLevel,
  ) {}

  get status(): SessionStatus {
    return this.currentStatus;
  }

  get snapshot(): SessionSnapshot {
    return {
      collected: this.collectedIds.size,
      total: this.level.collectibles.length,
      goalUnlocked: this.allCollected(),
      status: this.currentStatus,
    };
  }

  /** Advances one step. Returns false when the game is frozen (won) and nothing ran. */
  update(dt: number, input: PlayerInput): boolean {
    if (this.currentStatus === 'won') return false;

    this.player.update(dt, input, this.level.colliders);

    const feet = this.player.root.position;
    if (feet.y < FALL_LIMIT_Y) {
      this.restart();
      return true;
    }

    this.center.set(feet.x, feet.y + PLAYER_CENTER_OFFSET, feet.z);
    for (const item of this.level.collectibles) {
      if (this.collectedIds.has(item.id)) continue;
      const reach = item.radius + PICKUP_MARGIN;
      if (this.center.distanceToSquared(item.position) <= reach * reach) {
        this.collectedIds.add(item.id);
        this.level.collect(item.id);
      }
    }

    if (this.allCollected()) {
      this.playerBox.min.set(feet.x - PLAYER_HALF_WIDTH, feet.y, feet.z - PLAYER_HALF_WIDTH);
      this.playerBox.max.set(
        feet.x + PLAYER_HALF_WIDTH,
        feet.y + PLAYER_HEIGHT,
        feet.z + PLAYER_HALF_WIDTH,
      );
      if (this.playerBox.intersectsBox(this.level.goal)) {
        this.currentStatus = 'won';
      }
    }
    return true;
  }

  restart(): void {
    this.collectedIds.clear();
    this.currentStatus = 'playing';
    this.level.reset();
    this.player.reset(this.level.spawn);
  }

  private allCollected(): boolean {
    return this.collectedIds.size >= this.level.collectibles.length;
  }
}
