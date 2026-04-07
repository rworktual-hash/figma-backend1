export class GameEngine {
  constructor(canvas, onGameOver) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onGameOver = onGameOver;
    
    this.width = canvas.width;
    this.height = canvas.height;
    
    this.isRunning = false;
    this.score = 0;
    this.frameId = null;
    
    this.keys = {};
    this.gravity = 0.6;
    
    this.player = {
      x: 50,
      y: 200,
      width: 30,
      height: 40,
      vx: 0,
      vy: 0,
      speed: 5,
      jumpPower: -12,
      isGrounded: false,
      facingRight: true,
      cooldown: 0
    };
    
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.enemySpawnTimer = 0;
    
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.loop = this.loop.bind(this);
  }

  start() {
    this.isRunning = true;
    this.score = 0;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.frameId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.isRunning = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    if (this.frameId) cancelAnimationFrame(this.frameId);
  }

  handleKeyDown(e) { this.keys[e.code] = true; }
  handleKeyUp(e) { this.keys[e.code] = false; }

  spawnEnemy() {
    const isRight = Math.random() > 0.5;
    this.enemies.push({
      x: isRight ? this.width + 30 : -30,
      y: this.height - 60,
      width: 30,
      height: 40,
      vx: (isRight ? -2 : 2) * (1 + Math.random() * 2 + (this.score / 1000)),
      hp: 1
    });
  }

  update() {
    if (!this.isRunning) return;

    // Player Movement
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
      this.player.vx = -this.player.speed;
      this.player.facingRight = false;
    } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
      this.player.vx = this.player.speed;
      this.player.facingRight = true;
    } else {
      this.player.vx = 0;
    }

    // Jumping
    if ((this.keys['ArrowUp'] || this.keys['KeyW'] || this.keys['Space']) && this.player.isGrounded) {
      this.player.vy = this.player.jumpPower;
      this.player.isGrounded = false;
    }

    // Shooting
    if (this.player.cooldown > 0) this.player.cooldown--;
    if (this.keys['Enter'] || this.keys['KeyF']) {
      if (this.player.cooldown === 0) {
        this.bullets.push({
          x: this.player.facingRight ? this.player.x + this.player.width : this.player.x,
          y: this.player.y + 15,
          vx: this.player.facingRight ? 15 : -15,
          width: 10,
          height: 4
        });
        this.player.cooldown = 15;
      }
    }

    // Physics
    this.player.vy += this.gravity;
    this.player.x += this.player.vx;
    this.player.y += this.player.vy;

    // Floor Collision
    const floorY = this.height - 20;
    if (this.player.y + this.player.height > floorY) {
      this.player.y = floorY - this.player.height;
      this.player.vy = 0;
      this.player.isGrounded = true;
    }

    // Screen Bounds
    if (this.player.x < 0) this.player.x = 0;
    if (this.player.x + this.player.width > this.width) this.player.x = this.width - this.player.width;

    // Bullets update
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      let b = this.bullets[i];
      b.x += b.vx;
      if (b.x < 0 || b.x > this.width) this.bullets.splice(i, 1);
    }

    // Enemy spawn logic
    this.enemySpawnTimer++;
    if (this.enemySpawnTimer > Math.max(30, 100 - this.score / 10)) {
      this.spawnEnemy();
      this.enemySpawnTimer = 0;
    }

    // Enemy update & collisions
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      let e = this.enemies[i];
      e.x += e.vx;
      
      // Bullet hits enemy
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        let b = this.bullets[j];
        if (b.x < e.x + e.width && b.x + b.width > e.x &&
            b.y < e.y + e.height && b.y + b.height > e.y) {
          this.enemies.splice(i, 1);
          this.bullets.splice(j, 1);
          this.score += 10;
          this.createExplosion(e.x + 15, e.y + 20, '#ff4444');
          break;
        }
      }

      // Enemy hits player (Game Over)
      if (this.enemies[i]) { // check if still exists after bullet check
        if (this.player.x < e.x + e.width && this.player.x + this.player.width > e.x &&
            this.player.y < e.y + e.height && this.player.y + this.player.height > e.y) {
          this.stop();
          if(this.onGameOver) this.onGameOver(this.score);
          return;
        }
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  createExplosion(x, y, color) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 20 + Math.random() * 20,
        color
      });
    }
  }

  draw() {
    // Background
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Floor
    this.ctx.fillStyle = '#16213e';
    this.ctx.fillRect(0, this.height - 20, this.width, 20);

    // Draw Score
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px Arial';
    this.ctx.fillText(`Score: ${this.score}`, 20, 40);

    // Draw Particles
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life / 40;
      this.ctx.fillRect(p.x, p.y, 4, 4);
    });
    this.ctx.globalAlpha = 1.0;

    // Draw Player (Killer Bean)
    this.ctx.fillStyle = '#e94560'; // Dark Red
    this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
    // Glasses/Visor
    this.ctx.fillStyle = '#0f3460';
    if (this.player.facingRight) {
      this.ctx.fillRect(this.player.x + 15, this.player.y + 10, 15, 8);
    } else {
      this.ctx.fillRect(this.player.x, this.player.y + 10, 15, 8);
    }

    // Draw Enemies
    this.ctx.fillStyle = '#4caf50';
    this.enemies.forEach(e => {
      this.ctx.fillRect(e.x, e.y, e.width, e.height);
      // Enemy Eyes
      this.ctx.fillStyle = '#000';
      if (e.vx < 0) {
        this.ctx.fillRect(e.x + 5, e.y + 10, 8, 8);
      } else {
        this.ctx.fillRect(e.x + 17, e.y + 10, 8, 8);
      }
      this.ctx.fillStyle = '#4caf50';
    });

    // Draw Bullets
    this.ctx.fillStyle = '#ffd700';
    this.bullets.forEach(b => {
      this.ctx.fillRect(b.x, b.y, b.width, b.height);
    });
  }

  loop() {
    this.update();
    this.draw();
    if (this.isRunning) {
      this.frameId = requestAnimationFrame(this.loop);
    }
  }
}