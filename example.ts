import {Stack, StackProps} from "aws-cdk-lib";
import {Construct} from 'constructs';
import {Role} from "aws-cdk-lib/aws-iam";
import {GithubActionsIdentityProvider, GithubActionsPrincipal, GithubActionsIdentity} from "./lib/github-actions";

export class ExampleStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // const githubActionsIdentityProvider = new GithubActionsIdentityProvider(this, 'github-actions-identity-provider');
        const githubActionsIdentityProvider = GithubActionsIdentityProvider.fromStackAccount(this, 'github-actions-identity-provider')

        new Role(this, 'example-deploy-role', {
            roleName: 'example-deploy',
            assumedBy: new GithubActionsPrincipal(githubActionsIdentityProvider, [
                GithubActionsIdentity.fromEnvironment('example/sandbox', 'production')
            ])
        });
    }
}
