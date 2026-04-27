#!/bin/bash
IMAGE_NAME="melvinvmegen/mvm_monitoring"
VERSION=$(git tag --points-at HEAD)
if [ "$VERSION" == "" ];
then 
	GIT_BRANCH=$(git branch | grep \* | cut -d ' ' -f2)
	VERSION="latest-$GIT_BRANCH"
fi

echo "Building docker image $IMAGE_NAME:$VERSION"
if ! type docker > /dev/null;
then 
	echo "Docker not found. Please install docker to build docker image"
	exit -1
fi

if [[ -z "$DOCKER_USERNAME" ]] || [[ -z "$DOCKER_PASSWORD" ]];
then
	echo "Docker idents not found. Please DOCKER_USERNAME and DOCKER_USERNAME environment variables to be able to push"
	exit -1
fi
echo "Logging to docker hub ..."
docker login -u "$DOCKER_USERNAME" -p "$DOCKER_PASSWORD"

echo "Building docker image ..."
docker build -f Dockerfile -t "$IMAGE_NAME:$VERSION" .

echo "Pushing docker image ..."
docker push "$IMAGE_NAME:$VERSION"