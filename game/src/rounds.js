// The match itself: buy phase, play, plant and defuse, the economy,
// and who won which round. The state machine every other system reads.

import { MAP } from './config.js';

export class Rounds {
  constructor() {
    this.phase = 'menu';
    this.round = 0;
    this.score = { atk: 0, def: 0 };
    this.history = []; // 'atk' | 'def' per finished round
    this.phaseT = 0;
    this.plantedSite = null;
    this.detonateT = 0;
    this.winner = null;
    this.endReason = '';
  }

  get timeLeft() {
    if (this.phase === 'buy') return Math.max(0, MAP.buySeconds - this.phaseT);
    if (this.phase === 'play') {
      if (this.plantedSite) return Math.max(0, this.detonateT);
      return Math.max(0, MAP.roundSeconds - this.phaseT);
    }
    return 0;
  }

  startMatch(ctx) {
    this.phase = 'buy';
    this.round = 1;
    this.score = { atk: 0, def: 0 };
    this.history = [];
    this.phaseT = 0;
    this.plantedSite = null;
    this.winner = null;
    this.endReason = '';
    ctx.onPhase('buy');
  }

  startRound(ctx) {
    this.phase = 'buy';
    this.phaseT = 0;
    this.plantedSite = null;
    this.detonateT = 0;
    ctx.onPhase('buy');
  }

  beginPlay(ctx) {
    this.phase = 'play';
    this.phaseT = 0;
    ctx.sounds.horn();
    ctx.onPhase('play');
  }

  plant(siteKey, ctx) {
    this.plantedSite = siteKey;
    this.detonateT = MAP.detonateSeconds;
    ctx.onPlanted(siteKey);
  }

  defused(ctx) {
    this.endRound('def', 'Charge defused', ctx);
  }

  endRound(winner, reason, ctx) {
    if (this.phase === 'roundEnd' || this.phase === 'matchEnd') return;
    this.score[winner] += 1;
    this.history.push(winner);
    this.winner = winner;
    this.endReason = reason;
    this.phase = 'roundEnd';
    this.phaseT = 0;
    if (winner === 'atk') ctx.sounds.winJingle();
    ctx.onRoundEnd(winner, reason);
    if (this.score[winner] >= MAP.winRounds || this.round >= MAP.maxRounds) {
      this.phase = 'matchEnd';
      ctx.onMatchEnd(this.score.atk > this.score.def ? 'atk' : 'def');
    }
  }

  nextRound(ctx) {
    this.round += 1;
    this.startRound(ctx);
  }

  tick(dt, ctx) {
    if (this.phase === 'buy') {
      this.phaseT += dt;
      if (this.phaseT >= MAP.buySeconds) this.beginPlay(ctx);
      return;
    }
    if (this.phase === 'play') {
      this.phaseT += dt;
      if (this.plantedSite) {
        this.detonateT -= dt;
        if (this.detonateT <= 0) {
          const site = ctx.sites[this.plantedSite];
          ctx.fx.explosion({ x: site.x, y: 0.5, z: site.z });
          ctx.sounds.explosion();
          this.endRound('atk', 'Charge detonated', ctx);
          return;
        }
      } else if (this.phaseT >= MAP.roundSeconds) {
        this.endRound('def', 'Time expired', ctx);
        return;
      }
      // Elimination.
      const atkAlive = ctx.aliveCount('atk');
      const defAlive = ctx.aliveCount('def');
      if (atkAlive === 0 && !this.plantedSite) {
        this.endRound('def', 'Attackers eliminated', ctx);
        return;
      }
      if (defAlive === 0) {
        this.endRound('atk', 'Defenders eliminated', ctx);
        return;
      }
      return;
    }
    if (this.phase === 'roundEnd') {
      this.phaseT += dt;
      if (this.phaseT >= 4) this.nextRound(ctx);
    }
  }
}
