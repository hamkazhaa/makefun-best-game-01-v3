// The 2D layer: health, money, timer, score pips, kill feed, buy menu,
// banners, the minimap and the menus. Plain DOM + one canvas.

import { SHOP, MAP, SITES } from './config.js';

export class Hud {
  constructor() {
    this.el = {};
    for (const id of [
      'hud', 'hp-num', 'hp-bar', 'armour-num', 'ammo', 'money', 'timer',
      'score-atk', 'score-def', 'pips-atk', 'pips-def', 'frags', 'feed',
      'banner', 'banner-title', 'banner-sub', 'buy-menu', 'buy-list',
      'menu', 'match-end', 'end-title', 'end-score', 'end-stats',
      'crosshair', 'plant-wrap', 'plant-fill', 'plant-label', 'minimap',
      'hint', 'charge-state',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el.minimap.getContext('2d');
    this.feedItems = [];
    this.buyOpen = false;
    this.onBuy = null;
    this.onPlayAgain = null;
    this.onStart = null;
    this._wireButtons();
  }

  _wireButtons() {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', () => this.onStart && this.onStart());
    const againBtn = document.getElementById('again-btn');
    if (againBtn) againBtn.addEventListener('click', () => this.onPlayAgain && this.onPlayAgain());
    const closeBtn = document.getElementById('buy-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.setBuyOpen(false));
  }

  showMenu(show) {
    this.el.menu.classList.toggle('hidden', !show);
    this.el.hud.classList.toggle('hidden', show);
  }

  showMatchEnd(show, title, score, stats) {
    this.el['match-end'].classList.toggle('hidden', !show);
    if (show) {
      this.el['end-title'].textContent = title;
      this.el['end-score'].textContent = score;
      this.el['end-stats'].textContent = stats;
    }
  }

  banner(title, sub, ms = 2600) {
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub;
    this.el.banner.classList.remove('hidden');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => this.el.banner.classList.add('hidden'), ms);
  }

  feed(text, good) {
    const div = document.createElement('div');
    div.className = 'feed-line' + (good === true ? ' good' : good === false ? ' bad' : '');
    div.textContent = text;
    this.el.feed.prepend(div);
    this.feedItems.unshift(div);
    while (this.feedItems.length > 5) {
      const old = this.feedItems.pop();
      old.remove();
    }
  }

  setBuyOpen(open) {
    this.buyOpen = open;
    this.el['buy-menu'].classList.toggle('hidden', !open);
    if (open) this.renderShop();
  }

  setBuyRound(n) {
    const el = document.getElementById('buy-round');
    if (el) el.textContent = String(n);
  }

  renderShop() {
    const list = this.el['buy-list'];
    list.innerHTML = '';
    for (const item of SHOP) {
      const row = document.createElement('button');
      row.className = 'buy-row';
      row.innerHTML = `<span>${item.label}</span><span class="price">$${item.price}</span>`;
      row.addEventListener('click', () => this.onBuy && this.onBuy(item.id));
      list.appendChild(row);
    }
  }

  setPlant(progress, label) {
    if (progress == null) {
      this.el['plant-wrap'].classList.add('hidden');
      return;
    }
    this.el['plant-wrap'].classList.remove('hidden');
    this.el['plant-fill'].style.width = `${Math.round(progress * 100)}%`;
    this.el['plant-label'].textContent = label;
  }

  update(s) {
    // s: {hp, armour, ammo, money, timeLeft, score, history, frags,
    //     phase, planted, carrier, deaths, alive}
    this.el['hp-num'].textContent = Math.max(0, Math.ceil(s.hp));
    this.el['hp-bar'].style.width = `${Math.max(0, s.hp)}%`;
    this.el['hp-bar'].style.background = s.hp > 50 ? '#2dd4bf' : s.hp > 25 ? '#f59e0b' : '#ef4444';
    this.el['armour-num'].textContent = Math.ceil(s.armour);
    this.el.ammo.textContent = s.ammo;
    this.el.money.textContent = `$${s.money}`;
    const t = Math.max(0, Math.ceil(s.timeLeft));
    this.el.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.el.timer.style.color = s.planted ? '#f59e0b' : '#e5e7eb';
    this.el['score-atk'].textContent = s.score.atk;
    this.el['score-def'].textContent = s.score.def;
    this._pips(this.el['pips-atk'], s.history, 'atk');
    this._pips(this.el['pips-def'], s.history, 'def');
    this.el.frags.textContent = s.frags;
    if (s.round != null) this.setBuyRound(s.round);
    this.el['charge-state'].textContent = s.planted
      ? `CHARGE PLANTED — ${s.planted}`
      : s.carrier ? 'YOU CARRY THE CHARGE' : 'CHARGE WITH A TEAMMATE';
    this.el['charge-state'].style.color = s.planted ? '#f59e0b' : '#2dd4bf';
    this.el.hint.textContent = s.phase === 'buy'
      ? 'BUY PHASE — press B to shop, click to lock your aim'
      : s.phase === 'play'
        ? 'WASD move · mouse aim · R reload · 1-4 weapons · E plant at a site'
        : '';
  }

  _pips(container, history, team) {
    const want = history.map((h) => (h === team ? '●' : '○')).join(' ');
    if (container.dataset.last !== want) {
      container.dataset.last = want;
      container.textContent = want;
      container.style.color = team === 'atk' ? '#2dd4bf' : '#fb923c';
    }
  }

  drawMinimap(player, bots, plantedSite) {
    const g = this.mapCtx;
    const W = this.el.minimap.width;
    const H = this.el.minimap.height;
    const sx = (x) => ((x + MAP.halfWidth) / (MAP.halfWidth * 2)) * W;
    const sy = (z) => ((z + MAP.halfDepth) / (MAP.halfDepth * 2)) * H;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(10, 16, 24, 0.72)';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#3f4756';
    g.strokeRect(1, 1, W - 2, H - 2);
    // Sites.
    for (const [key, s] of Object.entries(SITES)) {
      g.fillStyle = key === 'A' ? '#2dd4bf' : '#fb923c';
      g.beginPath();
      g.arc(sx(s.x), sy(s.z), 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0b0f14';
      g.font = 'bold 9px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(key, sx(s.x), sy(s.z));
      if (plantedSite === key) {
        g.strokeStyle = '#f59e0b';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(sx(s.x), sy(s.z), 10, 0, Math.PI * 2);
        g.stroke();
      }
    }
    // Depot.
    g.fillStyle = '#e8b93c';
    g.beginPath();
    g.arc(sx(0), sy(0), 4, 0, Math.PI * 2);
    g.fill();
    // Bots.
    for (const b of bots) {
      if (!b.alive) continue;
      g.fillStyle = b.team === 'atk' ? '#2dd4bf' : '#fb923c';
      g.beginPath();
      g.arc(sx(b.pos.x), sy(b.pos.z), 3.5, 0, Math.PI * 2);
      g.fill();
    }
    // Player arrow.
    if (player && player.alive) {
      const px = sx(player.pos.x);
      const py = sy(player.pos.z);
      g.fillStyle = '#ffffff';
      g.save();
      g.translate(px, py);
      g.rotate(-player.yaw);
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(4.5, 5);
      g.lineTo(-4.5, 5);
      g.closePath();
      g.fill();
      g.restore();
    }
  }
}
