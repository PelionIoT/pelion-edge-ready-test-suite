module.exports.podConfig = (podname, nodename, label = "edge-qa", containername = "client", conatinerimage = "alpine:3.9") => {
    return {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {
          "name": podname,
          "labels": {
            "app": label
          }
        },
        "spec": {
          "automountServiceAccountToken": false,
          "hostname": podname,
          "nodeName": nodename,
          "containers": [
            {
              "name": containername,
              "image": conatinerimage,
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
    }
}

module.exports.denyEgressNetworkPolicy = (policyname, label = "edge-qa") => {
    return {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {
            "name": policyname,
        },
        "spec": {
            "podSelector": {
                "matchLabels": {
                    "app": label
                }
            },
            "policyTypes": [
                "Egress",
            ]
        }
    }
}

module.exports.denyIngressNetworkPolicy = (policyname, label = "edge-qa") => {
    return {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {
            "name": policyname
        },
        "spec": {
            "podSelector": {
                "matchLabels": {
                    "app": label
                }
            },
            "policyTypes": [
                "Ingress"
            ]
        }
    }   
}

module.exports.denyEngressIngressNetworkPolicy = (policyname, label = "edge-qa") => {
    return {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {
            "name": policyname
        },
        "spec": {
            "podSelector": {
                "matchLabels": {
                    "app": label
                }
            },
            "policyTypes": [
                "Egress",
                "Ingress"
            ]
        }
    } 
}

module.exports.denyEngressIngressNetworkPolicy = (policyname, label = "edge-qa") => {
    return {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {
          "name": policyname,
          "namespace": "default"
        },
        "spec": {
          "podSelector": {
            "matchLabels": {
              "app": label
            }
          },
          "policyTypes": [
            "Ingress",
            "Egress"
          ]
        }
      }
}