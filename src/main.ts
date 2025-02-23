import { App } from "cdktf";
import { BoltDiyStack } from "./bolt-diy-stack";
import { envSchema } from "./env";

const env = envSchema.parse(process.env);

const app = new App();

new BoltDiyStack(app, "bolt-diy", {
	name: "bolt-diy",
	project: env.PROJECT_ID,
	region: env.REGION,
	boltDiyImageTag: "6a8449e",
	oauth2ProxyImageTag: "v7.8.1",
	noCloudRun: env.NO_CLOUD_RUN,
});

app.synth();
