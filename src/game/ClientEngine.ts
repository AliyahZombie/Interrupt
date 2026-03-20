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
}

export class ClientEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  renderer: Renderer;
  socket: Socket;
  
  state: RoomState | null = null;
  playerId: string | null = null;

  leftJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  rightJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  
  animationFrameId: number = 0;
  
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
      this.onStateChange?.('PLAYING');
    });

    this.socket.on('stateUpdate', (newState: RoomState) => {
      this.state = newState;
      if (this.playerId && this.state.players[this.playerId]) {
        const p = this.state.players[this.playerId];
        this.onScoreChange?.(p.score, p.credits);
      }
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
  }

  handlePointerDown(e: PointerEvent) {
    if (!this.state) return;
    
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
    if (this.leftJoystick.touchId === e.pointerId) {
      this.leftJoystick.active = false;
      this.leftJoystick.touchId = null;
    }
    if (this.rightJoystick.touchId === e.pointerId) {
      this.rightJoystick.active = false;
      this.rightJoystick.touchId = null;
    }
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

    const input: ClientInput = {
      moveX,
      moveY,
      aimX,
      aimY,
      shooting,
      skills: []
    };

    this.socket.emit('input', input);
  }

  loop() {
    this.sendInput();
    this.renderer.draw(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }
}
