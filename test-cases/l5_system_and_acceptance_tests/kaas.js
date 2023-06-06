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
var expect = require('chai').expect
const k8s = require('@kubernetes/client-node')
const request = require('request')
var streamBuffers = require('stream-buffers')
var KAAS = require('./../../utils/kaas_utils')
var sleep = require('atomic-sleep')
var ipAddr = require('./../../utils/getNetworkAddress')

var IP = ipAddr()

const cluster = {
  name: 'test',
  server: config.specifications.kaasServicesAddress,
  skipTLSVerify: false
}

const user = {
  name: 'test',
  token: config.access_key
}

const context = {
  name: 'test',
  user: user.name,
  cluster: cluster.name,
  namespace: 'default'
}

const kc = new k8s.KubeConfig()
// kc.loadFromDefault();
kc.loadFromOptions({
  clusters: [cluster],
  users: [user],
  contexts: [context],
  currentContext: context.name
})

const statusApi = new k8s.V1Status()
const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
const nwAPi = kc.makeApiClient(k8s.NetworkingV1Api)
const exec = new k8s.Exec(kc)

function execCommand (namespace, pod, containername, command, timeout) {
  return new Promise(function (resolve, reject) {
    var result = ''
    var writeBuffer = new streamBuffers.WritableStreamBuffer({
      initialSize: 100 * 1024,
      incrementAmount: 10 * 1024
    })

    var readBuffer = new streamBuffers.ReadableStreamBuffer({
      frequency: 10,
      chunkSize: 2048
    })
    exec
      .exec(
        namespace,
        pod,
        containername,
        command,
        writeBuffer,
        writeBuffer,
        readBuffer,
        true,
        statusApi.status
      )
      .then(
        function (resp) {
          resp.on('message', function (data) {
            result += data
          })
          setTimeout(function () {
            resolve(result)
            // assert.include(result, '0 packets received', `Policy not working.`)
            // done()
          }, timeout)
        },
        function (err) {
          reject(err)
        }
      )
  })
}

