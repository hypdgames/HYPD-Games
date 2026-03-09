import { GameEngine, Enemy, Projectile, Pickup, DamageNumber } from './engine'

let bgCanvas: HTMLCanvasElement | null = null
let bgKey = ''

function generateBackground(gw: number, gh: number, cx: number, cy: number) {
  const key = `${gw}x${gh}`
  if (bgCanvas && bgKey === key) return
  bgKey = key
  const c = document.createElement('canvas')
  c.width = gw; c.height = gh
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#3a7d44'
  ctx.fillRect(0, 0, gw, gh)
  const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 } }
  const rand = rng(42)
  const density = Math.floor((gw * gh) / 750)
  for (let i = 0; i < density; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#348a3e' : '#429b4c'
    ctx.fillRect(Math.floor(rand() * gw), Math.floor(rand() * gh), 2 + rand() * 4, 2 + rand() * 4)
  }
  ctx.fillStyle = '#4a9a54'
  ctx.beginPath(); ctx.arc(cx, cy, 55, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#3e8e48'
  ctx.beginPath(); ctx.arc(cx, cy, 35, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#8a7a5a'
  ctx.fillRect(cx - 4, cy + 30, 8, gh)
  ctx.fillStyle = '#9a8a6a'
  ctx.fillRect(cx - 3, cy + 30, 6, gh)
  for (let i = 0; i < 40; i++) {
    let x: number, y: number
    if (rand() > 0.5) {
      x = rand() > 0.5 ? rand() * 50 : gw - rand() * 50
      y = rand() * gh
    } else {
      x = rand() * gw
      y = rand() > 0.5 ? rand() * 50 : gh - rand() * 50
    }
    drawTree(ctx, x, y, 8 + rand() * 12)
  }
  for (let i = 0; i < 20; i++) {
    const x = rand() * gw, y = rand() * gh
    if (Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) < 65) continue
    ctx.fillStyle = '#667'
    ctx.fillRect(Math.floor(x), Math.floor(y), 3 + rand() * 5, 3 + rand() * 4)
    ctx.fillStyle = '#889'
    ctx.fillRect(Math.floor(x) + 1, Math.floor(y), 2, 1)
  }
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = ['#ee4', '#e4e', '#4ae', '#fa4'][Math.floor(rand() * 4)]
    ctx.fillRect(Math.floor(rand() * gw), Math.floor(rand() * gh), 2, 2)
  }
  bgCanvas = c
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = '#5a3a2a'
  ctx.fillRect(Math.floor(x - 2), Math.floor(y), 4, 6)
  const s = Math.floor(size)
  ctx.fillStyle = '#2a6a34'
  for (let r = 0; r < s; r++) {
    const w = Math.floor((s - r) * 0.7)
    ctx.fillRect(Math.floor(x - w / 2), Math.floor(y - r - 2), w, 1)
  }
  ctx.fillStyle = '#1a5a24'
  for (let r = 0; r < s * 0.5; r++) {
    const w = Math.floor((s * 0.5 - r) * 0.7)
    ctx.fillRect(Math.floor(x - w / 2), Math.floor(y - r - 2 - s * 0.5), w, 1)
  }
}

export function render(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const { gw, gh, cx, cy } = engine
  generateBackground(gw, gh, cx, cy)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(bgCanvas!, 0, 0)

  // Range circle
  ctx.strokeStyle = 'rgba(200,255,200,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(cx, cy, engine.stats.range, 0, Math.PI * 2); ctx.stroke()

  for (const p of engine.pickups) drawPickup(ctx, p)
  for (const e of engine.enemies) { if (e.hp > 0) drawEnemy(ctx, e) }
  for (const p of engine.projectiles) drawProjectile(ctx, p)
  drawTower(ctx, engine.towerLevel, cx, cy)
  for (const d of engine.dmgNumbers) drawDmgNum(ctx, d)
}

function drawPickup(ctx: CanvasRenderingContext2D, p: Pickup) {
  const x = Math.floor(p.x), y = Math.floor(p.y)
  const pulse = 1 + Math.sin(p.age * 5) * 0.15
  if (p.type === 'xp') {
    ctx.fillStyle = '#5f5'
    ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse)
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(3, 0); ctx.lineTo(0, 4); ctx.lineTo(-3, 0); ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#bfb'
    ctx.fillRect(-1, -2, 2, 1)
    ctx.restore()
  } else {
    ctx.fillStyle = '#ea0'
    ctx.beginPath(); ctx.arc(x, y, 3 * pulse, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fc4'
    ctx.fillRect(x - 1, y - 1, 1, 1)
  }
}

