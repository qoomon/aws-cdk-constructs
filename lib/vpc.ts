import {Fn, Stack} from "aws-cdk-lib";
import {AclCidr, AclTraffic, Action, NetworkAcl, Vpc, VpcProps} from "aws-cdk-lib/aws-ec2";
import {AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId} from "aws-cdk-lib/custom-resources";
import {Construct} from "constructs";

export class BaseVpc extends Vpc {
    constructor(scope: Construct, id: string, props?: VpcProps) {
        super(scope, id, props);
        // Configure default security group according to "CIS AWS Foundations Benchmark controls",
        // section "4.3 – Ensure the default security group of every VPC restricts all traffic".
        // See https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-cis-controls-4.3
        const stack = Stack.of(this);
        const vpcDefaultSecurityGroupArn = stack.formatArn({
            service: 'ec2',
            resource: 'security-group',
            resourceName: this.vpcDefaultSecurityGroup,
        });

        const customResourceServiceRolePolicy = AwsCustomResourcePolicy.fromSdkCalls({resources: [vpcDefaultSecurityGroupArn]})
        const customResourcePhysicalResourceId = PhysicalResourceId.of(`${this.vpcId}/${this.vpcDefaultSecurityGroup}`)

        new AwsCustomResource(this, "RevokeDefaultSecurityGroupIngressRulesAction", {
            resourceType: "Custom::RevokeDefaultSecurityGroupIngressRules",
            onCreate: {
                service: "EC2",
                action: "revokeSecurityGroupIngress",
                // ignoreErrorCodesMatching: 'InvalidPermission\\.NotFound',
                parameters: {
                    GroupId: this.vpcDefaultSecurityGroup,
                    IpPermissions: [{
                        IpProtocol: '-1', // all protocols
                        UserIdGroupPairs: [{GroupId: this.vpcDefaultSecurityGroup}],
                    }],
                },
                physicalResourceId: customResourcePhysicalResourceId,
            },
            policy: customResourceServiceRolePolicy,
        });

        new AwsCustomResource(this, "RevokeDefaultSecurityGroupEgressRulesAction", {
            resourceType: "Custom::RevokeDefaultSecurityGroupEgressRules",
            onCreate: {
                service: "EC2",
                action: "revokeSecurityGroupEgress",
                // ignoreErrorCodesMatching: 'InvalidPermission\\.NotFound',
                parameters: {
                    GroupId: this.vpcDefaultSecurityGroup,
                    IpPermissions: [{
                        IpProtocol: '-1', // all protocols
                        IpRanges: [{CidrIp: "0.0.0.0/0"}],
                    }],
                },
                physicalResourceId: customResourcePhysicalResourceId,
            },
            policy: customResourceServiceRolePolicy,
        });

        const defaultNetworkAcl = NetworkAcl.fromNetworkAclId(this, "DefaultNetworkAcl", this.vpcDefaultNetworkAcl);
        let ruleNumber = 100; // default rule numbers start at 100

        defaultNetworkAcl.addEntry('DenyInboundSshIpv4NetworkAclEntry', {
            ruleNumber: --ruleNumber,
            ruleAction: Action.DENY,
            cidr: AclCidr.anyIpv4(),
            traffic: AclTraffic.tcpPort(22), // SSH
        });
        defaultNetworkAcl.addEntry('DenyInboundRdpIpv4NetworkAclEntry', {
            ruleNumber: --ruleNumber,
            ruleAction: Action.DENY,
            cidr: AclCidr.anyIpv4(),
            traffic: AclTraffic.tcpPort(3389), // RDP
        });
    }
}