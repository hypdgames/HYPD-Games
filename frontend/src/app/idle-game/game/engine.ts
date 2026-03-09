// ===== TYPES =====
export type EnemyType = 'goblin' | 'skeleton' | 'orc' | 'bat' | 'demon'
export type GamePhase = 'playing' | 'levelup' | 'victory' | 'defeat'

export interface Enemy {
  id: number; x: number; y: number; type: EnemyType
  hp: number; maxHp: number; speed: number; baseSpeed: number
  damage: number; radius: number
  poisonTimer: number; slowTimer: number
  kbVx: number; kbVy: number; flashTimer: number
}
export interface Projectile {
  id: number; x: number; y: number; vx: number; vy: number
  damage: number; pierceLeft: number; hitEnemies: Set<number>; isCrit: boolean
}
export interface Pickup {
  id: number; x: number; y: number
  type: 'xp' | 'gold'; value: number; age: number
}
export interface DamageNumber {
  id: number; x: number; y: number; value: number; age: number; isCrit: boolean
}
export interface PlayerStats {
  maxHp: number; damage: number; attackSpeed: number; range: number
  critChance: number; critDamage: number; poisonChance: number
  pierce: number; multiShot: number; xpBonus: number; coinBonus: number
  slow: number; regen: number; luck: number; knockback: number
}
export interface UpgradeDef {
  id: string; name: string; maxLevel: number
  desc: string; color: string; icon: string
  perLevel: Partial<PlayerStats>; healOnBuy?: number
}
export interface LobbyUpgradeDef extends UpgradeDef {
  cost: (level: number) => number
}
export interface GameSave {
  gold: number; lobbyLevels: Record<string, number>
  gamesPlayed: number; bestTime: number; bestKills: number
}

// ===== CONSTANTS =====
export const GW_DEFAULT = 480, GH_DEFAULT = 480
export const DURATION = 900
export const ARROW_SPEED = 280
export const TOWER_R = 16
export const PICKUP_R = 22
export const MAX_ENEMIES = 120

export const BASE_STATS: PlayerStats = {
  maxHp: 100, damage: 10, attackSpeed: 1.0, range: 120,
  critChance: 0, critDamage: 2.0, poisonChance: 0,
  pierce: 0, multiShot: 1, xpBonus: 0, coinBonus: 0,
  slow: 0, regen: 0, luck: 0, knockback: 0,
}

export const ENEMY_DATA: Record<EnemyType, {
  hp: number; speed: number; damage: number; radius: number; xp: number; goldChance: number
}> = {
  goblin:   { hp: 20,  speed: 38, damage: 5,  radius: 6,  xp: 2,  goldChance: 0.2 },
  skeleton: { hp: 35,  speed: 30, damage: 8,  radius: 7,  xp: 4,  goldChance: 0.25 },
  orc:      { hp: 80,  speed: 20, damage: 15, radius: 10, xp: 8,  goldChance: 0.3 },
  bat:      { hp: 12,  speed: 52, damage: 3,  radius: 5,  xp: 1,  goldChance: 0.15 },
  demon:    { hp: 200, speed: 16, damage: 25, radius: 12, xp: 20, goldChance: 0.6 },
}

export function xpForLevel(lvl: number) {
  return Math.floor(10 + lvl * 8 + lvl * lvl * 1.5)
}

