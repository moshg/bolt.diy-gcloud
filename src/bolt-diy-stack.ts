import {
	artifactRegistryRepository,
	cloudRunV2Service,
	cloudRunV2ServiceIamMember,
	dataGoogleProject,
	provider,
	secretManagerSecret,
	secretManagerSecretIamMember,
	serviceAccount,
} from "@cdktf/provider-google";
import { TerraformOutput, TerraformStack } from "cdktf";
import type { Construct } from "constructs";

interface BoltDiyStackProps {
	/**
	 * The name of the application.
	 *
	 * Used as the repository name and the service name.
	 */
	name: string;
	project: string;
	region: string;
	boltDiyImageTag: string;
	oauth2ProxyImageTag: string;
	noCloudRun: boolean;
}

export class BoltDiyStack extends TerraformStack {
	constructor(scope: Construct, id: string, props: BoltDiyStackProps) {
		super(scope, id);

		new provider.GoogleProvider(this, "google", {
			project: props.project,
			region: props.region,
		});

		// Artifact Registry
		const boltDiyRepository = new artifactRegistryRepository.ArtifactRegistryRepository(
			this,
			"bolt-diy-repository",
			{
				repositoryId: "bolt-diy",
				description: "bolt.diy repository",
				format: "docker",
				mode: "REMOTE_REPOSITORY",
				remoteRepositoryConfig: {
					description: "GitHub Container Registry",
					commonRepository: {
						uri: "https://ghcr.io",
					}
				},
				vulnerabilityScanningConfig: {
					enablementConfig: "DISABLED"
				}
			},
		);

		const oauth2ProxyRepository = new artifactRegistryRepository.ArtifactRegistryRepository(
			this,
			"oauth2-proxy-repository",
			{
				repositoryId: "oauth2-proxy",
				format: "docker",
				mode: "REMOTE_REPOSITORY",
				remoteRepositoryConfig: {
					description: "Red Hat Quay",
					commonRepository: {
						uri: "https://quay.io",
					},
				},
				vulnerabilityScanningConfig: {
					enablementConfig: "DISABLED"
				}
			},
		);

		// Secret Manager
		const clientIdSecret = new secretManagerSecret.SecretManagerSecret(
			this,
			"oauth2-client-id",
			{
				secretId: "oauth2-client-id",
				replication: {
					auto: {},
				},
			},
		);

		const clientSecretSecret = new secretManagerSecret.SecretManagerSecret(
			this,
			"oauth2-client-secret",
			{
				secretId: "oauth2-client-secret",
				replication: {
					auto: {},
				},
			},
		);

		const cookieSecretSecret = new secretManagerSecret.SecretManagerSecret(
			this,
			"oauth2-proxy-cookie-secret",
			{
				secretId: "oauth2-proxy-cookie-secret",
				replication: {
					auto: {},
				},
			},
		);

		const secrets = {
			"oauth2-client-id": clientIdSecret,
			"oauth2-client-secret": clientSecretSecret,
			"oauth2-proxy-cookie-secret": cookieSecretSecret,
		};

		// Service Account
		const cloudRunServiceAccount = new serviceAccount.ServiceAccount(
			this,
			"cloud-run-service-account",
			{
				accountId: "bolt-diy",
				displayName: "Bolt Diy Service Account",
			},
		);

		// Secret Manager IAM
		for (const [id, secret] of Object.entries(secrets)) {
			new secretManagerSecretIamMember.SecretManagerSecretIamMember(
				this,
				`secret-accessor-${id}`,
				{
					secretId: secret.secretId,
					role: "roles/secretmanager.secretAccessor",
					member: `serviceAccount:${cloudRunServiceAccount.email}`,
				},
			);
		}

		// Get project information
		const project = new dataGoogleProject.DataGoogleProject(this, "project", {
			projectId: props.project,
		});

		// Output Cloud Run Service URL
		const serviceUrl = `https://${props.name}-${project.number}.${props.region}.run.app`;
		new TerraformOutput(this, "service-url", {
			value: serviceUrl,
			description: "The URL of the service",
		});

		// Cloud Run
		if (!props.noCloudRun) {
			const service = new cloudRunV2Service.CloudRunV2Service(this, "service", {
				location: props.region,
				name: props.name,
				ingress: "INGRESS_TRAFFIC_ALL", // Allow access from the internet
				client: "cloud-console", // Set default value to minimize diff
				template: {
					serviceAccount: cloudRunServiceAccount.email,
					scaling: {
						minInstanceCount: 0,
						maxInstanceCount: 2,
					},
					containers: [
						{
							name: "oauth2-proxy-container",
							image: `${props.region}-docker.pkg.dev/${props.project}/${oauth2ProxyRepository.repositoryId}/oauth2-proxy/oauth2-proxy:${props.oauth2ProxyImageTag}`,
							ports: {
								containerPort: 4180,
							},
							resources: {
								limits: {
									cpu: "1000m",
									memory: "512Mi",
								},
							},
							env: [
								{
									name: "OAUTH2_PROXY_HTTP_ADDRESS",
									value: "http://0.0.0.0:4180",
								},
								{
									name: "OAUTH2_PROXY_UPSTREAMS",
									value: "http://localhost:5173",
								},
								{
									name: "OAUTH2_PROXY_PROVIDER",
									value: "google",
								},
								{
									name: "OAUTH2_PROXY_EMAIL_DOMAINS",
									value: "*",
								},
								{
									name: "OAUTH2_PROXY_COOKIE_REFRESH",
									value: "1h",
								},
								{
									name: "OAUTH2_PROXY_COOKIE_SECURE",
									value: "true",
								},
								{
									name: "OAUTH2_PROXY_REDIRECT_URL",
									value: `${serviceUrl}/oauth2/callback`,
								},
								{
									name: "OAUTH2_PROXY_CLIENT_ID",
									valueSource: {
										secretKeyRef: {
											secret: clientIdSecret.id,
											version: "latest",
										},
									},
								},
								{
									name: "OAUTH2_PROXY_CLIENT_SECRET",
									valueSource: {
										secretKeyRef: {
											secret: clientSecretSecret.id,
											version: "latest",
										},
									},
								},
								{
									name: "OAUTH2_PROXY_COOKIE_SECRET",
									valueSource: {
										secretKeyRef: {
											secret: cookieSecretSecret.id,
											version: "latest",
										},
									},
								},
							],
						},
						{
							name: "bolt-diy-container",
							image: `${props.region}-docker.pkg.dev/${props.project}/${boltDiyRepository.repositoryId}/stackblitz-labs/bolt.diy:${props.boltDiyImageTag}`,
							resources: {
								limits: {
									cpu: "1000m",
									memory: "1Gi",
								},
							},
							env: [
								{
									name: "NODE_ENV",
									value: "production",
								},
								{
									name: "PORT",
									value: "5173",
								},
								{
									name: "RUNNING_IN_DOCKER",
									value: "true",
								},
							],
						},
					],
				},
			});

			// IAM policy for unauthenticated access
			new cloudRunV2ServiceIamMember.CloudRunV2ServiceIamMember(
				this,
				"allow-unauthenticated-invocations",
				{
					name: service.name,
					role: "roles/run.invoker",
					member: "allUsers",
				},
			);
		}
	}
}
