# Pelion Edge ready test suite

For a more thorough documentation about the Pelion Edge ready test suite, please see the [Pelion Edge documentation](https://developer.pelion.com/docs/device-management-edge/latest/testing/pelion-edge-ready-test-suite.html).

# Quick start

Run these commands in the shell of the device under test.

```
curl -LSs https://github.com/PelionIoT/pelion-edge-ready-test-suite/archive/refs/tags/v2.6.0.tar.gz -o perts.tar.gz
tar -xvzf perts.tar.gz
wget https://nodejs.org/dist/v16.14.2/node-v16.14.2-linux-arm64.tar.gz
tar -xzf node-v16.14.2-linux-arm64.tar.gz
PATH=$PATH:$HOME/node-v16.14.2-linux-arm64/bin/
wget https://registry.npmjs.org/npm/-/npm-8.7.0.tgz
tar -xzf npm-8.7.0.tgz
cd package
sudo node bin/npm-cli.js install --prefix /usr/local -gf ../npm-8.7.0.tgz
cd ../pelion-edge-ready-test-suite-2.6.0
sudo ./scripts/install_kubectl.sh <K8 API URL> <access key>
```

K8S API are region based according to following table.

| Region | K8 API URL  |
|--------|-------------|
| EU     | `https://edge-k8s.eu-west-1.mbedcloud.com` |
| US     | `https://edge-k8s.us-east-1.mbedcloud.com` |

There are basic example configurations under `test-configs`, pick the closest match from there based on region (EU/US) and device model. Copy it to this folder and modify it to have your:

- account ID
- endpoint name
- access key

details filled in. Example below:


```
cp test-configs/us/rpi3-config.json ./my-config.json
nano my-config.json
```

Run the tests `sudo node index.js -c my-config.json -e`.
- If you exit the shell, you will need to add the PATH again as it is not persisted.
