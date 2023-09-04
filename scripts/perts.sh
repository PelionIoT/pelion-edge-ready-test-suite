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
SCRIPTNAME="perts.sh"
REPONAME="pelion-edge-ready-test-suite"
KAASSERVER="https://edge-k8s.us-east-1.mbedcloud.com"
KAASSERVER_GIVEN=0
CURDIR=$(pwd)
CONFIG=""
TESTCONFIG="test-config.json"
EDGEPORT=9101
EDGEPORT_GIVEN=0
ROOTKUBECFG="/home/root/perts-kube-config.yaml"

# Node.JS and NPM versions
NODEVER="v18.16.0"
NPMVER="9.6.7"

usage() {
  echo "Usage: scripts/$SCRIPTNAME -a access-key [-s Edge K8S server URL] [-e]"
  echo "  -a                  access key"
  echo "  -c                  config file to use (will try to auto-detect if not give)"
  echo "  -s                  Edge K8S edge-server URL, default $KAASSERVER (if -c config is given, picked up from there)"
  echo "  -p                  edge status port, default $EDGEPORT"
  echo "  -e                  echo commands (debug), default off"
  echo "  --help              Show this help message and exit"
  echo ""
  echo "Requires jq to be installed."
  echo ""
  echo "NOTE! Must be run as sudo, installation steps require sudo rights."
  echo "You must run this script from the $REPONAME -folder."
  echo "I.e."
  echo "   sudo scripts/$SCRIPTNAME -a <accesskey>"
  echo "   sudo scripts/$SCRIPTNAME -a <accesskey> -c <test-config-file.json>"
  exit 1
}

assertInstalled() {
  for var in "$@"; do
      if ! which "$var" &> /dev/null; then
          echo "Please install $var - for example sudo apt-get install $var!"
          exit 1
      fi
  done
}

# cleanup - delete the created config files before exiting.
# - if a parameters is not given, we exit with error code
#   as we assume we got trapped.
cleanup() {
  local exit_code=0
  if [ $# -eq 0 ]; then
    exit_code=1
  fi
  echo "Cleaning up..."

  # Check if the config file exists before attempting to delete it
  if [ -e "$ROOTKUBECFG" ]; then
      rm -f "$ROOTKUBECFG"
      echo "Configuration file deleted: $ROOTKUBECFG"
  fi
  if [ -e "$TESTCONFIG" ]; then
      rm -f "$TESTCONFIG"
      echo "Test configuration file deleted: $TESTCONFIG"
  fi

  if [[ -n "$rand_kube" ]];then
    mv "$ROOTKUBECFG.$rand_kube" "$ROOTKUBECFG"
  fi
  if [[ -n "$rand_cfg" ]];then
    mv  "$TESTCONFIG.$rand_cfg" "$TESTCONFIG"
  fi
  # Exit the script

  exit $exit_code
}

trap 'cleanup' INT TERM ERR

curdir=$(pwd)
lastdir="${curdir##*/}"
if [[ "$lastdir" != "pelion-edge-ready-test-suite" ]]; then
  echo "ERROR - not being run from correct directory."
  usage
fi

# Parse arguments, if given...
while getopts "a:c:s:p:e" opt; do
  case $opt in
    a ) ACCESSKEY="$OPTARG" ;;
    c ) CONFIG="$OPTARG" ;;
    s ) KAASSERVER="$OPTARG"
        KAASSERVER_GIVEN=1 ;;
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

assertInstalled jq

# Get nodejs
# wget https://nodejs.org/dist/v16.14.2/node-v16.14.2-linux-arm64.tar.gz
# or (depending on your CPU-architecture)
# wget https://nodejs.org/dist/v16.14.2/node-v16.14.2-linux-x64.tar.gz

if ! [ -e "node-$NODEVER-linux-$arch.tar.gz" ]; then
  wget "https://nodejs.org/dist/$NODEVER/node-$NODEVER-linux-$arch.tar.gz"
  chown -R "$USER" "node-$NODEVER-linux-$arch.tar.gz"
fi
if ! [ -e "node-$NODEVER-linux-$arch/bin/node" ]; then
  tar -xzf "node-$NODEVER-linux-$arch.tar.gz"
  chown -R "$USER" "node-$NODEVER-linux-$arch"
fi
# Only add node to PATH if it is not there yet
if ! [[ " ${PATH//:/ } " =~  $CURDIR/node-$NODEVER-linux-$arch/bin/  ]]; then
  export PATH=$PATH:"$CURDIR/node-$NODEVER-linux-$arch/bin/"
fi

if ! [ -e "$CURDIR/npm-$NPMVER.tgz" ]; then
  wget "https://registry.npmjs.org/npm/-/npm-$NPMVER.tgz"
  chown "$USER" npm-$NPMVER.tgz
fi
if ! [ -d "package" ]; then
  tar -xzf npm-$NPMVER.tgz
fi
chown -R "$USER" package
cd "package"

# For some reason on x64 systems just sudo node will not work - full path is required
NODECMD="$CURDIR/node-$NODEVER-linux-$arch/bin/node"
sudo "$NODECMD" bin/npm-cli.js install --prefix /usr/local -gf "../npm-$NPMVER.tgz"

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
    rand_kube=$(( RANDOM % 1024 + 1 ))
    mv "$ROOTKUBECFG" "$ROOTKUBECFG.$rand_kube"
