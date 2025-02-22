# bolt.diy Google Cloud

## Prerequisites

- [Node.js](https://nodejs.org)
- [gcloud CLI](https://cloud.google.com/sdk/docs/install)

## Setup

Create OAuth2 credentials following the [OAuth2 Proxy Google Provider documentation](https://oauth2-proxy.github.io/oauth2-proxy/configuration/providers/google)

## Run Locally

Add the following URLs to the OAuth2 Client settings in Google Cloud Console:
- Authorized JavaScript origins:
  - `http://localhost:4200`
- Authorized redirect URIs:
  - `http://localhost:4200/oauth2/callback`

Copy the `.env.local.sample` file to `.env.local` and set the environment variables.

```bash
cp .env.local.sample .env.local
```

Run the following command to start the Docker containers.

```bash
docker compose up
```

## Deploy

Copy the `.env.sample` file to `.env` and set the environment variables.

```bash
cp .env.sample .env
```

Run the following command to authenticate with Google Cloud.

```bash
gcloud auth application-default login
```

Run the following command to deploy the infrastructure except for Cloud Run.
Make note of the service-url that is output.

```bash
npm run deploy
```

Add the following URLs to the OAuth2 Client settings in Google Cloud Console:
- Authorized JavaScript origins:
  - `{service-url}`
- Authorized redirect URIs:
  - `{service-url}/oauth2/callback`

Set the secrets in the Secret Manager.

- `oauth2-client-id`
- `oauth2-client-secret`
- `oauth2-proxy-cookie-secret`

Push the Docker image to the Artifact Registry.

```bash
npm run push-image
```

Set `NO_CLOUD_RUN` to `false` in the `.env` file and run the following command to deploy Cloud Run.

```bash
npm run deploy
```
