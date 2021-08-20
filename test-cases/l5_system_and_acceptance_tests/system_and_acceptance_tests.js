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

var assert = require('chai').assert
var exec = require('child_process').exec
var request = require('request')
var str = ''
var system_service = ''
var status = ''
var cmd = ''

function updateConfigWithTestData (length) {
  var characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  var charactersLength = characters.length
  for (var i = 0; i < length; i++) {
    str += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  exec(`sed -i '13s/.*/@SET test_data="${str}"/' conf/td-agent-bit.conf`)
}

describe('[Level 5] SystemAndAcceptanceTests', () => {
  describe('EdgeServices', () => {
    global.config.services.forEach(Service => {
      if (global.config.edge_build_type == 'snap') {
        system_service = 'snap'
        status = 'services'
      } else {
        system_service = 'systemctl'
        status = 'status'
      }
      it(`Should return true if ${Service} is stopped`, function (done) {
        if (global.config.edge_build_type == 'snap') {
          cmd = `sudo ${system_service} stop ${Service} && ${system_service} ${status} ${Service}`
        } else {
          cmd = `sudo ${system_service} mask ${Service} && sudo ${system_service} stop ${Service} && ${system_service} ${status} ${Service}`
        }
        exec(cmd, (err, stdout) => {
          assert.include(stdout.trim(), 'inactive', 'Service did not stopped')
          done()
        })
      })
      it(`Should return true if ${Service} is started`, function (done) {
        if (global.config.edge_build_type == 'snap') {
          cmd = `sudo ${system_service} start ${Service} && ${system_service} ${status} ${Service}`
        } else {
          cmd = `sudo ${system_service} unmask ${Service} && sudo ${system_service} start ${Service} && ${system_service} ${status} ${Service}`
        }
        exec(cmd, (err, stdout) => {
          assert.include(stdout.trim(), 'active', 'Service did not started')
          done()
        })
      })
      it(`Should return true if ${Service} is restarted`, function (done) {
        exec(
          `sudo ${system_service} restart ${Service} && ${system_service} ${status} ${Service}`,
          (err, stdout) => {
            assert.include(stdout.trim(), 'active', 'Service did not restarted')
            done()
          }
        )
      })
    })
  })
  describe('#SystemLogsFluentBitTests', () => {
    it('It should update fluent bit config', function (done) {
      updateConfigWithTestData(50)
      setTimeout(() => {
        exec(
          `./scripts/swap_td_config.sh && cat ${
            global.config.config_path.td_agent_bit_conf
          }`,
          (error, stdout) => {
            if (error) {
              done(error)
            } else {
              assert.include(
                stdout.trim(),
                str,
                `Test data ${str} is not preset in config`
              )
              done()
            }
          }
        )
      }, 5000)
    })
    it('It should return true if fluent bit service is running', function (done) {
      setTimeout(() => {
        exec(`systemctl status td-agent-bit`, (error, stdout) => {
          if (error) {
            done(error)
          } else {
            assert.include(
              stdout.trim(),
              'active (running)',
              `td-agent-bit is not running`
            )
            done()
          }
        })
      }, 20000)
    })
    it('It should return true if original config is updated again', function (done) {
      exec(
        `./scripts/swap_td_config.sh && cat ${
          global.config.config_path.td_agent_bit_conf
        }`,
        (error, stdout) => {
          if (error) {
            done(error)
          } else {
            assert.include(
              stdout.trim(),
              'systemd',
              `systemd is not preset in config`
            )
            assert.include(
              stdout.trim(),
              'edge_core_tag',
              `edge_core_tag is not preset in config`
            )
            assert.include(
              stdout.trim(),
              'edge_proxy_tag',
              `edge_proxy_tag is not preset in config`
            )
            assert.include(
              stdout.trim(),
              'maestro_tag',
              `maestro_tag is not preset in config`
            )
            done()
          }
        }
      )
    })
    it('It should return true if fluent bit logs updated in the cloud', function (done) {
      var options = {
        method: 'GET',
        url:
          global.config.specifications.apiAddress +
          '/v3/devices/' +
          global.config.internal_id +
          '/logs?limit=500&order=DESC&app_name__eq=qa_test_app',
        headers: {
          Authorization: 'Bearer ' + global.config.access_key,
          'Content-Type': 'application/json'
        }
      }
      request(options, function (err, res, body) {
        assert.equal(
          res.statusCode,
          200,
          `Log API Status code : ${res.statusCode}`
        )
        assert.include(body, str, `Test data: ${str} not found`)
        done()
      })
    })
  })
})
