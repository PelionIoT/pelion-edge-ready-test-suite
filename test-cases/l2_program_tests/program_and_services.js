/*
 * Copyright (c) 2020-2021, Pelion and affiliates.
 * Copyright (c) 2023 Izuma Networks
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * [Level 2] Service and program validation testcases for pelion edge
 */
var assert = require('chai').assert
var exec = require('child_process').exec
var compareVersions = require('compare-versions')
var fs = require('fs')
var cmd = ''

describe('[Level 2] ServicesAndProgramExistanceTests', () => {
  describe('#ProgramVersion', () => {
    it('Should return true if valid maestro version is present', function (done) {
      if (global.config.edge_build_type == 'snap') {
        this.skip()
      }
      exec(
        "maestro --version | grep -Po '(?<=maestro )\\d.\\d.\\d'",
        (error, stdout) => {
          if (error) {
            done(error)
          } else {
            assert.equal(
              compareVersions.compare(
                stdout.trim(),
                global.config.program_version.maestro,
                '>='
              ),
              true,
              'Maestro version not valid'
            )
            done()
          }
        }
      )
    })
    it('Should return true if valid docker version is present', function (done) {
      exec(
        "docker --version | cut -d',' -f1 | awk '{print $3}'",
        (error, stdout) => {
          if (error) {
            done(error)
          } else {
            assert.equal(
              compareVersions.compare(
                stdout.trim(),
                global.config.program_version.docker,
                '>='
              ),
              true,
              'Docker version not valid'
            )
            done()
          }
        }
      )
    })
    it('Should return true if valid openssl version is present', function (done) {
      if (global.config.edge_build_type == 'snap') {
        this.skip()
      }
      exec(
        "openssl version | cut -d' ' -f2 | sed 's/[a-z]$//'",
        (error, stdout) => {
          if (error) {
            done(error)
          } else {
            assert.equal(
              compareVersions.compare(
                stdout.trim(),
                global.config.program_version.openssl,
                '>='
              ),
              true,
              'SSL version not valid'
            )
            done()
          }
        }
      )
    })
    it('Should return true if valid openssh version is present', function (done) {
      if (global.config.edge_build_type == 'snap') {
        this.skip()
      }
      exec('ssh -V', (error, stdout, stderr) => {
        if (error) {
          done(error)
        } else {
          assert.equal(
            stderr.split(',')[0],
            global.config.program_version.openssh,
            'SSH version not valid'
          )
          done()
        }
      })
    })
    it('Should return true if valid node version is present', function (done) {
      exec('node --version | cut -c2-9', (error, stdout) => {
        if (error) {
          done(error)
        } else {
          assert.equal(
            compareVersions.compare(
              stdout.trim(),
              global.config.program_version.node,
              '>='
            ),
            true,
            'Node version not valid'
          )
          done()
        }
      })
    })
    it('Should return true if valid edge-core version is present', function (done) {
      var edge_core_path = global.config.binary_path.edge_core
      exec(`${edge_core_path} --version | cut -d'-' -f1`, (error, stdout) => {
        if (error) {
          done(error)
        } else {
          assert.equal(
            compareVersions.compare(
              stdout.trim(),
              global.config.program_version.edge_core,
              '>='
            ),
            true,
            'Edge core version not valid'
          )
          done()
        }
      })
    })
    it('Should return true if valid kernel version is present', function (done) {
      exec("uname -r | cut -d'-' -f1", (error, stdout) => {
        if (error) {
          done(error)
        } else {
          assert.equal(
            compareVersions.compare(
              stdout.trim(),
              global.config.program_version.kernel,
              '>='
            ),
            true,
            'Kernel version not valid'
          )
          done()
        }
      })
    })
    it('Should return true if valid Fluent-bit version is present', function (done) {
      if (global.config.edge_build_type == 'snap') {
        this.skip()
      }
      exec(
        "td-agent-bit --version | awk '{print $3}' | cut -c2-6",
        (error, stdout) => {
          if (error) {
            done(error)
          } else {
            assert.equal(
              compareVersions.compare(
                stdout.trim(),
                global.config.program_version['td-agent-bit'],
                '>='
              ),
              true,
              'Fluent-bit version not valid'
            )
            done()
          }
        }
      )
    })
  })
  describe('#ServiceStatus', () => {
    global.config.services.forEach(service_name => {
      it(`Should return true if ${service_name} is running`, function (done) {
        if (global.config.edge_build_type == 'snap') {
          cmd = `snap services ${service_name}`
        } else {
          cmd = `systemctl status ${service_name}`
        }
        exec(cmd, (error, stdout) => {
          if (error) {
            done(error)
          } else {
            assert.include(
              stdout.trim(),
              'active',
              `${service_name} is not running`
            )
            done()
          }
        })
      })
    })
  })
  describe('#KernelModules', () => {
    var kernel_modules_config = [
      "CONFIG_IP_SET=m",
      "CONFIG_IP_SET_MAX=256",
      "CONFIG_IP_SET_BITMAP_IP=m",
      "CONFIG_IP_SET_BITMAP_IPMAC=m",
      "CONFIG_IP_SET_BITMAP_PORT=m",
      "CONFIG_IP_SET_HASH_IP=m",
      "CONFIG_IP_SET_HASH_IPMARK=m",
      "CONFIG_IP_SET_HASH_IPPORT=m",
      "CONFIG_IP_SET_HASH_IPPORTIP=m",
      "CONFIG_IP_SET_HASH_IPPORTNET=m",
      "CONFIG_IP_SET_HASH_IPMAC=m",
      "CONFIG_IP_SET_HASH_MAC=m",
      "CONFIG_IP_SET_HASH_NETPORTNET=m",
      "CONFIG_IP_SET_HASH_NET=m",
      "CONFIG_IP_SET_HASH_NETNET=m",
      "CONFIG_IP_SET_HASH_NETPORT=m",
      "CONFIG_IP_SET_HASH_NETIFACE=m",
      "CONFIG_IP_SET_LIST_SET=m"
  ]
  kernel_modules_config.forEach(module_config => {
    it(`Should return true if ${module_config} exist`, (done) => {
      exec('zcat /proc/config.gz | grep CONFIG_IP_SET', (error, stdout, stderr) => {
        if (error) {
          done(error)
        } else {
          assert.include(
            stdout.trim(),
            module_config,
            `${module_config} is not present`
          )
          done()
        }
      })
    })
  })
  })
})
