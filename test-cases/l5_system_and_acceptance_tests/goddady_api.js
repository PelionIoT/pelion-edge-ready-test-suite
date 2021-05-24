// // Should match the kubeconfig file format exactly

// const cluster = {
//     cluster:{
//         server: 'https://edge-k8s.mbedcloudintegration.net',
//     },
//     name: 'edge-qa'
// };

// const user = {
//     name: 'edge-qa',
//     user: {
//         token: 'ak_2MDE2ZjMyNzE0ZDhhZjJiNzQ4NTJkMmE4MDAwMDAwMDA017931cd3c09b2045feb9e7900000000U36FJbSeqNB70by3GuTVyDYzNChmFOoD',
//     }
// };

// const context = {
//     context: {
//         user: user.name,
//         cluster: cluster.name,
//         namespace: 'default'
//     },
//     name: 'edge-qa'
// };

// const config = {
//   apiVersion: 'v1',
//   clusters: [cluster],
//   contexts: [context],
//   kind: 'Config',
//   users: [user]
// }
// const { KubeConfig } = require('kubernetes-client')
// const kubeconfig = new KubeConfig()
// kubeconfig.loadFromString(JSON.stringify(config))

// const Request = require('kubernetes-client/backends/request')
// const backend = new Request({ kubeconfig })
// const client = new Client({ backend, version: '1.13' })

const Client = require('kubernetes-client').Client
const config = require('kubernetes-client/backends/request').config

async function main () {
  try {
    const client = new Client({ version: '1.13' })

    let node_status = await client.api.v1.nodes('0179238efa59c6cd6c230b9000000000').status.get()
    console.log(node_status.body)

    let pod = await client.api.v1.namespaces('default').pods.post({
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {
          "name": "edge-qa-hello-pod-1",
          "labels": {
            "app": "edge-qa"
          }
        },
        "spec": {
          "automountServiceAccountToken": false,
          "hostname": "edge-qa-hello-pod-1",
          "nodeName": "0179238efa59c6cd6c230b9000000000",
          "containers": [
            {
              "name": "client",
              "image": "alpine:3.9",
              "command": [
                "/bin/sh"
              ],
              "args": [
                "-c",
                "echo 'hello'; sleep 6000000"
              ]
            }
          ]
        }
      })

    console.log(pod)

    let status = await client.api.v1.namespaces('default').pods('edge-qa-hello-pod-1').status.get()
    console.log(status.body)

    // let create_nw = await client.apis.networking.v1.namespaces('default')
    // .k8s.io.v1.namespaces('default').networkpolicies.post({
    //     "apiVersion": "networking.k8s.io/v1",
    //     "kind": "NetworkPolicy",
    //     "metadata": {
    //       "name": "default-deny-egress-1"
    //     },
    //     "spec": {
    //       "podSelector": {
    //         "matchLabels": {
    //           "app": "edge-qa"
    //         }
    //       },
    //       "policyTypes": [
    //         "Egress",
    //         "Ingress"
    //       ]
    //     }
    //   })
    // console.log(create_nw)
    // Pod with single container
    let res = await client.api.v1.namespaces('default').pods('edge-qa-hello-pod-1').exec.post({
      qs: {
        command: ['ls', '-al'],
        stdout: true,
        stderr: true
      }
    })
    console.log(res.body)
    console.log(res.messages)

    // Pod with multiple containers /must/ specify a container
    // res = await client.api.v1.namespaces('default').pods('edge-qa-hello-pod-1').exec.post({
    //   qs: {
    //     command: ['ls', '-al'],
    //     container: 'default',
    //     stdout: true,
    //     stderr: true
    //   }
    // })
    // console.log(res.body)
  } catch (err) {
    console.error('Error: ', err)
  }
}

main()
