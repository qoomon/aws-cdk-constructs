import {OpenIdConnectProvider, OpenIdConnectPrincipal} from "aws-cdk-lib/aws-iam";
import {Construct} from 'constructs';
import {Stack} from "aws-cdk-lib";
import {OpenIdConnectProviderProps} from "aws-cdk-lib/aws-iam/lib/oidc-provider";

export class GithubActionsIdentityProvider extends OpenIdConnectProvider {

    public static readonly issuerDomain: string = 'token.actions.githubusercontent.com';
    public static readonly issuerCertificateThumbprints: string[] = ['6938fd4d98bab03faadb97b34396831e3780aea1'];

    /**
     * Defines the GitHub OpenID Connect provider.
     * @param scope The definition scope
     * @param id Construct ID
     */
    constructor(scope: Construct, id: string) {
        super(scope, id, {
            url: `https://${GithubActionsIdentityProvider.issuerDomain}`,
            // Official AWS GitHub Action https://github.com/aws-actions/configure-aws-credentials set audience to `sts.amazonaws.com` by default
            // https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services#adding-the-identity-provider-to-aws
            clientIds: ['sts.amazonaws.com'],
            // TODO Can be removed as soon as following fix is released https://github.com/aws/aws-cdk/pull/22802
            thumbprints: GithubActionsIdentityProvider.issuerCertificateThumbprints,
        });
    }

    /**
     * Imports the GitHub OIDC provider defined in given scope account.
     *
     * An AWS account can only have one single GitHub OIDC provider configured.
     * Thw lookup ARN is constructed from account ID and GitHub Actions issuer domain.
     *
     * @param scope The definition scope
     * @param id ID of the construct
     */
    public static fromStackAccount(scope: Construct, id: string): GithubActionsIdentityProvider {
        const stack = Stack.of(scope);
        const providerArn = `arn:aws:iam::${stack.account}:oidc-provider/${this.issuerDomain}`;
        return OpenIdConnectProvider.fromOpenIdConnectProviderArn(scope, id, providerArn) as GithubActionsIdentityProvider;
    }
}


/**
 * A principal that represents the GitHub OpenID Connect provider.
 */
export class GithubActionsPrincipal extends OpenIdConnectPrincipal {
    /**
     *
     * @param githubIdentityProvider GitHub identity provider
     * @param trustedIdentities The trusted subject claims
     *      See https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect#example-subject-claims
     *      Examples:
     *          repo:<ownerName/repoName>:environment:<environmentName>
     *          repo:<ownerName/repoName>:ref:refs/heads/branchName
     *          repo:<ownerName/repoName>:ref:refs/tags/<tagName>
     *          repo:<ownerName/repoName>:pull_request
     *
     * @example
     * const githubActionsIdentityProvider = GithubActions.fromAccount(this, 'github-actions-identity-provider')
     * new Role(this, 'example-deploy-role', {
     *     roleName: 'example-deploy',
     *     assumedBy: new GithubActionsPrincipal(githubActionsIdentityProvider, [
     *         GithubActionsIdentity.fromEnvironment('example/sandbox', 'production')
     *     ])
     * });
     */
    constructor(githubIdentityProvider: GithubActionsIdentityProvider, trustedIdentities: GithubActionsIdentity[]) {
        super(githubIdentityProvider, {
            'StringEquals': {
                // Official AWS GitHub Action https://github.com/aws-actions/configure-aws-credentials set audience to `sts.amazonaws.com` by default
                // https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services#adding-the-identity-provider-to-aws'
                [`${GithubActionsIdentityProvider.issuerDomain}:aud`]: 'sts.amazonaws.com',
            },
            'ForAnyValue:StringLike': {
                [`${GithubActionsIdentityProvider.issuerDomain}:sub`]: trustedIdentities.map(it => it.subject)
            }
        });
    }
}

export class GithubActionsIdentity {
    /**
     * The repository
     *
     * @example
     * ownerName/repositoryName
     */
    readonly repository: string;

    readonly filter: string;


    constructor(repository: string, filter: string) {
        this.repository = repository;
        this.filter = filter;
    }

    get subject(): string {
        return `repo:${this.repository}:${this.filter}`
    }

    public static fromEnvironment(repository: string, environment: string): GithubActionsIdentity {
        return new GithubActionsIdentity(repository, `environment:${environment}`)
    }

    public static fromHeads(repository: string, branch: string): GithubActionsIdentity {
        return new GithubActionsIdentity(repository, `ref:refs/heads/${branch}`)
    }

    public static fromTags(repository: string, tag: string): GithubActionsIdentity {
        return new GithubActionsIdentity(repository, `ref:refs/tags/${tag}`)
    }

    public static fromPullRequest(repository: string): GithubActionsIdentity {
        return new GithubActionsIdentity(repository, 'pull_request')
    }
}
