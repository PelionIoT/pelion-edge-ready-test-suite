#!/bin/bash
# ----------------------------------------------------------------------------
# Copyright (c) 2020-2021, Pelion and affiliates.
#
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ----------------------------------------------------------------------------

# Stop on errors
set -e

if [ $# -ne 2 ];
then
    echo "ERROR - incorrect number of arguments. Usage:"
    echo " ./install_kubectl.sh <api_url> <api_key>"
    exit 2
fi

# Install kubectl
curl -LO "https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/arm/kubectl"
chmod +x ./kubectl
sudo mv ./kubectl /usr/local/bin/kubectl
kubectl version --client

# Setup kube config
if [ -d "$HOME"/.kube ];
then
    echo "$HOME"/.kube folder alredy exists, removing it.
    rm -rf "$HOME"/.kube
fi

mkdir "$HOME"/.kube
echo "apiVersion: v1
clusters:
- cluster:
    server: $1
  name: edge-k8s
contexts:
- context:
    cluster: edge-k8s
    user: edge-k8s
  name: edge-k8s
current-context: edge-k8s
kind: Config
preferences: {}
users:
- name: edge-k8s
  user:
    token: $2" >> "$HOME"/.kube/config
