module.exports.podConfig = (podname, nodename, label = {"app": "test"}, containername = "client", conatinerimage = "alpine:3.9") => {
    return {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {
          "name": podname,
          "labels": label
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

module.exports.denyEgressNetworkPolicy = (policyname, label = "test") => {
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

module.exports.denyIngressNetworkPolicy = (policyname, label = "test") => {
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

module.exports.denyEngressIngressNetworkPolicy = (policyname, label = "test") => {
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

module.exports.denyEngressIngressNetworkPolicy = (policyname, label = "test") => {
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

module.exports.denyEngressIngressNetworkWithEgressCIDRPolicy = (policyname, label = "test") => {
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
      ],
      "egress": [
        {
          "to": [
            {
              "ipBlock": {
                "cidr": "0.0.0.0/0"
              }
            }
          ]
        }
      ]
    }
  }
}

module.exports.internetNetworkPolicy = () => {
  return {
    "apiVersion": "networking.k8s.io/v1",
    "kind": "NetworkPolicy",
    "metadata": {
      "name": "internet-network-policy"
    },
    "spec": {
      "podSelector": {
        "matchLabels": {
          "role": "internet-pod"
        }
      },
      "policyTypes": [
        "Egress",
        "Ingress"
      ],
      "egress": [
        {
          "to": [
            {
              "ipBlock": {
                "cidr": "0.0.0.0/0",
                "except": [
                  "10.240.0.0/24",
                  "10.0.2.0/24",
                  "192.168.100.0/24"
                ]
              }
            }
          ]
        }
      ]
    }
  }
}

module.exports.driveSideNetworkPolicy = () => {
  return {
    "apiVersion": "networking.k8s.io/v1",
    "kind": "NetworkPolicy",
    "metadata": {
      "name": "drive-side-pod-policy"
    },
    "spec": {
      "podSelector": {
        "matchLabels": {
          "role": "drive-side-pod"
        }
      },
      "policyTypes": [
        "Egress",
        "Ingress"
      ],
      "egress": [
        {
          "to": [
            {
              "ipBlock": {
                "cidr": "10.240.0.0/24"
              }
            }
          ]
        }
      ]
    }
  }
}

module.exports.internalNetworkPoloicy = () => {
  return {
    "apiVersion": "networking.k8s.io/v1",
    "kind": "NetworkPolicy",
    "metadata": {
      "name": "internal-pod-policy"
    },
    "spec": {
      "podSelector": {
        "matchLabels": {
          "role": "internal-pod"
        }
      },
      "policyTypes": [
        "Egress",
        "Ingress"
      ]
    }
  }
}

module.exports.MQTTBrokerNetworkPolicy = () => {
  return {
    "apiVersion": "networking.k8s.io/v1",
    "kind": "NetworkPolicy",
    "metadata": {
      "name": "mqtt-broker-policy"
    },
    "spec": {
      "podSelector": {
        "matchLabels": {
          "mqtt": "broker"
        }
      },
      "policyTypes": [
        "Ingress"
      ],
      "ingress": [
        {
          "from": [
            {
              "podSelector": {
                "matchLabels": {
                  "mqtt": "client"
                }
              }
            }
          ],
          "ports": [
            {
              "protocol": "TCP",
              "port": 1883
            }
          ]
        }
      ]
    }
  }
}

module.exports.MQTTClientNetworkPolicy = () => {
  return {
    "apiVersion": "networking.k8s.io/v1",
    "kind": "NetworkPolicy",
    "metadata": {
      "name": "mqtt-client-policy"
    },
    "spec": {
      "podSelector": {
        "matchLabels": {
          "mqtt": "client"
        }
      },
      "policyTypes": [
        "Egress"
      ],
      "egress": [
        {
          "to": [
            {
              "podSelector": {
                "matchLabels": {
                  "mqtt": "broker"
                }
              }
            }
          ],
          "ports": [
            {
              "protocol": "TCP",
              "port": 1883
            }
          ]
        }
      ]
    }
  }
}