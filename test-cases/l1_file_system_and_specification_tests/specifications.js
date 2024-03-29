/*
 * Copyright (c) 2020-2021, Pelion and affiliates.
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
 * [Level 1] Specification testcaes for pelion edge
 */

var assert = require('chai').assert
var exec = require('child_process').exec
var cpu_info = require('os').cpus
var fs = require('fs')

describe('[Level 1] SpecificationTests', () => {
  describe('#CPUTests', () => {
    it('Should return true if minimum cores available', () => {
      var min_cpu_core = global.config.specifications.minimum_cpu_core
      assert.operator(
        cpu_info().length,
        '>=',
        min_cpu_core,
        `Minimum CPU core ${min_cpu_core} is not available`
      )
    })
    cpu_info().forEach((file, index) => {
      if (fs.existsSync('/sys/devices/system/cpu/cpu${index}/cpufreq/scaling_max_freq')) {
        it(
          'Should return true if cpu' +
            index +
            ' has maximum required cpu frequency',
          done =>
            exec(
              `cat /sys/devices/system/cpu/cpu${index}/cpufreq/scaling_max_freq`,
              (error, stdout) => {
                var max_cpu_freq = global.config.specifications.max_cpu_freq
                if (error) {
                  throw error
                } else {
                  assert.operator(
                    max_cpu_freq,
                    '>=',
                    parseInt(stdout),
                    `Maximum CPU freqency ${max_cpu_freq} is not available`
                  )
                  done()
                }
              }
            )
          )
      }
      if (fs.existsSync('/sys/devices/system/cpu/cpu${index}/cpufreq/scaling_min_freq')) {
        it(`Should return true if cpu${index} have minimum required cpu frequency`, done => {
          exec(
            `cat /sys/devices/system/cpu/cpu${index}/cpufreq/scaling_min_freq`,
            (error, stdout) => {
              var min_cpu_freq = global.config.specifications.min_cpu_freq
              if (error) {
                throw error
              } else {
                assert.operator(
                  min_cpu_freq,
                  '<=',
                  parseInt(stdout),
                  `Minimum CPU freqency ${min_cpu_freq} is not available`
                )
                done()
              }
            }
          )
        })
      }
    })
  })
  describe('#MemoryTests', () => {
    var mem_keys = ['MemTotal', 'MemFree', 'MemAvailable']
    mem_keys.forEach(key => {
      it(`Should return true if ${key} is as per required`, done => {
        exec(
          `cat /proc/meminfo | grep ${key} | awk '{print $2}'`,
          (error, stdout) => {
            var mem = global.config.specifications.device_mem[key]
            if (error) {
              done(new Error(error))
            } else {
              assert.operator(
                mem,
                '<=',
                parseInt(stdout),
                `${key} is not less then equal to ${stdout}`
              )
              done()
            }
          }
        )
      })
    })
  })
  describe('#ConfigChecks', () => {
    if (global.config.device_type != 'avnet' &&
        fs.existsSync('fs./sys/devices/virtual/thermal/thermal_zone0/temp')) {
      it('Should return true if chip temperature less then threshold', done => {
        exec(
          'cat /sys/devices/virtual/thermal/thermal_zone0/temp',
          (error, stdout) => {
            var die_temp = global.config.specifications.SOC_die_temprature
            assert.operator(
              die_temp,
              '>=',
              parseInt(stdout.trim()) / 1000,
              `${die_temp} is not in safe limit`
            )
            done()
          }
        )
      })
    }

    if (global.config.device_type == 'rpi') {
      it('Should return true if got the revision number', done => {
        exec(
          "cat /proc/cpuinfo | grep Revision | awk '{print $3}'",
          (error, stdout) => {
            var revision_number = global.config.specifications.revision_number
            assert.equal(
              revision_number,
              stdout.trim(),
              `${revision_number} is not valid`
            )
            done()
          }
        )
      })
    }

    it('Should return true if sufficient entropy available', done => {
      exec('cat /proc/sys/kernel/random/entropy_avail', (error, stdout) => {
        var entropy = global.config.specifications.entropy
        assert.operator(
          entropy,
          '<=',
          parseInt(stdout.trim()),
          `${stdout} is not valid`
        )
        done()
      })
    })

    var identityJSONkeys = [
      'ledConfig',
      'radioConfig',
      'gatewayServicesAddress'
    ]
    identityJSONkeys.forEach(identity_key => {
      it(`Should return true if ${identity_key} is valid`, done => {
        var identityJSON = require(global.config.config_path.identityJSON)
        assert.equal(
          identityJSON[identity_key],
          global.config.specifications[identity_key],
          `${identity_key} config is different`
        )
        done()
      })
    })
    Object.keys(global.config.config_path).forEach(config_key => {
      it(`Should pass if ${config_key} exists`, done => {
        var config_path = global.config.config_path[config_key]
        assert.equal(
          fs.existsSync(config_path),
          true,
          `${config_path} not exist`
        )
        done()
      })
    })
  })
})
