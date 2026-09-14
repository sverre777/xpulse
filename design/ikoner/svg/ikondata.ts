import standard from './ikoner.json';
import mini from './ikoner-14px.json';

export type IconName = keyof typeof standard;
export type IconVariant = 'strek' | 'fyll';
export type OpticalSize = 'auto' | 'standard' | 'mini';
type Paths = string | string[];
type Pair = Record<IconVariant, Paths>;

export function getIconPaths(
  name: IconName,
  variant: IconVariant = 'strek',
  size = 18,
  opticalSize: OpticalSize = 'auto',
): string[] {
  if (!Object.prototype.hasOwnProperty.call(standard, name)) {
    throw new Error(`Ukjent X-Pulse-ikon: ${name}`);
  }
  const small = opticalSize === 'mini' || (opticalSize === 'auto' && size <= 14);
  const pair = (small ? (mini as Partial<Record<IconName, Pair>>)[name] : undefined)
    ?? (standard as Record<IconName, Pair>)[name];
  const paths = pair[variant];
  return typeof paths === 'string' ? [paths] : paths;
}
