export interface AppConfig {
  maxPixelRatio: number;
}

export const defaultConfig: Readonly<AppConfig> = Object.freeze({ maxPixelRatio: 1.5 });

export function validateConfig(config: AppConfig): void {
  if (!Number.isFinite(config.maxPixelRatio) || config.maxPixelRatio < 1 || config.maxPixelRatio > 2) {
    throw new Error('Le ratio de pixels maximal doit être compris entre 1 et 2.');
  }
}

export function effectivePixelRatio(ratio: number, max: number): number {
  return Math.min(Math.max(Number.isFinite(ratio) ? ratio : 1, 1), max);
}
