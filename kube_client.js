const k8s = require('@kubernetes/client-node');
const kc = new k8s.KubeConfig();
const fs = require('fs')

var raw = fs.readFileSync('./config', 'utf8')

/* Input values */
raw = raw.replace(/\$TOKEN/g, process.env.EKS_TOKEN)
raw = raw.replace(/\$EKS_CA/g, process.env.EKS_CA)
raw = raw.replace(/\$EKS_CLUSTER_HOST/g, process.env.EKS_CLUSTER_HOST)
raw = raw.replace(/\$EKS_CLUSTER_NAME/g, process.env.EKS_CLUSTER_NAME)
raw = raw.replace(/\$EKS_CLUSTER_USER_NAME/g, process.env.EKS_CLUSTER_USER_NAME)

kc.loadFromString(raw)

module.exports = kc