import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as ecr from 'aws-cdk-lib/aws-ecr-assets';


export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const APP_PORT = 3000
    const pathToDockerFile = "../www"

    const vpc = new ec2.Vpc(this, "NextJsFargateVpc", {
      maxAzs: 2,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "NextJsFargateTaskDefinition", {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    const dockerFile = new ecr.DockerImageAsset(this, 'DockerFileAsset', {
      directory: pathToDockerFile,
      file: 'Dockerfile',
    });

    // cdk will build it and push it to en ecr repository
    const image = ecs.ContainerImage.fromDockerImageAsset(dockerFile);

    const container = taskDefinition.addContainer("NextJsFargateContainer", {
      image,
      // store the logs in cloudwatch 
      logging: ecs.LogDriver.awsLogs({ streamPrefix: "myexample-logs" })
    });

    container.addPortMappings({
      containerPort: APP_PORT, 
    });

    const cluster = new ecs.Cluster(this, "NextJsFargateECSCluster", {
      clusterName: "NextJsFargateECSCluster",
      containerInsights: true,
      vpc,
    });

    const securityGroup = new ec2.SecurityGroup(this, `NextJsFargate-security-group`, {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'NextJsFargate Security Group'
    });

    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(APP_PORT));

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'NextJsFargateFargateService', {
      cluster,
      publicLoadBalancer: true,
      cpu: 256,
      desiredCount: 1,
      memoryLimitMiB: 512,
      taskDefinition,
      securityGroups: [securityGroup]
    })

    const scalableTarget = fargateService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 2
    })

    scalableTarget.scaleOnCpuUtilization('cpuScaling', {
      targetUtilizationPercent: 70
    })
  }
}
