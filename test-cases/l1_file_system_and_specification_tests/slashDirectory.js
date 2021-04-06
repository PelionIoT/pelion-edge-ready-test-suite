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
 * [Level 1] Slash directory testcaes for pelion edge
 */

var fs = require('fs')
var assert = require('chai').assert

describe('[Level 1] SlashDirectoryTests', () => {
  describe('#SlashDirExistace', () => {
    global.config.fileSystem.forEach(dir_name => {
      var dir_path = '/' + dir_name
      it(`Should pass if ${dir_name} exists`, done => {
        assert.equal(fs.existsSync(dir_path), true, `${dir_name} not exist`)
        done()
      })
    })
  })
  describe('#SlashDirSize', () => {
    global.config.fileSystem.forEach(dir_name => {
      var dir_path = '/' + dir_name
      it(`Should pass if ${dir_name} not empty`, done => {
        fs.readdir(dir_path, (err, files) => {
          if (fs.existsSync(dir_path)) {
            if (err) {
              done(err)
            } else {
              assert.isAtLeast(files.length, 0, `$dir_name} is empty`)
              done()
            }
          } else {
            done(new Error(`${dir_path} Path not found`))
          }
        })
      })
    })
  })
})