function getSpawnConfig(t: number): { type: EnemyType; rate: number }[] {
  const cfg: { type: EnemyType; rate: number }[] = []
  cfg.push({ type: 'goblin', rate: 0.5 + t / 150 })
  if (t > 90)  cfg.push({ type: 'skeleton', rate: 0.25 + (t - 90) / 220 })
  if (t > 200) cfg.push({ type: 'bat', rate: 0.3 + (t - 200) / 200 })
  if (t > 350) cfg.push({ type: 'orc', rate: 0.15 + (t - 350) / 300 })
  if (t > 550) cfg.push({ type: 'demon', rate: 0.08 + (t - 550) / 500 })
  return cfg
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'damage', name: 'Damage', maxLevel: 5, desc: '+5 Damage', color: '#e44', icon: '\u2694', perLevel: { damage: 5 } },
  { id: 'health', name: 'Health', maxLevel: 5, desc: '+20 Max HP', color: '#4e4', icon: '\u2665', perLevel: { maxHp: 20 }, healOnBuy: 20 },
  { id: 'atkSpeed', name: 'Atk Speed', maxLevel: 5, desc: '+0.3 Atk/s', color: '#48e', icon: '\u26a1', perLevel: { attackSpeed: 0.3 } },
  { id: 'range', name: 'Range', maxLevel: 5, desc: '+20 Range', color: '#ea4', icon: '\ud83c\udfaf', perLevel: { range: 20 } },
  { id: 'critChance', name: 'Crit %', maxLevel: 5, desc: '+5% Crit', color: '#e84', icon: '\ud83d\udca5', perLevel: { critChance: 5 } },
  { id: 'critDmg', name: 'Crit Dmg', maxLevel: 5, desc: '+25% Crit Dmg', color: '#e4a', icon: '\ud83d\udd25', perLevel: { critDamage: 0.25 } },
  { id: 'poison', name: 'Poison', maxLevel: 5, desc: '+5% Poison', color: '#8e4', icon: '\u2620', perLevel: { poisonChance: 5 } },
  { id: 'pierce', name: 'Pierce', maxLevel: 3, desc: '+1 Pierce', color: '#4ee', icon: '\u279c', perLevel: { pierce: 1 } },
  { id: 'multiShot', name: 'Multi-Shot', maxLevel: 3, desc: '+1 Arrow', color: '#e4e', icon: '\u21f6', perLevel: { multiShot: 1 } },
  { id: 'xpBonus', name: 'XP Bonus', maxLevel: 5, desc: '+10% XP', color: '#ae4', icon: '\u2605', perLevel: { xpBonus: 10 } },
  { id: 'coinBonus', name: 'Coin Bonus', maxLevel: 5, desc: '+10% Coins', color: '#ea0', icon: '\ud83d\udcb0', perLevel: { coinBonus: 10 } },
  { id: 'slow', name: 'Slow', maxLevel: 3, desc: '+10% Slow', color: '#48e', icon: '\u2744', perLevel: { slow: 10 } },
  { id: 'regen', name: 'Regen', maxLevel: 3, desc: '+2 HP/s', color: '#4e8', icon: '\ud83c\udf3f', perLevel: { regen: 2 } },
  { id: 'luck', name: 'Luck', maxLevel: 5, desc: '+5% Better drops', color: '#4ea', icon: '\ud83c\udf40', perLevel: { luck: 5 } },
  { id: 'knockback', name: 'Knockback', maxLevel: 5, desc: '+10 Knockback', color: '#a4e', icon: '\ud83d\udca8', perLevel: { knockback: 10 } },
]

export const LOBBY_UPGRADES: LobbyUpgradeDef[] = [
  { id: 'l_damage', name: 'Damage', maxLevel: 10, desc: '+2 Dmg', color: '#e44', icon: '\u2694', perLevel: { damage: 2 }, cost: (l) => 20 + l * 15 },
  { id: 'l_health', name: 'Health', maxLevel: 10, desc: '+20 HP', color: '#4e4', icon: '\u2665', perLevel: { maxHp: 20 }, cost: (l) => 15 + l * 10 },
  { id: 'l_atkSpeed', name: 'Speed', maxLevel: 10, desc: '+0.15 Atk/s', color: '#48e', icon: '\u26a1', perLevel: { attackSpeed: 0.15 }, cost: (l) => 25 + l * 20 },
  { id: 'l_range', name: 'Range', maxLevel: 10, desc: '+15 Range', color: '#ea4', icon: '\ud83c\udfaf', perLevel: { range: 15 }, cost: (l) => 20 + l * 12 },
  { id: 'l_crit', name: 'Crit', maxLevel: 5, desc: '+5% Crit', color: '#e84', icon: '\ud83d\udca5', perLevel: { critChance: 5 }, cost: (l) => 30 + l * 25 },
  { id: 'l_poison', name: 'Poison', maxLevel: 5, desc: '+5% Poison', color: '#8e4', icon: '\u2620', perLevel: { poisonChance: 5 }, cost: (l) => 40 + l * 30 },
  { id: 'l_pierce', name: 'Pierce', maxLevel: 3, desc: '+1 Pierce', color: '#4ee', icon: '\u279c', perLevel: { pierce: 1 }, cost: (l) => 50 + l * 40 },
  { id: 'l_multi', name: 'Multi', maxLevel: 3, desc: '+1 Arrow', color: '#e4e', icon: '\u21f6', perLevel: { multiShot: 1 }, cost: (l) => 60 + l * 50 },
  { id: 'l_xp', name: 'XP Gain', maxLevel: 5, desc: '+10% XP', color: '#ae4', icon: '\u2605', perLevel: { xpBonus: 10 }, cost: (l) => 15 + l * 10 },
  { id: 'l_coin', name: 'Coins', maxLevel: 5, desc: '+10% Gold', color: '#ea0', icon: '\ud83d\udcb0', perLevel: { coinBonus: 10 }, cost: (l) => 15 + l * 10 },
  { id: 'l_regen', name: 'Regen', maxLevel: 3, desc: '+1 HP/s', color: '#4e8', icon: '\ud83c\udf3f', perLevel: { regen: 1 }, cost: (l) => 35 + l * 25 },
  { id: 'l_luck', name: 'Luck', maxLevel: 5, desc: '+5% Luck', color: '#4ea', icon: '\ud83c\udf40', perLevel: { luck: 5 }, cost: (l) => 20 + l * 15 },
]