fi

# Only try digging up KaaS server from conf file, if it was not given already
cd "$CURDIR"
if [ -n "$CONFIG" ] && [ $KAASSERVER_GIVEN = 0 ]; then
  KAASSERVER=$(jq -r '.specifications.kaasServicesAddress' < "$CONFIG" )
fi

echo "Creating kubectl config file to $ROOTKUBECFG against $KAASSERVER"
echo "apiVersion: v1
clusters:
- cluster:
    server: $KAASSERVER
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

export KUBECONFIG="$ROOTKUBECFG"

# Install
cd "$CURDIR"
npm install

# Create config
if [[ $EDGEPORT_GIVEN == 0 ]]; then
  EDGEPORT=8081
  EDGECORESTATUS=$(curl -s "localhost:${EDGEPORT}/status") || EDGECORESTATUS=""
  if [[ -z $(echo "$EDGECORESTATUS" | jq -r '."internal-id"') ]]; then
    # Try if we're on LmP.
    EDGEPORT=9101
    EDGECORESTATUS=$(curl -s "localhost:${EDGEPORT}/status") || EDGECORESTATUS=""
    if [[ -z $(echo "$EDGECORESTATUS" | jq -r '."internal-id"') ]]; then
      # Must be running on edge-core only then.
      EDGEPORT=8080
      EDGECORESTATUS=$(curl -s "localhost:${EDGEPORT}/status") || EDGECORESTATUS=""
      if [[ -z $(echo "$EDGECORESTATUS" | jq -r '."internal-id"') ]]; then
        echo "ERROR - can't find localhost:<port>/status, is edge-core running?"
        exit 1
      fi
    fi
  fi
fi
EDGECORESTATUS=$(curl -s "localhost:${EDGEPORT}/status") || EDGECORESTATUS=""
DID=$(echo "$EDGECORESTATUS" | jq -r '."internal-id"')
ACCID=$(echo "$EDGECORESTATUS" | jq -r '."account-id"')
if [[ -z $(echo "$EDGECORESTATUS" | jq -r '."internal-id"') ]]; then
  echo "ERROR - can't find localhost:$EDGEPORT/status, is edge-core running / port correct?"
  exit 1
fi
echo "Device ID = $DID, Account ID  = $ACCID"

# If no config file given, try to guess
if [[ "$CONFIG" == "" ]]; then
  if grep -q "Raspberry Pi 3" </proc/cpuinfo;  then
    CONFIG="test-configs/rpi3-config.json"
    echo "Using Raspberry Pi3 configuration"
  elif grep -q "Raspberry Pi 4" </proc/cpuinfo; then
    CONFIG="test-configs/rpi4-config.json"
    echo "Using Raspberry Pi4 configuration"
  elif [[ $(uname -a |awk '{print $2}') == "imx8mmevk" ]]; then
    CONFIG="test-configs/imx8-config.json"
    echo "Using i.MX8 configuration"
  elif [[ -n "$SNAP" ]]; then
    CONFIG="test-configs/snap-config.json"
    echo "Using Snap configuration"
  fi
fi

if ! [[ -e "$CONFIG" ]]; then
  echo "ERROR - cannot locate config file. Please specify it with -c or"
  echo "create your own config file and run tests manually with"
  echo "    sudo $NODECMD index.js -c <config-file.json>"
  echo "Examples available in test-configs -folder."
  echo "Insert device ID, account ID and access key to the config file."
  exit 1
fi

if [ -e "$TESTCONFIG"  ]; then
    rand_cfg=$(( RANDOM % 1024 + 1 ))
    mv "$TESTCONFIG" "$TESTCONFIG.$rand_cfg"
fi
cp "$CONFIG" "$TESTCONFIG"
tmp=$(mktemp)
jq ".internal_id=\"$DID\"" "$TESTCONFIG" > "$tmp" && mv "$tmp" "$TESTCONFIG"
jq ".accountID=\"$ACCID\"" "$TESTCONFIG" > "$tmp" && mv "$tmp" "$TESTCONFIG"
jq ".access_key=\"$ACCESSKEY\"" "$TESTCONFIG" > "$tmp" && mv "$tmp" "$TESTCONFIG"
echo "$TESTCONFIG created."
chown "$USER" "$TESTCONFIG"

# Check it wires is stated as default, use:
# route |grep default | awk '{print $NF}'
# to get default network interface name

wired=$(jq -r ".interface.wired" < "$CONFIG")
if [[ "$wired" == "default" ]]; then
  defnet=$(route |grep default | awk '{print $NF}')
  echo "Configuring network interface $defnet to interface.wired"
  jq ".interface.wired=\"$defnet\"" "$TESTCONFIG" > "$tmp" && mv "$tmp" "$TESTCONFIG"
fi

# Run test
echo "Run test ($NODECMD index.js -c $TESTCONFIG) with KUBECONFIG=$KUBECONFIG env var preserved."
sudo --preserve-env "$NODECMD" index.js -c "$TESTCONFIG"

# Do not leave credentials floating about, delete the kubectl config file.
# Restore original files, if there were any...
cleanup 0

echo "DONE - Check test results under suite_results -folder."
