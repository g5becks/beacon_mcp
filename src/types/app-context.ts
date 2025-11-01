import type { ResolvedConfig } from "./config.js";
import type { Logger } from "./logger.js";

/**
 * Application context progressively extended by Avvio plugins.
 */
export type ApplicationContext = {
  name: string;
  version: string;
  isReady: boolean;
  config?: ResolvedConfig;
  logger?: Logger;
};

/**
 * Avvio plugin signature with optional options.
 */
export type AppPlugin<TOptions = void> = (
  app: ApplicationContext,
  options?: TOptions
) => Promise<void> | void;
