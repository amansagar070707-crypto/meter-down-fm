import { RadioExperience } from "@/components/radio-experience";
import { meterDownPlayerExperiment } from "@/flags";

export default async function Home() {
  const statsigConfigured = Boolean(process.env.STATSIG_SERVER_API_KEY && process.env.FLAGS_SECRET);
  const playerExperimentEnabled = statsigConfigured ? await meterDownPlayerExperiment() : false;

  return <RadioExperience playerExperimentEnabled={playerExperimentEnabled} />;
}
