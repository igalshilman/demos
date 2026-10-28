export const MAX_DT = 0.05;

export function createGame({ player, followCamera, level, onStatus = () => {} }) {
  const game = {
    won: false,

    update(rawDt, input, cameraForward) {
      if (game.won) return;
      const dt = Math.min(Math.max(rawDt, 0), MAX_DT);

      player.update(dt, input, cameraForward);

      if (player.getBounds().intersectsBox(level.goal)) {
        game.won = true;
        onStatus('won');
        return;
      }

      if (player.position.y < level.respawnY) {
        game.reset('respawned');
        return;
      }

      followCamera.update(dt, player.position);
    },

    reset(status = 'playing') {
      game.won = false;
      player.reset();
      followCamera.reset(player.position);
      onStatus(status);
    },
  };

  return game;
}