// ===== GAME ENGINE =====
export class GameEngine {
  phase: GamePhase = 'playing'
  hp: number
  stats: PlayerStats
  level = 1
  xp = 0
  xpToNext: number
  kills = 0
  gold = 0
  goldEarned = 0
  timeElapsed = 0
  upgradeLevels: Record<string, number> = {}
  enemies: Enemy[] = []
  projectiles: Projectile[] = []
  pickups: Pickup[] = []
  dmgNumbers: DamageNumber[] = []
  attackTimer = 0
  regenTimer = 0
  spawnTimers: Record<string, number> = {}
  gameSpeed = 1
  towerLevel = 1
  _nextId = 0
  // Dynamic dimensions
  gw: number
  gh: number
  cx: number
  cy: number

  onLevelUp?: (choices: UpgradeDef[]) => void
  onGameEnd?: (victory: boolean) => void

  constructor(public save: GameSave, gw = GW_DEFAULT, gh = GH_DEFAULT) {
    this.gw = gw
    this.gh = gh
    this.cx = gw / 2
    this.cy = gh / 2
    this.stats = { ...BASE_STATS }
    for (const upg of LOBBY_UPGRADES) {
      const lvl = save.lobbyLevels[upg.id] || 0
      if (lvl > 0) {
        for (const [key, val] of Object.entries(upg.perLevel)) {
          (this.stats as unknown as Record<string, number>)[key] += (val as number) * lvl
        }
      }
    }
    this.hp = this.stats.maxHp
    this.xpToNext = xpForLevel(this.level)
  }

  nextId() { return ++this._nextId }

