import { z } from "zod";

export const envSchema = z.object({
	PROJECT_ID: z.string(),
	REGION: z.string(),
	NO_CLOUD_RUN: z.string().transform((v) => v === "true"),
});
