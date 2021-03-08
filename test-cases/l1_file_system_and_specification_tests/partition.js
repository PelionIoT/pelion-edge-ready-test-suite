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
 * [Level 1] Partition validation testcases for pelion edge
 */
var assert = require('chai').assert
var exec = require('child_process').exec

describe('[Level 1] PartitionTests', () => {
  describe('#PartitionMount', () => {
    Object.keys(global.config.partitions).forEach(partition_name => {
      it(`Should return true if ${partition_name} partition mounted`, done => {
        exec(
          `df -h | grep ${partition_name} | awk '{print $1}'`,
          (error, stdout) => {
            if (error) {
              done(error)
            } else {
              assert.equal(
                stdout.trim(),
                partition_name,
                `${partition_name} not found`
              )
              done()
            }
          }
        )
      })
    })
  })
  describe('#PartitionSize', () => {
    Object.keys(global.config.partitions).forEach(partition_name => {
      it(`Should return true if ${partition_name} partition mounted`, done => {
        exec(
          `df -h | grep ${partition_name} | awk '{print $2}'`,
          (error, stdout) => {
            if (error) {
              done(error)
            } else {
              assert.operator(
                parseFloat(stdout.trim()),
                '>=',
                parseFloat(global.config.partitions[partition_name].size),
                `Expected: ${partition_name} size not valid`
              )
              done()
            }
          }
        )
      })
    })
  })
})
