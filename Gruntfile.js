const grunt = require("grunt");
grunt.loadNpmTasks("grunt-aws-lambda");

grunt.initConfig({
    lambda_invoke: {default: {}},
    lambda_deploy: {
        default: {
            arn: "arn:aws:lambda:us-east-1:246648750489:function:deploy-kubernetes-app",
            options: {
                region: "us-east-1",
                timeout: 5,
                memory: 128
            }
        }
    },
    lambda_package: {default: {}}
});

grunt.registerTask("deploy", [
    "lambda_package",
    "lambda_deploy"
]);

grunt.registerTask("invoke", "lambda_invoke");