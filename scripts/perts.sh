#!/bin/bash
# ----------------------------------------------------------------------------
# Copyright (c) 2023 Izuma Networks
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
SERVER="https://edge-k8s.us-east-1.mbedcloud.com"
CURDIR=$(pwd)
CONFIG=""
TESTCONFIG="test-config.json"
EDGEPORT=9101
EDGEPORT_GIVEN=0
ROOTKUBECFG="/home/root/perts-kube-config.yaml"

# Node.JS and NPM versions
NODEVER="v16.20.0"
NPMVER="8.7.0"

usage() {
  echo "Usage: $0 -a access-key [-s Edge K8S server URL] [-e]"
  echo "  -a                  access key"
  echo "  -c                  config file to use (will try to auto-detect if not give)"
  echo "  -s                  Edge K8S edge-server URL, default $SERVER"
  echo "  -p                  edge status port, default $EDGEPORT"
  echo "  -e                  echo commands (debug), default off"
  echo "  --help              Show this help message and exit"
  echo ""
  echo "NOTE! Must be run as sudo, installation steps require sudo rights."
  echo "You must run the scripts from the pelion-edge-ready-test-suite -folder."
  exit 1
}

# Parse arguments, if given...
while getopts "a:c:s:p:e" opt; do
  case $opt in
    a ) ACCESSKEY="$OPTARG" ;;
    c ) CONFIG="$OPTARG" ;;
    s ) SERVER="$OPTARG" ;;
    p ) EDGEPORT="$OPTARG"
        EDGEPORT_GIVEN=1
        ;;
    e ) DEBUG=1 ;;
    \? ) echo "Invalid option: -$OPTARG"
        usage
        exit 1
        ;;
    : ) echo "Option -$OPTARG requires an argument." >&2
    exit 1;;
  esac
done

if (( DEBUG == 1 )); then
    set -x
fi

if [[ "$EUID" -gt 0 ]]; then
  echo "This script must be run via sudo (or as root)."
  exit 1
fi

if [[ -z "$ACCESSKEY" ]]; then
  echo "ERROR - access key must be given as argument."
  usage
  exit 2
fi

# We're running as sudo, so we're actually root
# not the user we'd want to be... So, we can't refer to $HOME.
[ "$SUDO_USER" ] && USER="$SUDO_USER" || USER=$(whoami)

# Check which architecture we are running
arch=""
case $(uname -m) in
    x86_64)
      arch="x64" ;;
    aarch64)
      arch="arm64" ;;
    *)
      echo "ERROR - unknown architecture (based on uname -m)."
      exit 1
      ;;
esac

# Get nodejs
# wget https://nodejs.org/dist/v16.14.2/node-v16.14.2-linux-arm64.tar.gz
# or (depending on your CPU-architecture)
# wget https://nodejs.org/dist/v16.14.2/node-v16.14.2-linux-x64.tar.gz

if ! [ -e node-$NODEVER-linux-$arch.tar.gz ]; then
  wget "https://nodejs.org/dist/$NODEVER/node-$NODEVER-linux-$arch.tar.gz"
  chown -R "$USER" "node-$NODEVER-linux-$arch.tar.gz"
fi
if ! [ -e "node-$NODEVER-linux-$arch/bin/node" ]; then
  tar -xzf "node-$NODEVER-linux-$arch.tar.gz"
  chown -R "$USER" "node-$NODEVER-linux-$arch"
fi
PATH=$PATH:"$CURDIR/node-$NODEVER-linux-$arch/bin/"

if ! [ -e "$CURDIR/npm-$NPMVER.tgz" ]; then
  wget https://registry.npmjs.org/npm/-/npm-8.7.0.tgz
  chown "$USER" npm-$NPMVER.tgz
fi
if ! [ -d "package" ]; then
  tar -xzf npm-$NPMVER.tgz
fi
chown -R "$USER" package
cd "package"
sudo node bin/npm-cli.js install --prefix /usr/local -gf ../npm-8.7.0.tgz

# Install kubectl
arch=""
case $(uname -m) in
    x86_64)
      arch="amd64" ;;
    aarch64)
      arch="arm64" ;;
    *)
      echo "ERROR - unknown architecture (based on uname -m)."
      exit 1
      ;;
esac

# Only pull in kubectl if we don't have it already
if ! [ -e /usr/local/bin/kubectl ]; then
  wget "https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/$arch/kubectl"
  chmod +x ./kubectl
  sudo mv ./kubectl /usr/local/bin/kubectl
  chown "$USER" /usr/local/bin/kubectl
