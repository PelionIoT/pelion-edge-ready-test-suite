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
* [Level 2] Service and program validation testcases for pelion edge
*/
var assert = require('chai').assert
var exec = require('child_process').exec
var compareVersions = require('compare-versions')
var fs = require("fs")

describe('[Level 2] ServicesAndProgramExistanceTests', () => {
    describe("#ProgramVersion", () => {
        it('Should return true if valid maestro version is present', (done) => {
            exec("maestro --version | grep -Po '(?<=maestro )\\d.\\d.\\d'", (error, stdout, stderr) => {
                if(error) {
                    done(error)
                } else {
                    assert.equal(compareVersions.compare(stdout.trim(), config.program_version.maestro, '>='), true, "Maestro version not valid")
                    done()
                }
            })
        })
        it('Should return true if valid docker version is present', (done) => {
            exec("docker --version | cut -d',' -f1 | awk '{print $3}'", (error, stdout, stderr) => {
                if(error) {
                    done(error)
                } else {
                    assert.equal(compareVersions.compare(stdout.trim(), config.program_version.docker, '>='), true, "Docker version not valid")
                    done()
                }
            })
        })
        it('Should return true if valid openssl version is present', (done) => {
            exec("openssl version | cut -d'g' -f1 | awk '{print $2}' | tr -d a", (error, stdout, stderr) => {
                if(error) {
                    done(error)
                } else {
                    assert.equal(compareVersions.compare(stdout.trim(), config.program_version.openssl, '>='), true, "SSL version not valid")
                    done()
                }
            })
        })
        it('Should return true if valid openssh version is present', (done) => {
            exec("ssh -V", (error, stdout, stderr) => {
                if(error) {
                    done(error)
                } else {
                    assert.equal(stderr.split(',')[0], config.program_version.openssh, "SSH version not valid")
                    done()
                }
            })
        })
        it('Should return true if valid node version is present', (done) => {
            exec("node --version | cut -c2-9", (error, stdout, stderr) => {
                if(error) {
                    done(error)
                } else {
                    assert.equal(compareVersions.compare(stdout.trim(), config.program_version.node, '>='), true, "Node version not valid")
                    done()
                }
            })
        })
        it('Should return true if valid edge-core version is present', (done) => {
            var edge_core_path = config.binary_path.edge_core
            exec(`${edge_core_path} --version | cut -d'-' -f1`, (error, stdout, stderr) => {
                if(error) {
                    done(error)
                } else {
                    assert.equal(compareVersions.compare(stdout.trim(), config.program_version.edge_core, '>='), true, "Edge core version not valid")
                    done()
                }
            })
        })
        it('Should return true if valid kernel version is present', (done) => {
            exec("uname -r | cut -d'-' -f1", (error, stdout, stderr) => {
                if(error) {
                    done(error)
                } else {
                    assert.equal(compareVersions.compare(stdout.trim(), config.program_version.kernel, '>='), true, "Kernel version not valid")
                    done()
                }
            })
        })
        it('Should return true if valid Fluent-bit version is present', (done) => {
            exec("td-agent-bit --version | awk '{print $3}' | cut -c2-6", (error, stdout, stderr) => {
                if(error) {
                    done(error)
                } else {
                    assert.equal(compareVersions.compare(stdout.trim(), config.program_version["td-agent-bit"], '>='), true, "Fluent-bit version not valid")
                    done()
                }
            })
        })
    })
    describe('#ServiceStatus', () => {
        config.services.forEach((service_name) => {
            it(`Should return true if ${service_name} is running`, (done) => {
                exec(`systemctl status ${service_name}`, (error, stdout, stderr) => {
                    if(error) {
                        done(error)
                    } else {
                        assert.include(stdout.trim(), 'active (running)', `${service_name} is not running`)
                        done()
                    }
                })
            })
        })
    })
    describe('#DriversExistance', () => {
        config.drivers.forEach((driver) => {
            var dir_path = `${config.drivers_path}/${driver}`
            it(`Should pass if driver ${driver} exists`, (done) => {
                assert.equal(fs.existsSync(dir_path), true, `${dir_path} not exist`);
                done()
            })
        })
    })
})
