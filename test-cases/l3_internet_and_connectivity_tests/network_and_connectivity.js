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
var dns = require('dns')

describe('[Level 3] NetworkAndConnectivityTests', () => {
    describe("#Network", () => {
        it('Should return true if internet is connected', (done) => {
            exec("ping -c 5 8.8.8.8 | grep 'packet loss'", (error, stdout, stderr) => {
                if(error) {
                    done(new Error(error))
                } else {
                    var internet_packet_arr = stdout.split(',')
                    assert.equal(parseInt(internet_packet_arr[0]), parseInt(internet_packet_arr[1]), "Transmitted packet not equals to received packet")
                    assert.equal(parseInt(internet_packet_arr[2]), 0, "Packet loss in network")
                    done()
                }
            })
        })
        it('Should return true if ip address is provided and internet is connected', (done) => {
            exec("ip route list | grep -Po 'dev \\K\\w+' | grep -qFf - /proc/net/wireless && echo wireless || echo wired", (error, stdout, stderr) => {
                if(error) {
                    done(new Error(error))
                } else {
                    var netInterface = Object.keys(require('os').networkInterfaces())
                    if(stdout.trim() == 'wired') {
                        assert.isAtLeast(netInterface.indexOf(config.interface.wired), 0, 'Not a valid wired interface')
                        done()
                    } else{
                        assert.isAtLeast(netInterface.indexOf(config.interface.wireless), 0, 'Not a valid wireless interface')
                        done()
                    }
                }
            })
        })
    })
    describe('#ConnectivityTests', () => {
        config.connectiveity_dns.forEach((lookup_url) => {
            it(`Should return true if ${lookup_url} is reachable`, (done) => {
                dns.lookup(`${lookup_url}`, (error, address) => {
                    if(error) {
                        done(new Error(error))
                    } else {
                        assert(address, lookup_url, `${lookup_url} is not valid`)
                        done()
                    }
                })
            })
        })
    })
})