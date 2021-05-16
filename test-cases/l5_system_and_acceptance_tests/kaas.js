// var exec = require('child_process').exec
var assert = require('chai').assert
var expect = require('chai').expect
const k8s = require('@kubernetes/client-node');
const request = require('request');
var streamBuffers = require('stream-buffers');
var KAAS = require('./../../utils/kaas_utils')

const cluster = {
    name: 'edge-qa',
    server: config.specifications.kaasServicesAddress,
    skipTLSVerify: false
};

const user = {
    name: 'edge-qa',
    token: config.access_key,
};

const context = {
    name: 'edge-qa',
    user: user.name,
    cluster: cluster.name,
    namespace: 'default'
};


const kc = new k8s.KubeConfig();
// kc.loadFromDefault();
kc.loadFromOptions({
    clusters: [cluster],
    users: [user],
    contexts: [context],
    currentContext: context.name,
});

const statusApi = new k8s.V1Status()
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const nwAPi = kc.makeApiClient(k8s.NetworkingV1Api)
const exec = new k8s.Exec(kc);

describe('#KAASTests', function() {
    describe('Kubeconfig', function() {
        it('Should return KAAS cluster info', function(done) {
            var clusters = kc.getClusters();
            expect(clusters.length).to.equal(1, 'Expecting one cluster');
            expect(clusters[0].name).to.equal('edge-qa', `Cluster name "${clusters[0].name}" is not valid`);
            expect(clusters[0].server).to.equal(config.specifications.kaasServicesAddress, `Cluster server "${clusters[0].server}" is not valid`);
            expect(clusters[0].skipTLSVerify).to.equal(false, `Cluster skipTLSVerify is not false`);
            done()
        })

        it('Should return KAAS user info', function(done) {
            var users = kc.getUsers();
            expect(users[0].token).to.equal(config.access_key, `${users[0].token} is not valid`);
            expect(users[0].name).to.equal('edge-qa', `${users[0].name} is not valid`);
            done()
        })
        it('Should return KAAS contexts', (done) => {
            var contexts = kc.getContexts();
            expect(contexts[0].cluster).to.equal('edge-qa', `Context cluster "${contexts[0].cluster}" is not valid`);
            expect(contexts[0].name).to.equal('edge-qa', `Context name "${contexts[0].name}" is not valid`);
            expect(contexts[0].user).to.equal('edge-qa', `Context user "${contexts[0].user}" is not valid`);
            expect(contexts[0].namespace).to.equal('default', `Context namespace "${contexts[0].namespace}" is not valid`);
            done()
        });
    })
    describe('ClusterAndNode', function(){
        it('Should return true is cluster is up', function(done) {
            const opts = {};
            kc.applyToRequest(opts);
            request.get(`${kc.getCurrentCluster().server}/api/v1/namespaces/default/pods`, opts,
                (error, response, body) => {
                    if (error) {
                        throw new Error(error)
                    } else{ 
                        expect(response.statusCode).to.equal(200, `Return status Code: ${response.statusCode}`)
                        done()
                    }
            });
        })
        it('Should return all nodes list object', async function() {
            await k8sApi.listNode().then(function(resp) {
                assert.isArray(resp.body.items)
            }, function(err) {
                throw new Error(err)
            })
        })
        it('Should return true if node status is up', async function() {
            await k8sApi.readNodeStatus(config.internal_id).then(function(resp) {
                assert.isObject(resp.response.body)
            }, function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            })         
        })
    })
    describe('Pods', function() {
        it('Should return pod list', async function() {            
            await k8sApi.listNamespacedPod('default').then((resp) => {
                assert.isArray(resp.body.items)
            }, function(err) {
                throw new Error(err)
            });        
        })
        it('Should return true if pod is created', async function(){
            await k8sApi.createNamespacedPod('default',KAAS.podConfig('edge-qa-hello-pod', config.internal_id)).then(function(resp) {
                assert.isObject(resp.body)
            }).catch(function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            })
        })
        it('Should return pod status', async function() {
            this.retries(10);
            await k8sApi.readNamespacedPod('edge-qa-hello-pod', 'default').then((res) => {
                if(res.body.status.phase.trim() != 'Running') {
                    console.log('Pod Status ' + res.body.status.phase.trim() + '. Retrying...')
                }
                expect(res.body.status.phase.trim()).to.equal('Running' , `Pos Status: ${res.body.status.phase}`)                
            }, function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            })        
        })
        it('Should return pod logs', async function() {
            await k8sApi.readNamespacedPodLog('edge-qa-hello-pod', 'default').then((res) => {
                expect(res.body.trim()).to.equal('hello' , `Pos log: ${res.body} is not valid`)                
            }, function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            });            
        })
        it('Execute command on pod', function(done) {
            var output = ''
            var writeBuffer = new streamBuffers.WritableStreamBuffer({
                initialSize: (100 * 1024),
                incrementAmount: (10 * 1024)
            });
            
            var readBuffer = new streamBuffers.ReadableStreamBuffer({
                frequency: 10,
                chunkSize: 2048
            });

            exec.exec('default','edge-qa-hello-pod', 'client', ['echo', 'QA pod is up'], writeBuffer, writeBuffer, readBuffer, true, statusApi.status).then(async function(resp) {
                resp.on('message', function(data) {
                    output += data.toString().replace('', '')
                })
                setTimeout(function() {
                    assert.include(output.trim(), 'QA pod is up', `${output} is not matching`)
                    done()
                }, 5000)
            }, function(err) {
                throw new Error(err.response.body.reason + ". Error code:" + err.response.body.code)
            })
        })
        it('Sould delete pod', async function() {
            await k8sApi.deleteNamespacedPod('edge-qa-hello-pod', 'default').then((resp) => {
                expect(resp.body.metadata.name.trim()).to.equal('edge-qa-hello-pod', `${resp.body.metadata.name} is not deleted`)
            }, function (err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            })
        })       
    })
    describe('NetworkPolicyController', function() {
        var npc_test_pod = [
            "edge-qa-pod-a",
            "edge-qa-pod-b"
        ]
        npc_test_pod.forEach(function(pod) {
            it(`Should create pod ${pod} for NPC`, async function() {
                if(pod == 'edge-qa-pod-a') {
                    label = 'edge-qa'
                } else {
                    label = 'edge-qa-test'
                }
                await k8sApi.createNamespacedPod('default',KAAS.podConfig(pod, config.internal_id, label)).then(function(resp) {
                    assert.isObject(resp.body)
                }).catch(function(err) {
                    throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
                })  
            })
        })
        npc_test_pod.forEach(function(pod) {
            it(`Should return NPC pod ${pod} status`, async function() {
                this.retries(10);
                await k8sApi.readNamespacedPod(pod, 'default').then((res) => {
                    if(res.body.status.phase.trim() != 'Running') {
                        console.log('Pod Status ' + res.body.status.phase.trim() + '. Retrying...')
                    }
                    expect(res.body.status.phase.trim()).to.equal('Running' , `Pos Status: ${res.body.status.phase}`)                
                }, function(err) {
                    throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
                })        
            })
        })
        it('Should apply deny egress network policy', async function() {
            await nwAPi.createNamespacedNetworkPolicy('default', KAAS.denyEgressNetworkPolicy('deny-egress-edge-qa-policy', 'edge-qa')).then(function(resp) {
                expect(resp.response.statusCode).to.equal(201 , `Not able to create network policy. Response: ${resp}`)
            }, function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            }) 
        })
        it('Should return deny egress network policy status', async function() {
            await nwAPi.readNamespacedNetworkPolicy('deny-egress-edge-qa-policy', 'default').then(function(resp) {
                expect(resp.response.statusCode).to.be.equal(200, `Not able to get network policy: ${resp.response.statusCode}`)
                expect(resp.response.statusMessage.trim()).to.be.equal("OK", `Not able to get network policy: ${resp.response.statusCode}`)
            }, function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            }) 
        })
        it('Should return true if Ping Pod-a to Pod-b not working for egress network policy', function(done) {
            var result = ''
            var writeBuffer = new streamBuffers.WritableStreamBuffer({
                initialSize: (100 * 1024),
                incrementAmount: (10 * 1024)
            });
            
            var readBuffer = new streamBuffers.ReadableStreamBuffer({
                frequency: 10,
                chunkSize: 2048
            });
            exec.exec('default','edge-qa-pod-a', 'client', ['ping', '-c3', 'edge-qa-pod-b'], writeBuffer, writeBuffer, readBuffer, true, statusApi.status).then(function(resp) {
                resp.on('message', function(data) {
                    result += data
                })
                setTimeout(function() {
                    assert.include(result, '0 packets received', `Egress policy did not applied`)
                    done()
                }, 20000)
            }, function(err) {
                console.log(err)
                throw new Error(err.response.body.reason + ". Error code:" + err.response.body.code)
            })
        })
        it('Should return true if Ping Pod-b to Pod-a not working for egress network policy', function(done) {
            var result = ''
            var writeBuffer = new streamBuffers.WritableStreamBuffer({
                initialSize: (100 * 1024),
                incrementAmount: (10 * 1024)
            });
            
            var readBuffer = new streamBuffers.ReadableStreamBuffer({
                frequency: 10,
                chunkSize: 2048
            });
            exec.exec('default','edge-qa-pod-b', 'client', ['ping', '-c3', 'edge-qa-pod-a'], writeBuffer, writeBuffer, readBuffer, true, statusApi.status).then(function(resp) {
                resp.on('message', function(data) {
                    result += data
                })
                setTimeout(function() {
                    assert.include(result, '3 packets received', `Egress policy did not applied`)
                    done()
                }, 20000)
            }, function(err) {
                console.log(err)
                throw new Error(err.response.body.reason + ". Error code:" + err.response.body.code)
            })
        })
        it('Should delete deny-ingress-edge-qa-policy network policy', async function() {
            await nwAPi.deleteNamespacedNetworkPolicy('deny-egress-edge-qa-policy', 'default').then(function(resp) {
                expect(resp.response.statusCode).to.equal(200 , `Pos log: ${resp} is not valid`)
            }, function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            })
        })
        it('Should apply deny egress network policy', async function() {
            await nwAPi.createNamespacedNetworkPolicy('default', KAAS.denyIngressNetworkPolicy('deny-ingress-edge-qa-policy', 'edge-qa')).then(function(resp) {
                expect(resp.response.statusCode).to.equal(201 , `Not able to create network policy. Response: ${resp}`)
            }, function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            }) 
        })
        it('Should return deny ingress network policy status', async function() {
            await nwAPi.readNamespacedNetworkPolicy('deny-ingress-edge-qa-policy', 'default').then(function(resp) {
                expect(resp.response.statusCode).to.be.equal(200, `Not able to get network policy: ${resp.response.statusCode}`)
                expect(resp.response.statusMessage.trim()).to.be.equal("OK", `Not able to get network policy: ${resp.response.statusCode}`)
            }, function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            }) 
        })
        it('Should return true if Ping Pod-a to Pod-b not working for ingress network policy', function(done) {
            var result = ''
            var writeBuffer = new streamBuffers.WritableStreamBuffer({
                initialSize: (100 * 1024),
                incrementAmount: (10 * 1024)
            });
            
            var readBuffer = new streamBuffers.ReadableStreamBuffer({
                frequency: 10,
                chunkSize: 2048
            });
            exec.exec('default','edge-qa-pod-a', 'client', ['ping', '-c3', 'edge-qa-pod-b'], writeBuffer, writeBuffer, readBuffer, true, statusApi.status).then(function(resp) {
                resp.on('message', function(data) {
                    result += data
                })
                setTimeout(function() {
                    assert.include(result, '3 packets received', `Ingress policy did not applied`)
                    done()
                }, 20000)
            }, function(err) {
                console.log(err)
                throw new Error(err.response.body.reason + ". Error code:" + err.response.body.code)
            })
        })
        it('Should return true if Ping Pod-b to Pod-a not working for ingress network policy', function(done) {
            var result = ''
            var writeBuffer = new streamBuffers.WritableStreamBuffer({
                initialSize: (100 * 1024),
                incrementAmount: (10 * 1024)
            });
            
            var readBuffer = new streamBuffers.ReadableStreamBuffer({
                frequency: 10,
                chunkSize: 2048
            });
            exec.exec('default','edge-qa-pod-b', 'client', ['ping', '-c3', 'edge-qa-pod-a'], writeBuffer, writeBuffer, readBuffer, true, statusApi.status).then(function(resp) {
                resp.on('message', function(data) {
                    result += data
                })
                setTimeout(function() {
                    assert.include(result, '0 packets received', `Ingress policy did not applied`)
                    done()
                }, 20000)
            }, function(err) {
                console.log(err)
                throw new Error(err.response.body.reason + ". Error code:" + err.response.body.code)
            })
        })
        it('Should delete deny-ingress-edge-qa-policy network policy', async function() {
            await nwAPi.deleteNamespacedNetworkPolicy('deny-ingress-edge-qa-policy', 'default').then(function(resp) {
                expect(resp.response.statusCode).to.equal(200 , `Pos log: ${resp} is not valid`)
            }, function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            })
        })
        it('Should apply deny-egress-ingress-edge-qa-policy network policy', async function() {
            await nwAPi.createNamespacedNetworkPolicy('default', KAAS.denyEngressIngressNetworkPolicy('deny-egress-ingress-edge-qa-policy', 'edge-qa')).then(function(resp) {
                expect(resp.response.statusCode).to.equal(201 , `Not able to create network policy. Response: ${resp}`)
            }, function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            }) 
        })
        it('Should return deny-egress-ingress-edge-qa-policy network policy status', async function() {
            await nwAPi.readNamespacedNetworkPolicy('deny-egress-ingress-edge-qa-policy', 'default').then(function(resp) {
                expect(resp.response.statusCode).to.be.equal(200, `Not able to get network policy: ${resp.response.statusCode}`)
                expect(resp.response.statusMessage.trim()).to.be.equal("OK", `Not able to get network policy: ${resp.response.statusCode}`)
            }, function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            }) 
        })
        it('Should return true if Ping Pod-a to Pod-b not working for deny-egress-ingress-edge-qa-policy network policy', function(done) {
            var result = ''
            var writeBuffer = new streamBuffers.WritableStreamBuffer({
                initialSize: (100 * 1024),
                incrementAmount: (10 * 1024)
            });
            
            var readBuffer = new streamBuffers.ReadableStreamBuffer({
                frequency: 10,
                chunkSize: 2048
            });
            exec.exec('default','edge-qa-pod-a', 'client', ['ping', '-c3', 'edge-qa-pod-b'], writeBuffer, writeBuffer, readBuffer, true, statusApi.status).then(function(resp) {
                resp.on('message', function(data) {
                    result += data
                })
                setTimeout(function() {
                    assert.include(result, '0 packets received', `Ingress policy did not applied`)
                    done()
                }, 20000)
            }, function(err) {
                console.log(err)
                throw new Error(err.response.body.reason + ". Error code:" + err.response.body.code)
            })
        })
        it('Should return true if Ping Pod-b to Pod-a not working for deny-egress-ingress-edge-qa-policy network policy', function(done) {
            var result = ''
            var writeBuffer = new streamBuffers.WritableStreamBuffer({
                initialSize: (100 * 1024),
                incrementAmount: (10 * 1024)
            });
            
            var readBuffer = new streamBuffers.ReadableStreamBuffer({
                frequency: 10,
                chunkSize: 2048
            });
            exec.exec('default','edge-qa-pod-b', 'client', ['ping', '-c3', 'edge-qa-pod-a'], writeBuffer, writeBuffer, readBuffer, true, statusApi.status).then(function(resp) {
                resp.on('message', function(data) {
                    result += data
                })
                setTimeout(function() {
                    assert.include(result, '0 packets received', `Ingress policy did not applied`)
                    done()
                }, 20000)
            }, function(err) {
                console.log(err)
                throw new Error(err.response.body.reason + ". Error code:" + err.response.body.code)
            })
        })
        it('Should delete deny-egress-ingress-edge-qa-policy network policy', async function() {
            await nwAPi.deleteNamespacedNetworkPolicy('deny-egress-ingress-edge-qa-policy', 'default').then(function(resp) {
                expect(resp.response.statusCode).to.equal(200 , `Pos log: ${resp} is not valid`)
            }, function(err) {
                throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
            })
        })
        npc_test_pod.forEach(function(pod) {
            it(`Should delete NPC pod ${pod}`, async function() {
                await k8sApi.deleteNamespacedPod(pod, 'default').then((resp) => {
                    expect(resp.body.metadata.name.trim()).to.equal(pod, `${resp.body.metadata.name} is not deleted`)
                }, function (err) {
                    throw new Error(err.response.body.message + ". Error code:" + err.response.body.code)
                })
            }) 
        })
    })
}) 