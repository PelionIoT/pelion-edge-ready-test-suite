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

var request = require('request')
var assert = require('chai').assert

describe('[Level 4] EdgeCoreTests', () => {
  describe('#EdgeCore', () => {
    it('It should return true if edge core is connected with right account', done => {
      request(
        `http://localhost:${
          global.config.internal_server_port.edge_core_port
        }/status`,
        (err, resp, body) => {
          if (err) {
            done(new Error(err))
          } else {
            var edge_core_info = JSON.parse(body)
            var accountID = global.config.accountID
            assert.equal(
              edge_core_info['status'],
              'connected',
              `Edge core is not connected. Err: ${edge_core_info}`
            )
            assert.equal(
              edge_core_info['account-id'],
              accountID,
              `Edge core is not conncted with right accountID`
            )
            done()
          }
        }
      )
    })
  })
})
