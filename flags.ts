import { statsigAdapter, type StatsigUser } from "@flags-sdk/statsig";
import { dedupe, flag } from "flags/next";
import type { Identify } from "flags";

/**
 * Uses the existing anonymous browser cookie when available. Until the app has
 * accounts, the fallback keeps evaluations deterministic for local development.
 */
export const identify = dedupe((async ({ cookies }) => ({
  userID: cookies.get("meter-down-user-id")?.value ?? "meter-down-anonymous",
})) satisfies Identify<StatsigUser>);

/**
 * Create this gate in Statsig as `meter_down_player_experiment`.
 * It is disabled safely when Statsig is not configured or the gate is missing.
 */
export const meterDownPlayerExperiment = flag<boolean, StatsigUser>({
  key: "meter_down_player_experiment",
  defaultValue: false,
  description: "Controls the experimental Meter Down player experience.",
  adapter: statsigAdapter.featureGate((gate) => gate.value, { exposureLogging: true }),
  identify,
});
