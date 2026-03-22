import { io, Socket } from 'socket.io-client';
import { Renderer } from './Renderer';
import { RoomState, ClientInput } from '../shared/types';

export interface JoystickData {
  active: boolean;
  originX: number;
  originY: number;
  x: number;
  y: number;
  radius: number;
  knobRadius: number;
  touchId: number | null;
  isFixed?: boolean;
}

export interface SkillJoystickData extends JoystickData {
  skillIndex: number;
}

export class ClientEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  renderer: Renderer;
  socket: Socket;
  
  state: RoomState | null = null;
  playerId: string | null = null;

  leftJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  rightJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null, isFixed: true };
  skillJoysticks: SkillJoystickData[] = [];
  
  pendingSkills: { index: number, aimX: number, aimY: number }[] = [];
  
  animationFrameId: number = 0;
  lastTime: number = performance.now();
  
  localPlayerX?: number;
  localPlayerY?: number;
  lastDashTime: number = 0;
  
  onStateChange?: (state: 'START' | 'PLAYING' | 'GAME_OVER') => void;
  onScoreChange?: (score: number, credits: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new Renderer(this.canvas, this.ctx);
    
    // Connect to server
    this.socket = io();

    this.socket.on('connect', () => {
      this.playerId = this.socket.id || null;
      console.log('Connected as', this.playerId);
    });

    this.socket.on('roomJoined', (initialState: RoomState) => {
      this.state = initialState;
      if (this.playerId && this.state.players[this.playerId]) {
        this.localPlayerX = this.state.players[this.playerId].x;
        this.localPlayerY = this.state.players[this.playerId].y;
      }
      this.onStateChange?.('PLAYING');
    });

    this.socket.on('stateUpdate', (newState: RoomState) => {
      if (this.playerId && newState.players[this.playerId]) {
        const serverPlayer = newState.players[this.playerId];
        
        // If distance is huge (teleport/respawn/rejected prediction), sync with server
        if (this.localPlayerX === undefined || this.localPlayerY === undefined ||
            Math.hypot(this.localPlayerX - serverPlayer.x, this.localPlayerY - serverPlayer.y) > 100) {
          this.localPlayerX = serverPlayer.x;
          this.localPlayerY = serverPlayer.y;
        }
        
        // Override server state with local state for smooth rendering
        serverPlayer.x = this.localPlayerX;
        serverPlayer.y = this.localPlayerY;
      }
      
      this.state = newState;
      if (this.playerId && this.state.players[this.playerId]) {
        const p = this.state.players[this.playerId];
        this.onScoreChange?.(p.score, p.credits);
        if (p.skills) {
          if (this.skillJoysticks.length !== p.skills.length) {
            this.updateSkillJoysticks();
          }
        }
      }
    });

    this.socket.on('playerDied', () => {
      this.onStateChange?.('GAME_OVER');
    });

    this.handleResize = this.handleResize.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.loop = this.loop.bind(this);

    window.addEventListener('resize', this.handleResize);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);

    this.handleResize();
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  joinRoom(type: 'city' | 'arena' | 'battlefield') {
    this.socket.emit('joinRoom', type);
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    cancelAnimationFrame(this.animationFrameId);
    this.socket.disconnect();
  }

  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    // Update fixed right joystick position
    this.rightJoystick.originX = this.canvas.width - 120;
    this.rightJoystick.originY = this.canvas.height - 120;
    this.rightJoystick.x = this.rightJoystick.originX;
    this.rightJoystick.y = this.rightJoystick.originY;
    
    this.updateSkillJoysticks();
  }

  updateSkillJoysticks() {
    if (!this.state || !this.playerId) return;
    const player = this.state.players[this.playerId];
    if (!player || !player.skills) return;
    
    // Position relative to bottom right
    const baseX = this.canvas.width - 120;
    const baseY = this.canvas.height - 120;
    const radius = 100; // Distance from base
    const startAngle = -Math.PI / 2 - Math.PI / 8;
    const angleStep = -Math.PI / 4;
    
    this.skillJoysticks = player.skills.map((skill, i) => {
      const angle = startAngle + i * angleStep;
      const originX = baseX + Math.cos(angle) * radius;
      const originY = baseY + Math.sin(angle) * radius;
      
      const existing = this.skillJoysticks.find(sj => sj.skillIndex === i);
      
      return {
        active: existing ? existing.active : false,
        originX,
        originY,
        x: existing && existing.active ? existing.x : originX,
        y: existing && existing.active ? existing.y : originY,
        radius: 40,
        knobRadius: 15,
        touchId: existing ? existing.touchId : null,
        isFixed: true,
        skillIndex: i
      };
    });
  }

  handlePointerDown(e: PointerEvent) {
    if (!this.state) return;
    
    // Check skill joysticks first
    let hitSkill = false;
    for (const sj of this.skillJoysticks) {
      const dist = Math.hypot(e.clientX - sj.originX, e.clientY - sj.originY);
      if (dist <= sj.radius * 1.5 && !sj.active) { // Slightly larger hit area
        sj.active = true;
        sj.touchId = e.pointerId;
        sj.x = e.clientX;
        sj.y = e.clientY;
        hitSkill = true;
        break;
      }
    }
    
    if (hitSkill) return;

    // Left half = movement joystick
    if (e.clientX < this.canvas.width / 2) {
      if (!this.leftJoystick.active) {
        this.leftJoystick.active = true;
        this.leftJoystick.originX = e.clientX;
        this.leftJoystick.originY = e.clientY;
        this.leftJoystick.x = e.clientX;
        this.leftJoystick.y = e.clientY;
        this.leftJoystick.touchId = e.pointerId;
      }
    } else {
      // Right half = aiming/shooting joystick
      if (!this.rightJoystick.active) {
        this.rightJoystick.active = true;
        this.rightJoystick.originX = e.clientX;
        this.rightJoystick.originY = e.clientY;
        this.rightJoystick.x = e.clientX;
        this.rightJoystick.y = e.clientY;
        this.rightJoystick.touchId = e.pointerId;
      }
    }
  }

  handlePointerMove(e: PointerEvent) {
    for (const sj of this.skillJoysticks) {
      if (sj.active && sj.touchId === e.pointerId) {
        const dx = e.clientX - sj.originX;
        const dy = e.clientY - sj.originY;
        const dist = Math.hypot(dx, dy);
        if (dist > sj.radius) {
          sj.x = sj.originX + (dx / dist) * sj.radius;
          sj.y = sj.originY + (dy / dist) * sj.radius;
        } else {
          sj.x = e.clientX;
          sj.y = e.clientY;
        }
        return;
      }
    }

    if (this.leftJoystick.active && this.leftJoystick.touchId === e.pointerId) {
      const dx = e.clientX - this.leftJoystick.originX;
      const dy = e.clientY - this.leftJoystick.originY;
      const dist = Math.hypot(dx, dy);
      if (dist > this.leftJoystick.radius) {
        this.leftJoystick.x = this.leftJoystick.originX + (dx / dist) * this.leftJoystick.radius;
        this.leftJoystick.y = this.leftJoystick.originY + (dy / dist) * this.leftJoystick.radius;
      } else {
        this.leftJoystick.x = e.clientX;
        this.leftJoystick.y = e.clientY;
      }
    }

    if (this.rightJoystick.active && this.rightJoystick.touchId === e.pointerId) {
      const dx = e.clientX - this.rightJoystick.originX;
      const dy = e.clientY - this.rightJoystick.originY;
      const dist = Math.hypot(dx, dy);
      if (dist > this.rightJoystick.radius) {
        this.rightJoystick.x = this.rightJoystick.originX + (dx / dist) * this.rightJoystick.radius;
        this.rightJoystick.y = this.rightJoystick.originY + (dy / dist) * this.rightJoystick.radius;
      } else {
        this.rightJoystick.x = e.clientX;
        this.rightJoystick.y = e.clientY;
      }
    }
  }

  handlePointerUp(e: PointerEvent) {
    for (const sj of this.skillJoysticks) {
      if (sj.touchId === e.pointerId) {
        sj.active = false;
        sj.touchId = null;
        
        // Trigger skill on release
        const dx = sj.x - sj.originX;
        const dy = sj.y - sj.originY;
        const dist = Math.hypot(dx, dy);
        let aimX = 0, aimY = 0;
        if (dist > 5) {
          aimX = dx / dist;
          aimY = dy / dist;
        } else if (this.rightJoystick.active) {
          // Fallback to right joystick aim
          const rdx = this.rightJoystick.x - this.rightJoystick.originX;
          const rdy = this.rightJoystick.y - this.rightJoystick.originY;
          const rdist = Math.hypot(rdx, rdy);
          if (rdist > 5) {
            aimX = rdx / rdist;
            aimY = rdy / rdist;
          }
        }
        
        this.pendingSkills.push({ index: sj.skillIndex, aimX, aimY });
        
        sj.x = sj.originX;
        sj.y = sj.originY;
        return;
      }
    }

    if (this.leftJoystick.touchId === e.pointerId) {
      this.leftJoystick.active = false;
      this.leftJoystick.touchId = null;
    }
    if (this.rightJoystick.touchId === e.pointerId) {
      this.rightJoystick.active = false;
      this.rightJoystick.touchId = null;
    }
  }

  triggerSkill(index: number) {
    let aimX = 0, aimY = 0;
    if (this.rightJoystick.active) {
      const dx = this.rightJoystick.x - this.rightJoystick.originX;
      const dy = this.rightJoystick.y - this.rightJoystick.originY;
      const dist = Math.hypot(dx, dy);
      if (dist > 10) {
        aimX = dx / dist;
        aimY = dy / dist;
      }
    }
    this.pendingSkills.push({ index, aimX, aimY });
  }

  sendInput() {
    if (!this.state || !this.playerId) return;

    let moveX = 0, moveY = 0;
    if (this.leftJoystick.active) {
      const dx = this.leftJoystick.x - this.leftJoystick.originX;
      const dy = this.leftJoystick.y - this.leftJoystick.originY;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        moveX = dx / this.leftJoystick.radius;
        moveY = dy / this.leftJoystick.radius;
      }
    }

    let aimX = 0, aimY = 0;
    let shooting = false;
    if (this.rightJoystick.active) {
      const dx = this.rightJoystick.x - this.rightJoystick.originX;
      const dy = this.rightJoystick.y - this.rightJoystick.originY;
      const dist = Math.hypot(dx, dy);
      if (dist > 10) {
        aimX = dx / dist;
        aimY = dy / dist;
        shooting = true;
      }
    }

    // Predict dash
    if (this.localPlayerX !== undefined && this.localPlayerY !== undefined) {
      for (const skill of this.pendingSkills) {
        const skillState = this.state.players[this.playerId].skills[skill.index];
        if (skillState && skillState.name === 'Dash') {
          const now = Date.now();
          if (now - this.lastDashTime >= skillState.cooldown) {
            this.lastDashTime = now;
            const dashDistance = 150;
            let dx = skill.aimX;
            let dy = skill.aimY;
            if (dx === 0 && dy === 0) {
              if (moveX !== 0 || moveY !== 0) {
                const len = Math.hypot(moveX, moveY);
                dx = moveX / len;
                dy = moveY / len;
              } else {
                dx = 1;
                dy = 0;
              }
            }
            this.localPlayerX += dx * dashDistance;
            this.localPlayerY += dy * dashDistance;
            
            // Constrain to map
            const playerRadius = this.state.players[this.playerId].radius;
            this.localPlayerX = Math.max(playerRadius, Math.min(this.state.width - playerRadius, this.localPlayerX));
            this.localPlayerY = Math.max(playerRadius, Math.min(this.state.height - playerRadius, this.localPlayerY));
          }
        }
      }
    }

    const input: ClientInput = {
      moveX,
      moveY,
      aimX,
      aimY,
      shooting,
      skills: [...this.pendingSkills],
      x: this.localPlayerX,
      y: this.localPlayerY
    };

    this.pendingSkills = [];
    this.socket.emit('input', input);
  }

  loop(time: number) {
    let dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    
    // Clamp dt to prevent huge jumps if tab was inactive
    if (dt > 0.1) dt = 0.1;

    // Client-side prediction
    if (this.state && this.playerId && this.state.players[this.playerId]) {
      let moveX = 0, moveY = 0;
      if (this.leftJoystick.active) {
        const dx = this.leftJoystick.x - this.leftJoystick.originX;
        const dy = this.leftJoystick.y - this.leftJoystick.originY;
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
          moveX = dx / this.leftJoystick.radius;
          moveY = dy / this.leftJoystick.radius;
        }
      }

      if (this.localPlayerX !== undefined && this.localPlayerY !== undefined) {
        const speed = 300; // Match server speed
        this.localPlayerX += moveX * speed * dt;
        this.localPlayerY += moveY * speed * dt;
        
        // Constrain to map locally
        const playerRadius = this.state.players[this.playerId].radius;
        this.localPlayerX = Math.max(playerRadius, Math.min(this.state.width - playerRadius, this.localPlayerX));
        this.localPlayerY = Math.max(playerRadius, Math.min(this.state.height - playerRadius, this.localPlayerY));
        
        // Update state for renderer
        this.state.players[this.playerId].x = this.localPlayerX;
        this.state.players[this.playerId].y = this.localPlayerY;
      }

      // Smooth other entities using their velocity
      for (const id in this.state.players) {
        if (id !== this.playerId) {
          const p = this.state.players[id];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
      }
      for (const id in this.state.enemies) {
        const e = this.state.enemies[id];
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
      for (const id in this.state.projectiles) {
        const p = this.state.projectiles[id];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    this.sendInput();
    this.renderer.draw(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }
}
