var exec = require('child_process').exec
var assert = require('chai').assert
var expect = require('chai').expect
const k8s = require('@kubernetes/client-node');
const request = require('request');

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

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

describe('#KAASTests', function() {
    var kaas_services = [
        "kubelet",
        "coredns",
        "edge-proxy",
        "kube-router"
    ]
    // describe('#KAASServices', function() {
    //     kaas_services.forEach(function(Service) {
    //         if (global.config.edge_build_type == 'snap') {
    //             system_service = 'snap'
    //             status = 'services'
    //         } else {
    //             system_service = 'systemctl'
    //             status = 'status'
    //         }
    //         it(`Should return true if ${Service} is stopped`, function (done) {
    //             if (global.config.edge_build_type == 'snap') {
    //               cmd = `sudo ${system_service} stop ${Service} && ${system_service} ${status} ${Service}`
    //             } else {
    //               cmd = `sudo ${system_service} mask ${Service} && sudo ${system_service} stop ${Service} && ${system_service} ${status} ${Service}`
    //             }
    //             exec(cmd, (err, stdout) => {
    //               assert.include(stdout.trim(), 'inactive', 'Service did not stopped')
    //               done()
    //             })
    //           })
    //           it(`Should return true if ${Service} is started`, function (done) {
    //             if (global.config.edge_build_type == 'snap') {
    //               cmd = `sudo ${system_service} start ${Service} && ${system_service} ${status} ${Service}`
    //             } else {
    //               cmd = `sudo ${system_service} unmask ${Service} && sudo ${system_service} start ${Service} && ${system_service} ${status} ${Service}`
    //             }
    //             exec(cmd, (err, stdout) => {
    //               assert.include(stdout.trim(), 'active', 'Service did not started')
    //               done()
    //             })
    //           })
    //           it(`Should return true if ${Service} is restarted`, function (done) {
    //             exec(
    //               `sudo ${system_service} restart ${Service} && ${system_service} ${status} ${Service}`,
    //               (err, stdout) => {
    //                 assert.include(stdout.trim(), 'active', 'Service did not restarted')
    //                 done()
    //               }
    //             )
    //           })
    //         // it(`Check services ${kaas_service}`, function() {
    
    //         // })
    //     })    
    // })
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
    describe('ClsuterAndNode', function(){
        it('Should return true is cluster is up', function(done) {
            const opts = {};
            kc.applyToRequest(opts);
            request.get(`${kc.getCurrentCluster().server}/api/v1/namespaces/default/pods`, opts,
                (error, response, body) => {
                    if (error) {
                        done(new Error(error))
                    }
                    if (response) {
                        expect(response.statusCode).to.equal(200, `Return status Code: ${response.statusCode}`)
                        done()
                    }
            });
        })
        it('Should return true if node is up', function(done) {
            k8sApi.readNode('0179238efa59c6cd6c230b9000000000').then(function(resp) {
                expect(resp.body.metadata.name).to.equal(config.internal_id, `${resp.body.metadata.name} is not valid`)
                done()
            }, function(err) {
                done(new Error(err))
            })
            
        })
    })
    describe('Pods', function() {
        it('Should return pod list', function(done) {            
            k8sApi.listNamespacedPod('default').then((res) => {
                assert.isArray(res.body.items, "Not a array")
                done()
            }, function(err) {
                done(new Error(err))
            });
            
        })
        it('Should return true if pod is created', function(done){
            k8sApi.createNamespacedPod('default',{
                apiVersions: 'v1',
                kind: 'Pod',
                metadata: { name: `edge-test-1` },
                spec: {
                  automountServiceAccountToken: false,
                  hostname: 'edge-qa-hello-pod',
                  nodeName: '0179238efa59c6cd6c230b9000000000',
                  containers: [{
                    name: `client`,
                    image: 'alpine:3.9',
                    command: ["/bin/sh"],
                    args: ["-c","echo 'hello'; sleep 6000000"]
                  }],
                }
              }).then(function(resp) {
                expect(resp.response.statusCode).to.equal(201, `Return Status code: ${resp.response.statusCode}`)
                done()
              } ,(err) => {
                done(err)
              })
        })
        it('Should return pod status', function(done) {
            k8sApi.readNamespacedPod('edge-test-1', 'default').then((res) => {
                expect(res.body.status.phase.trim()).to.equal('Running' , `Pos Status: ${res.body.status.phase}`)                
                done()
            }, function(error) {
                done(new Error(error))
            });            
        })
        it('Should return pod logs', function(done) {
            k8sApi.readNamespacedPodLog('edge-test-1', 'default').then((res) => {
                expect(res.body.trim()).to.equal('hello' , `Pos log: ${res.body} is not valid`)                
                done()
            }, function(error) {
                done(new Error(error))
            });            
        })
        it('Sould delete pod', function(done) {
            k8sApi.deleteNamespacedPod('edge-test-1', 'default').then((resp) => {
                expect(resp.body.metadata.name).to.equal('edge-test-1', `${resp.body.metadata.name} is not deleted`)
                done()
            }, (err) => {
                done(err)
            })
        })
       
    })
}) 