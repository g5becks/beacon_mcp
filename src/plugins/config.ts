import { loadConfig } from "../config/loader.js";
import type { ApplicationContext, AppPlugin } from "../types/app-context.js";
import type { CliConfig } from "../types/cli.js";
import { PluginInitError } from "../types/errors.js";

export const configPlugin: AppPlugin<CliConfig> = async (
  app: ApplicationContext,
  cliConfig: CliConfig = {}
): Promise<void> => {
  try {
    const resolvedConfig = await loadConfig(cliConfig);
    app.config = resolvedConfig;

    process.stderr.write(
      `${JSON.stringify({
        scope: "config",
        event: "loaded",
        project: resolvedConfig.projectName,
        environment: resolvedConfig.environment,
        logLevel: resolvedConfig.logLevel,
      })}\n`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    process.stderr.write(
      `${JSON.stringify({ scope: "config", event: "error", message })}\n`
    );
    if (error instanceof Error && error.stack) {
      process.stderr.write(`${error.stack}\n`);
    }

    throw new PluginInitError("Configuration", message, error);
  }
};
