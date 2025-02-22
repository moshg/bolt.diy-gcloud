#!/bin/bash

# Exit on error
set -e

# Google Cloud Project settings
PROJECT_ID=$PROJECT_ID
REGION=$REGION
REPOSITORY="bolt-diy"
# Image tags
BOLT_DIY_TAG="6a8449e"
PROXY_TAG="v7.8.1"

# Set variables
SOURCE_IMAGE_BOLT="ghcr.io/stackblitz-labs/bolt.diy:${BOLT_DIY_TAG}"
SOURCE_IMAGE_PROXY="quay.io/oauth2-proxy/oauth2-proxy:${PROXY_TAG}"
AR_HOSTNAME="${REGION}-docker.pkg.dev"
TARGET_IMAGE_BOLT="${AR_HOSTNAME}/${PROJECT_ID}/${REPOSITORY}/bolt-diy:${BOLT_DIY_TAG}"
TARGET_IMAGE_PROXY="${AR_HOSTNAME}/${PROJECT_ID}/${REPOSITORY}/oauth2-proxy:${PROXY_TAG}"

# Configure Docker authentication
echo "Configuring authentication for Artifact Registry..."
gcloud auth configure-docker ${AR_HOSTNAME}

# Pull images
echo "Pulling source images..."
docker pull ${SOURCE_IMAGE_BOLT}
docker pull ${SOURCE_IMAGE_PROXY}

# Tag images
echo "Tagging images..."
docker tag ${SOURCE_IMAGE_BOLT} ${TARGET_IMAGE_BOLT}
docker tag ${SOURCE_IMAGE_PROXY} ${TARGET_IMAGE_PROXY}

# Push images
echo "Pushing images to Artifact Registry..."
docker push ${TARGET_IMAGE_BOLT}
docker push ${TARGET_IMAGE_PROXY}

echo "Done!"
