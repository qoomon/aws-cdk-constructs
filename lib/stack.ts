import {CliCredentialsStackSynthesizer, Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";

export class BaseStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, {
            ...props,
            synthesizer: props?.synthesizer || new CliCredentialsStackSynthesizer(),
            env: props?.env || {
                account: process.env.CDK_DEFAULT_ACCOUNT,
                region: process.env.CDK_DEFAULT_REGION,
            }
        })
    }
}