fi
kubectl version --client

# Setup kube config - to ROOT -user, as this script is running via sudo!
if [ -e "$ROOTKUBECFG" ]; then
    rando=$(( $RANDOM % 1024 ))
    echo "WARNING - $ROOTKUBECFG folder alredy exists, backing it up as $ROOTKUBECFG.$rando"
    mv "$ROOTKUBECFG" "$ROOTKUBECFG.$rando"
fi

echo "Creating kubectl config file to $ROOTKUBECFG"
mkdir -p "/home/root/.kube"
echo "apiVersion: v1
clusters:
- cluster:
    server: $SERVER
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
      token: $ACCESSKEY" > "$ROOTKUBECFG"

#chmod a+r "$ROOTKUBECFG"
export KUBECONFIG="$ROOTKUBECFG"

# Install
cd "$CURDIR"
npm install

# Create config
if [[ $EDGEPORT_GIVEN == 0 ]]; then
  if [[ -n "${SNAP}" ]]; then
        EDGEPORT=8081
    else
      # Try if we're on LmP.
      EDGEPORT=9101
      EDGECORESTATUS=$(curl -s "localhost:${EDGEPORT}/status")
      if [[ -z $(echo "$EDGECORESTATUS" | jq -r '."endpoint-name"') ]]; then
          # Must be running on edge-core only then.
          EDGEPORT=8080
          EDGECORESTATUS=$(curl -s "localhost:${EDGEPORT}/status")
          if [[ -z $(echo "$EDGECORESTATUS" | jq -r '."endpoint-name"') ]]; then
            echo "ERROR - can't find localhost:<port>/status, is edge-core running?"
            exit 1
        fi
    fi
  fi
fi
DID=$(echo "$EDGECORESTATUS" | jq -r '."endpoint-name"')
ACCID=$(echo "$EDGECORESTATUS" | jq -r '."account-id"')
echo "Device ID = $DID, Account ID  = $ACCID"

# If no config file given, try to guess
if [[ "$CONFIG" == "" ]]; then
  if [[ $(cat /proc/cpuinfo |grep "Raspberry Pi 3") ]]; then
    CONFIG="test-configs/rpi3-config.json"
  elif [[ $(cat /proc/cpuinfo |grep "Raspberry Pi 4") ]]; then
    CONFIG="test-configs/rpi4-config.json"
  elif [[ $(uname -a |awk '{print $2}') == "imx8mmevk" ]]; then
    CONFIG="test-configs/imx8-config.json"
  elif [[ -n "$SNAP" ]]; then
    CONFIG="test-configs/snap-config.json"
  fi
fi

if ! [[ -e "$CONFIG" ]]; then
  echo "ERROR - cannot locate config file. Please specify it with -c or"
  echo "create your own config file and run tests manually with"
  echo "    sudo node index.js -c <config-file.json>"
  echo "Examples available in test-configs -folder."
  echo "Add in device ID, account ID and access key."
  echo -n 'Remember to add node.js to path, run PATH=$PATH:'
  echo "$CURDIR/node-v16.14.2-linux-$arch/bin/"
fi

if [ -e "$TESTCONFIG"  ]; then
    echo "WARNING - $TESTCONFIG file already exists."
    rand_cfg=$(( $RANDOM % 1024 ))
    echo "Making a backup of it to $TESTCONFIG.$rand_cfg"
    mv "$TESTCONFIG" "$TESTCONFIG.$rand_cfg"
fi
cp "$CONFIG" "$TESTCONFIG"
tmp=$(mktemp)
jq ".internal_id=\"$DID\"" "$TESTCONFIG" > "$tmp" && mv "$tmp" "$TESTCONFIG"
jq ".accountID=\"$ACCID\"" "$TESTCONFIG" > "$tmp" && mv "$tmp" "$TESTCONFIG"
jq ".access_key=\"$ACCESSKEY\"" "$TESTCONFIG" > "$tmp" && mv "$tmp" "$TESTCONFIG"
echo "$TESTCONFIG created."
chown "$USER" "$TESTCONFIG"

# Run test
echo "Run test (node index.js -c $TESTCONFIG) with KUBECONFIG=$KUBECONFIG env var preserved."
sudo --preserve-env=KUBECONFIG node index.js -c "$TESTCONFIG"
# Do not leave credentials floating about, delete the kubectl config file.
rm "$ROOTKUBECFG"

echo "DONE - Check test results under suite_results -folder."