describe('[Level 5] KAASTests', function () {
  describe('Kubeconfig', function () {
    it('Should return KAAS cluster info', function (done) {
      var clusters = kc.getClusters()
      expect(clusters.length).to.equal(1, 'Expecting one cluster')
      expect(clusters[0].name).to.equal(
        'test',
        `Cluster name "${clusters[0].name}" is not valid`
      )
      expect(clusters[0].server).to.equal(
        config.specifications.kaasServicesAddress,
        `Cluster server "${clusters[0].server}" is not valid`
      )
      expect(clusters[0].skipTLSVerify).to.equal(
        false,
        `Cluster skipTLSVerify is not false`
      )
      done()
    })

    it('Should return KAAS user info', function (done) {
      var users = kc.getUsers()
      expect(users[0].token).to.equal(
        config.access_key,
        `${users[0].token} is not valid`
      )
      expect(users[0].name).to.equal('test', `${users[0].name} is not valid`)
      done()
    })
    it('Should return KAAS contexts', done => {
      var contexts = kc.getContexts()
      expect(contexts[0].cluster).to.equal(
        'test',
        `Context cluster "${contexts[0].cluster}" is not valid`
      )
      expect(contexts[0].name).to.equal(
        'test',
        `Context name "${contexts[0].name}" is not valid`
      )
      expect(contexts[0].user).to.equal(
        'test',
        `Context user "${contexts[0].user}" is not valid`
      )
      expect(contexts[0].namespace).to.equal(
        'default',
        `Context namespace "${contexts[0].namespace}" is not valid`
      )
      done()
    })
  })
  describe('ClusterAndNode', function () {
    it('Should return true if cluster is up', function (done) {
      const opts = {}
      kc.applyToRequest(opts)
      request.get(
        `${kc.getCurrentCluster().server}/api/v1/namespaces/default/pods`,
        opts,
        (error, response, body) => {
          if (error) {
            throw new Error(error)
          } else {
            expect(response.statusCode).to.equal(
              200,
              `Return status Code: ${response.statusCode}`
            )
            done()
          }
        }
      )
    })
    it('Should return all nodes list object', async function () {
      await k8sApi.listNode().then(
        function (resp) {
          assert.isArray(resp.body.items)
        },
        function (err) {
          throw new Error(err)
        }
      )
    })
    it('Should return true if node status is up', async function () {
      await k8sApi.readNodeStatus(config.internal_id).then(
        function (resp) {
          assert.isObject(resp.response.body)
        },
        function (err) {
          throw new Error(
            err.response.body.message + '. Error code:' + err.response.body.code
          )
        }
      )
    })
  })
  describe('Pods', function () {
    it('Should return pod list', async function () {
      await k8sApi.listNamespacedPod('default').then(
        resp => {
          assert.isArray(resp.body.items)
        },
        function (err) {
          throw new Error(err)
        }
      )
    })
    it('Should return true if pod is created', async function () {
      await k8sApi
        .createNamespacedPod(
          'default',
          KAAS.podConfig(
            'test-hello-pod' + config.internal_id,
            config.internal_id
          )
        )
        .then(function (resp) {
          assert.isObject(resp.body)
        })
        .catch(function (err) {
          throw new Error(
            err.response.body.message + '. Error code:' + err.response.body.code
          )
        })
    })
    it('Should return pod status', async function () {
      this.retries(20)
      sleep(5000)
      await k8sApi
        .readNamespacedPod('test-hello-pod' + config.internal_id, 'default')
        .then(
          res => {
            if (res.body.status.phase.trim() != 'Running') {
              console.log(
                'Pod Status ' + res.body.status.phase.trim() + '. Retrying...'
              )
            }
            expect(res.body.status.phase.trim()).to.equal(
              'Running',
              `Pos Status: ${res.body.status.phase}`
            )
          },
          function (err) {
            throw new Error(
              err.response.body.message +
                '. Error code:' +
                err.response.body.code
            )
          }
        )
    })
    it('Should return pod logs', async function () {
      await k8sApi
        .readNamespacedPodLog('test-hello-pod' + config.internal_id, 'default')
        .then(
          res => {
            expect(res.body.trim()).to.equal(
              'hello',
              `Pos log: ${res.body} is not valid`
            )
          },
          function (err) {
            throw new Error(
              err.response.body.message +
                '. Error code:' +
                err.response.body.code
            )
          }
        )
    })
    it('Execute command on pod', async function () {
      await execCommand(
        'default',
        'test-hello-pod' + config.internal_id,
        'client',
        ['echo', 'QA pod is up'],
        2000
      ).then(
        function (resp) {
          assert.include(resp.trim(), 'QA pod is up', `${resp} is not matching`)
        },
        function (err) {
          throw new Error(err.message)
        }
      )
    })
    it('Should delete pod', async function () {
      await k8sApi
        .deleteNamespacedPod('test-hello-pod' + config.internal_id, 'default')
        .then(
          resp => {
            expect(resp.body.metadata.name.trim()).to.equal(
              'test-hello-pod' + config.internal_id,
              `${resp.body.metadata.name} is not deleted`
            )
          },
          function (err) {
            throw new Error(
              err.response.body.message +
                '. Error code:' +
                err.response.body.code
            )
          }
        )
    })
  })
  describe('NetworkPolicyController', function () {
    var podConfigs = {
      'cmd-test-pod': {
        type: 'internet-side-pod',
        label: {
          role: 'internet-pod'
        }
      },
      'perts-test-pod': {
        type: 'internal-pod',
        label: {
          role: 'internal-pod',
          mqtt: 'broker'
        }
      },
      'opc-ua-support-test-pod': {
        type: 'drive-side-pod',
        label: {
          role: 'drive-side-pod',
          mqtt: 'client'
        }
      }
    }

    Object.keys(podConfigs).forEach(function (podname) {
      it(`Should create NPC pod ${podname}(${podConfigs[podname].type})`, async function () {
        await k8sApi
          .createNamespacedPod(
            'default',
            KAAS.podConfig(
              podname + config.internal_id,
              config.internal_id,
              podConfigs[podname].label
            )
          )
          .then(function (resp) {
            assert.isObject(resp.body)
          })
          .catch(function (err) {
            throw new Error(
              err.response.body.message +
                '. Error code:' +
                err.response.body.code
            )
          })
      })
      it(`Should return NPC pod ${podname}(${podConfigs[podname].type}) status`, async function () {
        this.retries(20)
        sleep(5000)
        await k8sApi
          .readNamespacedPod(podname + config.internal_id, 'default')
          .then(
            res => {
              if (res.body.status.phase.trim() != 'Running') {
                console.log(
                  'Pod Status ' + res.body.status.phase.trim() + '. Retrying...'
                )
              }
              expect(res.body.status.phase.trim()).to.equal(
                'Running',
                `Pos Status: ${res.body.status.phase}`
              )
            },
            function (err) {
              throw new Error(
                err.response.body.message +
                  '. Error code:' +
                  err.response.body.code
              )
            }
          )
      })
    })
    var networkpolicies = [
      'drive-side-pod-policy',
      'internal-pod-policy',
      'internet-network-policy',
      'mqtt-broker-policy',
      'mqtt-client-policy'
    ]
    var policy
    networkpolicies.forEach(function (np) {
      it(`Should create ${np} policy`, async function () {
        if (np == 'drive-side-pod-policy') {
          policy = KAAS.driveSideNetworkPolicy(
            'drive-side-pod-policy' + config.internal_id
          )
        } else if (np == 'internal-pod-policy') {
          policy = KAAS.internalNetworkPoloicy(
            'internal-pod-policy' + config.internal_id
          )
        } else if (np == 'internet-network-policy') {
          policy = KAAS.internetNetworkPolicy(
            'internet-network-policy' + config.internal_id
          )
        } else if (np == 'mqtt-broker-policy') {
          policy = KAAS.MQTTBrokerNetworkPolicy(
            'mqtt-broker-policy' + config.internal_id
          )
        } else {
          policy = KAAS.MQTTClientNetworkPolicy(
            'mqtt-client-policy' + config.internal_id
          )
        }
        await nwAPi.createNamespacedNetworkPolicy('default', policy).then(
          function (resp) {
            expect(resp.response.statusCode).to.equal(
              201,
              `Not able to create network policy. Response: ${resp}`
            )
          },
          function (err) {
            throw new Error(
              err.response.body.message +
                '. Error code:' +
                err.response.body.code
            )
          }
        )
      })
    })
    it('Should return true if internet side pod can ping internet', async function () {
      var command = 'ping -c3 8.8.8.8'.split(' ')
      sleep(30000)
      await execCommand(
        'default',
        'cmd-test-pod' + config.internal_id,
        'client',
        command,
        20000
      ).then(
        function (resp) {
          assert.include(resp, '3 packets received', `Policy not working.`)
        },
        function (err) {
          throw new Error(err.message)
        }
      )
    })
    it('Should return true if internet side pod can not ping local network', async function () {
      var command = `ping -c3 ${IP}`.split(' ')
      await execCommand(
        'default',
        'cmd-test-pod' + config.internal_id,
        'client',
        command,
        20000
      ).then(
        function (resp) {
          assert.include(resp, '0 packets received', `Policy not working.`)
        },
        function (err) {
          throw new Error(err.message)
        }
      )
    })
    it('Should return true if internet side pod can not ping other pods', async function () {
      var command = `ping -c3 perts-test-pod${config.internal_id}`.split(
        ' '
      )
      await execCommand(
        'default',
        'cmd-test-pod' + config.internal_id,
        'client',
        command,
        20000
      ).then(
        function (resp) {
          assert.include(resp, '0 packets received', `Policy not working.`)
        },
        function (err) {
          throw new Error(err.message)
        }
      )
    })
    it('Should return true if drive side pod can not ping internet', async function () {
      var command = 'ping -c3 8.8.8.8'.split(' ')
      await execCommand(
        'default',
        'opc-ua-support-test-pod' + config.internal_id,
        'client',
        command,
        20000
      ).then(
        function (resp) {
          assert.include(resp, '0 packets received', `Policy not working.`)
        },
        function (err) {
          throw new Error(err.message)
        }
      )
    })
    it('Should return true if drive side pod can ping local network', async function () {
      var command = `ping -c3 ${IP}`.split(' ')
      await execCommand(
        'default',
        'opc-ua-support-test-pod' + config.internal_id,
        'client',
        command,
        20000
      ).then(
        function (resp) {
          assert.include(resp, '3 packets received', `Policy not working.`)
        },
        function (err) {
          throw new Error(err.message)
        }
      )
    })
    it('Should return true if drive side pod can not ping other pods', async function () {
      var command = `ping -c3 perts-test-pod${config.internal_id}`.split(
        ' '
      )
      await execCommand(
        'default',
        'opc-ua-support-test-pod' + config.internal_id,
        'client',
        command,
        20000
      ).then(
        function (resp) {
          assert.include(resp, '0 packets received', `Policy not working.`)
        },
        function (err) {
          throw new Error(err.message)
        }
      )
    })
    it('Should return true if internal pod can not ping internet', async function () {
      var command = 'ping -c3 8.8.8.8'.split(' ')
      await execCommand(
        'default',
        'perts-test-pod' + config.internal_id,
        'client',
        command,
        20000
      ).then(
        function (resp) {
          assert.include(resp, '0 packets received', `Policy not working.`)
        },
        function (err) {
          throw new Error(err.message)
        }
      )
    })
    it('Should return true if internal pod can not ping local network', async function () {
      var command = `ping -c3 ${IP}`.split(' ')
      await execCommand(
        'default',
        'perts-test-pod' + config.internal_id,
        'client',
        command,
        20000
      ).then(
        function (resp) {
          assert.include(resp, '0 packets received', `Policy not working.`)
        },
        function (err) {
          throw new Error(err.message)
        }
      )
    })
    it('Should return true if internal pod can not ping other pods', async function () {
      var command = `ping -c3 opc-ua-support-test-pod${
        config.internal_id
      }`.split(' ')
      await execCommand(
        'default',
        'perts-test-pod' + config.internal_id,
        'client',
        command,
        20000
      ).then(
        function (resp) {
          assert.include(resp, '0 packets received', `Policy not working.`)
        },
        function (err) {
          throw new Error(err.message)
        }
      )
    })
    Object.keys(podConfigs).forEach(function (pod) {
      it(`Should delete NPC pod ${pod}`, async function () {
        await k8sApi
          .deleteNamespacedPod(pod + config.internal_id, 'default')
          .then(
            resp => {
              expect(resp.body.metadata.name.trim()).to.equal(
                pod + config.internal_id,
                `${resp.body.metadata.name} is not deleted`
              )
            },
            function (err) {
              throw new Error(
                err.response.body.message +
                  '. Error code:' +
                  err.response.body.code
              )
            }
          )
      })
    })
    var hostNWPod = {
      name: 'host-nw-pod',
      type: 'internal-pod',
      label: {
        role: 'internal-pod'
      }
    }
    it('Create Pod with host network', async function () {
      await k8sApi
        .createNamespacedPod(
          'default',
          KAAS.podWithHostNW(
            hostNWPod.name + config.internal_id,
            config.internal_id,
            hostNWPod.label
          )
        )
        .then(function (resp) {
          assert.isObject(resp.body)
        })
        .catch(function (err) {
          throw new Error(
            err.response.body.message + '. Error code:' + err.response.body.code
          )
        })
    })
    it(`Should return hostnetwork pod ${
      hostNWPod['name']
    } status`, async function () {
      this.retries(20)
      sleep(5000)
      await k8sApi
        .readNamespacedPod(hostNWPod.name + config.internal_id, 'default')
        .then(
          res => {
            if (res.body.status.phase.trim() != 'Running') {
              console.log(
                'Pod Status ' + res.body.status.phase.trim() + '. Retrying...'
              )
            }
            expect(res.body.status.phase.trim()).to.equal(
              'Running',
              `Pos Status: ${res.body.status.phase}`
            )
          },
          function (err) {
            throw new Error(
              err.response.body.message +
                '. Error code:' +
                err.response.body.code
            )
          }
        )
    })
    it('Should return true if host network pod can ping internet', async function () {
      var command = 'ping -c3 8.8.8.8'.split(' ')
      await execCommand(
        'default',
        hostNWPod.name + config.internal_id,
        'client',
        command,
        20000
      ).then(
        function (resp) {
          assert.include(resp, '3 packets received', `Policy not working.`)
        },
        function (err) {
          throw new Error(err.message)
        }
      )
    })
    it(`Should delete host network pod ${hostNWPod.name}`, async function () {
      await k8sApi
        .deleteNamespacedPod(hostNWPod.name + config.internal_id, 'default')
        .then(
          resp => {
            expect(resp.body.metadata.name.trim()).to.equal(
              hostNWPod.name + config.internal_id,
              `${resp.body.metadata.name} is not deleted`
            )
          },
          function (err) {
            throw new Error(
              err.response.body.message +
                '. Error code:' +
                err.response.body.code
            )
          }
        )
    })
    networkpolicies.forEach(function (np) {
      it(`Should delete ${np} policy`, async function () {
        await nwAPi
          .deleteNamespacedNetworkPolicy(np + config.internal_id, 'default')
          .then(
            function (resp) {
              expect(resp.response.statusCode).to.equal(
                200,
                `Pos log: ${resp} is not valid`
              )
            },
            function (err) {
              throw new Error(
                err.response.body.message +
                  '. Error code:' +
                  err.response.body.code
              )
            }
          )
      })
    })
    var sameHostnamePodCOnfig = {
      'test-pod-1': {
        label: {
          role: 'test'
        }
      },
      'test-pod-2': {
        label: {
          role: 'test'
        }
      }
    }
    Object.keys(sameHostnamePodCOnfig).forEach(function (pod) {
      it(`Create Pod ${pod} with same hostname`, async function () {
        await k8sApi
          .createNamespacedPod(
            'default',
            KAAS.podWithFixHostname(
              pod + config.internal_id,
              config.internal_id,
              sameHostnamePodCOnfig[pod].label
            )
          )
          .then(function (resp) {
            assert.isObject(resp.body)
          })
          .catch(function (err) {
            throw new Error(
              err.response.body.message +
                '. Error code:' +
                err.response.body.code
            )
          })
      })
    })
    it(`Should return true if test-pod-1 is in running state`, async function () {
      this.retries(20)
      sleep(5000)
      await k8sApi
        .readNamespacedPod('test-pod-1' + config.internal_id, 'default')
        .then(
          res => {
            if (res.body.status.phase.trim() != 'Running') {
              console.log(
                'Pod Status ' + res.body.status.phase.trim() + '. Retrying...'
              )
            }
            expect(res.body.status.phase.trim()).to.equal(
              'Running',
              `Pos Status: ${res.body.status.phase}`
            )
          },
          function (err) {
            throw new Error(
              err.response.body.message +
                '. Error code:' +
                err.response.body.code
            )
          }
        )
    })
    it(`Should return true if test-pod-2 is in pending status state`, async function () {
      setTimeout(async function () {
        await k8sApi
          .readNamespacedPod('test-pod-2' + config.internal_id, 'default')
          .then(
            res => {
              if (res.body.status.phase.trim() != 'Pending') {
                console.log(
                  'Pod Status ' + res.body.status.phase.trim() + '. Retrying...'
                )
              }
              expect(res.body.status.phase.trim()).to.equal(
                'Pending',
                `Pos Status: ${res.body.status.phase}`
              )
            },
            function (err) {
              throw new Error(
                err.response.body.message +
                  '. Error code:' +
                  err.response.body.code
              )
            }
          )
      }, 10000)
    })
    it(`Should return true if test-pod-1 is deleted`, async function () {
      await k8sApi
        .deleteNamespacedPod('test-pod-1' + config.internal_id, 'default')
        .then(
          resp => {
            expect(resp.body.metadata.name.trim()).to.equal(
              'test-pod-1' + config.internal_id,
              `${resp.body.metadata.name} is not deleted`
            )
          },
          function (err) {
            throw new Error(
              err.response.body.message +
                '. Error code:' +
                err.response.body.code
            )
          }
        )
    })
    it(`Should return true if test-pod-2 is in running status state`, async function () {
      this.retries(60)
      sleep(5000)
      await k8sApi
        .readNamespacedPod('test-pod-2' + config.internal_id, 'default')
        .then(
          res => {
            if (res.body.status.phase.trim() != 'Running') {
              console.log(
                'Pod Status ' + res.body.status.phase.trim() + '. Retrying...'
              )
            }
            expect(res.body.status.phase.trim()).to.equal(
              'Running',
              `Pos Status: ${res.body.status.phase}`
            )
          },
          function (err) {
            throw new Error(
              err.response.body.message +
                '. Error code:' +
                err.response.body.code
            )
          }
        )
    })
    it(`Should return true if test-pod-2 is deleted`, async function () {
      await k8sApi
        .deleteNamespacedPod('test-pod-2' + config.internal_id, 'default')
        .then(
          resp => {
            expect(resp.body.metadata.name.trim()).to.equal(
              'test-pod-2' + config.internal_id,
              `${resp.body.metadata.name} is not deleted`
            )
          },
          function (err) {
            throw new Error(
              err.response.body.message +
                '. Error code:' +
                err.response.body.code
            )
          }
        )
    })
  })
})