const ENEMY_COLORS: Record<string, string> = {
  goblin: '#4a7', skeleton: '#ccc', orc: '#684', bat: '#a5a', demon: '#c33',
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  const x = Math.floor(e.x), y = Math.floor(e.y), r = e.radius
  const color = e.flashTimer > 0 ? '#fff' : (ENEMY_COLORS[e.type] || '#888')
  ctx.fillStyle = color
  if (e.type === 'bat') {
    ctx.fillRect(x - r - 3, y - 2, 3, 4)
    ctx.fillRect(x + r, y - 2, 3, 4)
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === 'demon') {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#a22'
    ctx.fillRect(x - r + 1, y - r - 3, 2, 4)
    ctx.fillRect(x + r - 3, y - r - 3, 2, 4)
  } else if (e.type === 'orc') {
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  } else {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = e.type === 'demon' ? '#ff0' : '#fff'
  ctx.fillRect(x - Math.floor(r / 2) - 1, y - 2, 2, 2)
  ctx.fillRect(x + Math.floor(r / 2) - 1, y - 2, 2, 2)
  ctx.fillStyle = '#000'
  ctx.fillRect(x - Math.floor(r / 2), y - 1, 1, 1)
  ctx.fillRect(x + Math.floor(r / 2) - 1, y - 1, 1, 1)
  if (e.hp < e.maxHp) {
    const bw = Math.max(r * 2, 10)
    ctx.fillStyle = '#400'
    ctx.fillRect(x - bw / 2, y - r - 5, bw, 2)
    ctx.fillStyle = '#4e4'
    ctx.fillRect(x - bw / 2, y - r - 5, bw * Math.max(0, e.hp / e.maxHp), 2)
  }
  if (e.poisonTimer > 0) { ctx.fillStyle = '#8e4'; ctx.fillRect(x - 1, y + r + 2, 2, 2) }
  if (e.slowTimer > 0) { ctx.fillStyle = '#4ae'; ctx.fillRect(x + 2, y + r + 2, 2, 2) }
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile) {
  ctx.save()
  ctx.translate(Math.floor(p.x), Math.floor(p.y))
  ctx.rotate(Math.atan2(p.vy, p.vx))
  ctx.fillStyle = p.isCrit ? '#ff0' : '#a86'
  ctx.fillRect(-4, -1, 8, 2)
  ctx.fillStyle = '#eee'
  ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(7, 0); ctx.lineTo(4, 2); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#844'
  ctx.fillRect(-5, -2, 2, 1); ctx.fillRect(-5, 1, 2, 1)
  ctx.restore()
}

function drawTower(ctx: CanvasRenderingContext2D, level: number, cx: number, cy: number) {
  const x = cx, y = cy
  const baseH = 8 + level * 5
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath(); ctx.ellipse(x, y + 8, 18, 6, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#778'
  ctx.fillRect(x - 14, y - baseH, 28, baseH + 8)
  ctx.fillStyle = '#889'
  for (let r = 0; r < baseH; r += 6) ctx.fillRect(x - 13, y - baseH + r, 26, 1)
  ctx.fillStyle = '#667'
  for (let i = 0; i < 6; i++) ctx.fillRect(x - 14 + i * 5, y - baseH - 4, 3, 4)
  ctx.fillStyle = '#a86'
  ctx.fillRect(x - 16, y - baseH - 1, 32, 3)
  ctx.fillStyle = '#2a6'
  ctx.fillRect(x - 3, y - baseH - 10, 6, 8)
  ctx.fillStyle = '#da8'
  ctx.fillRect(x - 2, y - baseH - 14, 4, 4)
  ctx.fillStyle = '#196'
  ctx.fillRect(x - 3, y - baseH - 15, 6, 3)
  ctx.fillStyle = '#a64'
  ctx.fillRect(x + 4, y - baseH - 13, 1, 8)
  ctx.strokeStyle = '#a64'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + 4, y - baseH - 13)
  ctx.quadraticCurveTo(x + 8, y - baseH - 9, x + 4, y - baseH - 5)
  ctx.stroke()
}

function drawDmgNum(ctx: CanvasRenderingContext2D, d: DamageNumber) {
  ctx.globalAlpha = Math.max(0, 1 - d.age / 0.8)
  ctx.fillStyle = d.isCrit ? '#ff0' : '#fff'
  ctx.font = d.isCrit ? 'bold 9px monospace' : '7px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(String(d.value), Math.floor(d.x), Math.floor(d.y))
  ctx.globalAlpha = 1
}