  update(dt: number) {
    if (this.phase !== 'playing') return
    dt *= this.gameSpeed
    this.timeElapsed += dt

    if (this.timeElapsed >= DURATION) {
      this.phase = 'victory'
      this.onGameEnd?.(true)
      return
    }

    // Regen
    if (this.stats.regen > 0) {
      this.regenTimer += dt
      if (this.regenTimer >= 1) {
        this.regenTimer -= 1
        this.hp = Math.min(this.hp + this.stats.regen, this.stats.maxHp)
      }
    }

    this.updateSpawning(dt)
    this.updateAttack(dt)
    this.updateProjectiles(dt)
    this.updateEnemies(dt)
    this.updatePoison(dt)

    // Clean up dead enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].hp <= 0) {
        this.onEnemyKilled(this.enemies[i])
        this.enemies.splice(i, 1)
      }
    }

    // Age damage numbers
    this.dmgNumbers = this.dmgNumbers.filter(d => {
      d.age += dt; d.y -= 20 * dt; return d.age < 0.8
    })
    // Age pickups & auto-collect after 0.6s
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      this.pickups[i].age += dt
      if (this.pickups[i].age >= 0.6) {
        this.collectPickup(this.pickups[i])
        this.pickups.splice(i, 1)
      }
    }

    // Tower visual level
    if (this.level >= 15) this.towerLevel = 4
    else if (this.level >= 10) this.towerLevel = 3
    else if (this.level >= 5) this.towerLevel = 2
    else this.towerLevel = 1
  }

  updateSpawning(dt: number) {
    if (this.enemies.length >= MAX_ENEMIES) return
    const configs = getSpawnConfig(this.timeElapsed)
    for (const cfg of configs) {
      this.spawnTimers[cfg.type] = (this.spawnTimers[cfg.type] || 0) + dt
      const interval = 1 / cfg.rate
      while (this.spawnTimers[cfg.type] >= interval) {
        this.spawnTimers[cfg.type] -= interval
        this.spawnEnemy(cfg.type)
      }
    }
  }

  spawnEnemy(type: EnemyType) {
    const data = ENEMY_DATA[type]
    const hpScale = 1 + this.timeElapsed / 300
    const side = Math.floor(Math.random() * 4)
    const m = 20
    let x: number, y: number
    switch (side) {
      case 0: x = -m; y = Math.random() * this.gh; break
      case 1: x = this.gw + m; y = Math.random() * this.gh; break
      case 2: x = Math.random() * this.gw; y = -m; break
      default: x = Math.random() * this.gw; y = this.gh + m; break
    }
    this.enemies.push({
      id: this.nextId(), x, y, type,
      hp: Math.floor(data.hp * hpScale), maxHp: Math.floor(data.hp * hpScale),
      speed: data.speed, baseSpeed: data.speed,
      damage: data.damage, radius: data.radius,
      poisonTimer: 0, slowTimer: 0, kbVx: 0, kbVy: 0, flashTimer: 0,
    })
  }

  updateAttack(dt: number) {
    this.attackTimer -= dt
    if (this.attackTimer > 0) return
    // Priority: enemies touching the tower (dealing damage) first, then nearest in range
    let nearest: Enemy | null = null
    let nearDist = Infinity
    let hasTowerEnemy = false
    for (const e of this.enemies) {
      if (e.hp <= 0) continue
      const dx = e.x - this.cx, dy = e.y - this.cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const atTower = dist <= TOWER_R + e.radius + 2
      // If we already found an enemy at tower, skip non-tower enemies
      if (hasTowerEnemy && !atTower) continue
      // If this is the first tower enemy, reset search to tower-only
      if (atTower && !hasTowerEnemy) {
        hasTowerEnemy = true
        nearest = e
        nearDist = dist
        continue
      }
      if (dist < nearDist && (atTower || dist <= this.stats.range)) {
        nearest = e; nearDist = dist
      }
    }
    if (!nearest) return
    this.attackTimer = 1 / this.stats.attackSpeed
    const count = this.stats.multiShot
    const spawnX = this.cx
    const spawnY = this.cy - 20
    // Aim from the actual arrow spawn point, not tower center
    const baseAngle = Math.atan2(nearest.y - spawnY, nearest.x - spawnX)
    const spread = count > 1 ? 0.15 : 0
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i - (count - 1) / 2) * spread
      const isCrit = Math.random() * 100 < this.stats.critChance
      const dmg = isCrit ? Math.floor(this.stats.damage * this.stats.critDamage) : this.stats.damage
      this.projectiles.push({
        id: this.nextId(), x: spawnX, y: spawnY,
        vx: Math.cos(angle) * ARROW_SPEED, vy: Math.sin(angle) * ARROW_SPEED,
        damage: dmg, pierceLeft: this.stats.pierce, hitEnemies: new Set(), isCrit,
      })
    }
  }

  updateProjectiles(dt: number) {
    this.projectiles = this.projectiles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt
      if (p.x < -30 || p.x > this.gw + 30 || p.y < -30 || p.y > this.gh + 30) return false
      for (const e of this.enemies) {
        if (e.hp <= 0 || p.hitEnemies.has(e.id)) continue
        const dx = p.x - e.x, dy = p.y - e.y
        if (dx * dx + dy * dy < (e.radius + 4) * (e.radius + 4)) {
          p.hitEnemies.add(e.id)
          e.hp -= p.damage
          e.flashTimer = 0.1
          this.dmgNumbers.push({ id: this.nextId(), x: e.x, y: e.y - e.radius, value: p.damage, age: 0, isCrit: p.isCrit })
          if (this.stats.poisonChance > 0 && Math.random() * 100 < this.stats.poisonChance) e.poisonTimer = 3
          if (this.stats.slow > 0) { e.slowTimer = 2; e.speed = e.baseSpeed * (1 - this.stats.slow / 100) }
          if (this.stats.knockback > 0) {
            const d = Math.sqrt(dx * dx + dy * dy) || 1
            e.kbVx = -(dx / d) * this.stats.knockback * 3
            e.kbVy = -(dy / d) * this.stats.knockback * 3
          }
          if (p.pierceLeft <= 0) return false
          p.pierceLeft--
        }
      }
      return true
    })
  }

  onEnemyKilled(e: Enemy) {
    this.kills++
    const data = ENEMY_DATA[e.type]
    const xpVal = Math.floor(data.xp * (1 + this.stats.xpBonus / 100))
    this.pickups.push({ id: this.nextId(), x: e.x, y: e.y, type: 'xp', value: xpVal, age: 0 })
    if (Math.random() < data.goldChance + this.stats.luck / 100) {
      const gv = Math.max(1, Math.floor((1 + Math.random() * 3) * (1 + this.stats.coinBonus / 100)))
      this.pickups.push({ id: this.nextId(), x: e.x + 4, y: e.y + 4, type: 'gold', value: gv, age: 0 })
    }
  }

  updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue
      if (Math.abs(e.kbVx) > 0.5 || Math.abs(e.kbVy) > 0.5) {
        e.x += e.kbVx * dt; e.y += e.kbVy * dt
        e.kbVx *= 0.85; e.kbVy *= 0.85
      }
      const dx = this.cx - e.x, dy = this.cy - e.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > TOWER_R + e.radius) {
        const spd = e.slowTimer > 0 ? e.speed : e.baseSpeed
        e.x += (dx / dist) * spd * dt; e.y += (dy / dist) * spd * dt
      } else {
        this.hp -= e.damage * dt
        if (this.hp <= 0) { this.hp = 0; this.phase = 'defeat'; this.onGameEnd?.(false) }
      }
      if (e.slowTimer > 0) { e.slowTimer -= dt; if (e.slowTimer <= 0) e.speed = e.baseSpeed }
      if (e.flashTimer > 0) e.flashTimer -= dt
    }
  }

  updatePoison(dt: number) {
    for (const e of this.enemies) {
      if (e.poisonTimer > 0 && e.hp > 0) {
        e.poisonTimer -= dt
        e.hp -= Math.ceil(e.maxHp * 0.1 * dt)
      }
    }
  }

  tryCollect(wx: number, wy: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i]
      const dx = p.x - wx, dy = p.y - wy
      if (dx * dx + dy * dy < PICKUP_R * PICKUP_R) {
        this.collectPickup(p)
        this.pickups.splice(i, 1)
      }
    }
  }

  collectPickup(p: Pickup) {
    if (p.type === 'xp') {
      this.xp += p.value
      while (this.xp >= this.xpToNext) {
        this.xp -= this.xpToNext
        this.level++
        this.xpToNext = xpForLevel(this.level)
        this.triggerLevelUp()
      }
    } else {
      this.gold += p.value
      this.goldEarned += p.value
    }
  }

  triggerLevelUp() {
    const available = UPGRADES.filter(u => (this.upgradeLevels[u.id] || 0) < u.maxLevel)
    if (available.length === 0) return
    const shuffled = [...available].sort(() => Math.random() - 0.5)
    this.phase = 'levelup'
    this.onLevelUp?.(shuffled.slice(0, Math.min(3, shuffled.length)))
  }

  applyUpgrade(id: string) {
    const upg = UPGRADES.find(u => u.id === id)
    if (!upg) return
    const cur = this.upgradeLevels[id] || 0
    if (cur >= upg.maxLevel) return
    this.upgradeLevels[id] = cur + 1
    for (const [key, val] of Object.entries(upg.perLevel)) {
      (this.stats as unknown as Record<string, number>)[key] += val as number
    }
    if (upg.healOnBuy) this.hp = Math.min(this.hp + upg.healOnBuy, this.stats.maxHp)
    this.phase = 'playing'
  }

  setGameSpeed(s: number) { this.gameSpeed = s }
}
