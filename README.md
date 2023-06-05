# Izuma Edge ready test suite

For a more thorough documentation about the Izuma Edge ready test suite, please see the [Izuma Edge documentation](https://developer.izumanetworks.com/docs/device-management-edge/latest/testing/izuma-edge-ready-test-suite.html).

# Quick start

Run the [`script/perts.sh -a <access-key> -c <config-file-template>`](scripts/perts.sh).
- [`test-configs`](test-configs) -folder has multiple template scripts.
- The script will create a `test-config.json` -file which it uses as the configuration file running the test.
- It will automatically populate the device ID and account ID based on the information it gets via `curl localhost:<port>/status`.

**NOTE! KaaS tests require that the account has Edge KaaS features enabled. By default KaaS features are not enabled. Contact [Iazuma Networks](https://www.izumanetworks.com/) to enable it.**
