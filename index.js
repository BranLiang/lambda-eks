var AWS = require('aws-sdk')
var k8s = require('@kubernetes/client-node');
var fs = require('fs')
var yaml = require('js-yaml')
var kc = require('./kube_client')
var client = kc.makeApiClient(k8s.Extensions_v1beta1Api);
var patchClient = kc.makeApiClient(k8s.Apps_v1Api);
patchClient.defaultHeaders = {'Content-Type': 'application/strategic-merge-patch+json'}

exports.handler = async (event, context) => {
  var codepipeline = new AWS.CodePipeline();
  var jobId = event["CodePipeline.job"].id;
  var keyName = event['CodePipeline.job'].data.actionConfiguration.configuration.UserParameters

  /* Helper methods */
  var putJobSuccess = (message) => {
    var params = {
      jobId: jobId
    };
    return codepipeline.putJobSuccessResult(params, (err, data) => {
      if(err) {
        context.fail(err);
      } else {
        console.log(mesage);
        context.succeed(message);
      }
    });
  };

  var putJobFailure = (message) => {
    var params = {
      jobId: jobId,
      failureDetails: {
        message: JSON.stringify(message),
        type: 'JobFailed',
        externalExecutionId: context.invokeid
      }
    };
    return codepipeline.putJobFailureResult(params, (err, data) => {
      console.log(message);
      context.fail(message);
    });
  };

  var ecr = new AWS.ECR()

  /* Get latest image tag */
  var imageParams = {
    repositoryName: keyName,
    filter: { tagStatus: 'TAGGED' }
  }
  let repoImages
  try {
    repoImages = await ecr.describeImages(imageParams).promise()
  }
  catch (err) {
    console.log(err);
    putJobFailure(`Error fetching images for repository ${keyName}`)
  } 
  var sortedImages = repoImages.imageDetails.sort((a, b) => {
    return b.imagePushedAt - a.imagePushedAt;
  })
  var latestImage = sortedImages[0]
  if (!latestImage) {
    putJobFailure(`Missing images for repository ${keyName}`)
  }
  var latestImageTag = latestImage.imageTags[0]

  /* Get repository URI */
  var repoParams = {
    repositoryNames: [ keyName ]
  }
  let repoData
  try {
    repoData = await ecr.describeRepositories(repoParams).promise()
  }
  catch (err) {
    console.log(err);
    putJobFailure(`Error fetching repository ${keyName} detail`)
  }
  var targetRepo = repoData.repositories[0]
  if (!targetRepo) {
    putJobFailure(`Missing repository for name ${keyName}`)
  }
  var repoURI = targetRepo.repositoryUri

  /* FINAL IMAGE URI */
  var imageUri = `${repoURI}:${latestImageTag}`

  /* Prepare kubernetes client */
  return client.listNamespacedDeployment('default')
    .then((res) => {
      var deployments = res.body.items
      var existDeployment = deployments.find((item) => {
        return item.metadata.name === keyName
      })

      /* Already deployed, update the deployment */
      if (existDeployment !== undefined) {
        return patchClient.patchNamespacedDeployment(keyName, 'default', {
          spec: {
            template: {
              spec: {
                containers: [
                  {
                    name: keyName,
                    image: imageUri
                  }
                ]
              }
            }
          }
        })
        .then(() => {
          console.log('Patch success');
          return putJobSuccess("Deploy success.");
        })
        .catch((err) => {
          console.log(err); 
          return putJobFailure(err)
        })
      } else {
        /* Create a new deployment */
        var raw = fs.readFileSync('./deploy-first', 'utf8')

        raw = raw.replace(/\$EKS_DEPLOYMENT_NAME/g, keyName)
        raw = raw.replace(/\$DEPLY_IMAGE/g, imageUri)

        var deployConfig = yaml.safeLoad(raw)

        return client.createNamespacedDeployment('default', deployConfig)
          .then(() => {
            console.log('success');
            return putJobSuccess("Deploy success.");
          })
          .catch((err) => {
            console.log(err);
            return putJobFailure(err)
          })
      }
    })
    .catch((err) => {
      console.log(err);
      return putJobFailure(err)
    })
}