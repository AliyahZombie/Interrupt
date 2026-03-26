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
