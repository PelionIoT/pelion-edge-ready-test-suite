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
var randomstring = require('randomstring')
const fs = require('fs')
const yaml = require('js-yaml')
var sleep = require('atomic-sleep')
var cm_name = 'test-cm' + randomstring.generate({ charset: 'hex' })
var secret_name = 'test-secret' + randomstring.generate({ charset: 'hex' })
var pod_name = 'test-pod' + randomstring.generate({ charset: 'hex' })
var Logger = require('./utils/logger')
var logger = new Logger({ moduleName: '', color: 'yellow' })

describe('[Level 4] KAASTests', () => {
  describe('#Cluster and node', () => {
    it('Check cluster status', function (done) {
      exec('kubectl cluster-info', (error, stdout) => {
        if (error) {
          done(error)
        } else {
          assert.include(
            stdout.trim(),
            'Kubernetes',
            'Kubernetes cluster is not reachable'
          )
          assert.include(
            stdout.trim(),
            'is running',
            'Kubernetes cluster is not reachable'
          )
          done()
        }
      })
    })
    it('Check kubernetes node status', function (done) {
      exec(`kubectl get node ${global.config.internal_id}`, (error, stdout) => {
        if (error) {
          done(error)
        } else {
          assert.include(stdout.trim(), 'Ready', 'Node is not ready')
          assert.notInclude(stdout.trim(), 'NotReady', 'Node is not ready')
          done()
        }
      })
    })
    it('Create pod', function (done) {
      let fileContents = fs.readFileSync('conf/test_pod.yaml', 'utf8')
      let data = yaml.loadAll(fileContents)
      data[0]['metadata']['name'] = cm_name
      let yamlStr = yaml.dump(data[0])
      fs.writeFileSync('cm.yaml', yamlStr, 'utf8')

      data[1]['metadata']['name'] = secret_name
      yamlStr = yaml.dump(data[1])
      fs.writeFileSync('secret.yaml', yamlStr, 'utf8')

      data[2]['metadata']['name'] = pod_name
      data[2]['spec']['containers'][0]['env'][0]['valueFrom'][
        'configMapKeyRef'
      ]['name'] = cm_name
      data[2]['spec']['containers'][0]['env'][1]['valueFrom']['secretKeyRef'][
        'name'
      ] = secret_name
      data[2]['spec']['nodeName'] = global.config.internal_id
      data[2]['spec']['volumes'][0]['configMap']['name'] = cm_name
      data[2]['spec']['volumes'][1]['secret']['secretName'] = secret_name
      yamlStr = yaml.dump(data[2])
      fs.writeFileSync('pod.yaml', yamlStr, 'utf8')

      exec(`kubectl create -f cm.yaml`)
      exec(`kubectl create -f secret.yaml`)
      sleep(1000)
      exec('kubectl create -f pod.yaml')
      setTimeout(() => {
        exec(`kubectl get pod ${pod_name}`, (error, stdout) => {
          this.retries(60)
          logger.info('Waiting for pod to be created')
          sleep(1000)
          if (error) {
            done(error)
          } else {
            if (stdout.includes('Running')) {
              assert.include(stdout.trim(), 'Running', 'Pod is not running')
              done()
            } else done(stdout.trim())
          }
        })
      }, 20000)
    })
    it('Verify pod logs', function (done) {
      exec(`kubectl logs ${pod_name}`, (error, stdout) => {
        if (error) {
          done(error)
        } else {
          assert.include(
            stdout.trim(),
            'pod is running',
            'Pod is not giving correct logs'
          )
          done()
        }
      })
    })
    it('Delete KAAS resources', function (done) {
      exec(`kubectl delete configmap ${cm_name}`)
      exec(`kubectl delete secret ${secret_name}`)
      exec(`kubectl delete pod ${pod_name}`)
      setTimeout(() => {
        exec(`kubectl get pod ${pod_name}`, (error, stdout) => {
          this.retries(60)
          logger.info('Waiting for pod to be deleted')
          sleep(1000)
          if (error) {
            done()
          } else {
            if (stdout.includes('NotFound')) {
              assert.include(stdout.trim(), 'NotFound', 'Pod is not deleted')
              done()
            } else {
              done(stdout.trim())
            }
          }
        })
      }, 20000)
    })
  })
})
