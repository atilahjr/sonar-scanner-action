import * as core from '@actions/core';
import { context } from '@actions/github';
import { exec } from '@actions/exec';

function getBranchOrTagName(githubRef: string): string {
  const githubRefParts = githubRef.split('/');
  return githubRefParts[githubRefParts.length - 1];
}

export const sonarScanner = async () => {
  const projectName = core.getInput('projectName', { required: true });
  const projectKey = core.getInput('projectKey', { required: true });
  const baseDir = core.getInput('baseDir', { required: false });
  const token = core.getInput('token', { required: true });
  const url = core.getInput('url', { required: true });
  const scmProvider = core.getInput('scmProvider', { required: true });
  const sourceEncoding = core.getInput('sourceEncoding', { required: false });
  const enablePullRequestDecoration =
    core
      .getInput('enablePullRequestDecoration', { required: false })
      .toLowerCase() === 'true';
  const onlyConfig =
    core.getInput('onlyConfig', { required: false }).toLowerCase() === 'true';
  const isCommunityEdition =
    core.getInput('isCommunityEdition', {
      required: false,
    }) === 'true';
  const runQualityGate =
    core.getInput('runQualityGate', { required: false }) === 'true';
  const qualityGateTimeout = core.getInput('qualityGateTimeout', {
    required: false,
  });
  const organization = core.getInput('organization', { required: false });
  const extraArgs = core.getInput('extraArgs', { required: false });

  const sonarParameters: string[] = [
    `-Dsonar.login=${token}`,
    `-Dsonar.host.url=${url}`,
    `-Dsonar.projectKey=${projectKey}`,
    `-Dsonar.projectName=\'${projectName}\'`,
    `-Dsonar.scm.provider=${scmProvider}`,
    `-Dsonar.sourceEncoding=${sourceEncoding}`,
    `-Dsonar.qualitygate.wait=${runQualityGate}`,
  ];
  
  if (extraArgs && extraArgs.length > 0) {
    sonarParameters.push(`${extraArgs}`);
  }
  if (baseDir && baseDir.length > 0) {
    sonarParameters.push(`-Dsonar.projectBaseDir=${baseDir}`);
  }

  if (organization && organization.length > 0) {
    sonarParameters.push(`-Dsonar.organization=${organization}`);
  }

  if (qualityGateTimeout && !runQualityGate) {
    core.warning('\"runQualityGate\" not set, ignoring provided quality gate timeout');
  } else if (qualityGateTimeout && runQualityGate) {
    sonarParameters.push(`-Dsonar.qualitygate.timeout=${qualityGateTimeout}`)
  }

  core.info(`
    Using Configuration:

    ProjectName                 : ${projectName}
    ProjectKey                  : ${projectKey}
    BaseDir                     : ${baseDir}
    Token                       : ${token}
    URL                         : ${url}
    scmProvider                 : ${scmProvider}
    sourceEncoding              : ${sourceEncoding}
    enablePullRequestDecoration : ${enablePullRequestDecoration}
    onlyConfig                  : ${onlyConfig}
    isCommunityEdition          : ${isCommunityEdition}
    runQualityGate              : ${runQualityGate}
    qualityGateTimeout          : ${qualityGateTimeout}
    organization                : ${organization}
    extraArgs			: ${extraArgs}
  `);

  if (!isCommunityEdition) {
    const pr: any = context.payload.pull_request;
    if (!pr) {
      const branchName = getBranchOrTagName(context.ref);
      sonarParameters.push(`-Dsonar.branch.name=${branchName}`);
      core.info(`
      -- Configuration for branch:
         branchName               : ${branchName}
      `);
    }

    if (enablePullRequestDecoration && pr) {
      core.info(`
      -- Configuration for pull request decoration:
         Pull request number       : ${pr.number}
         Pull request branch       : ${pr.head.ref}
         Pull request base branch  : ${pr.base.ref}
      `);

      sonarParameters.push(`-Dsonar.pullrequest.key=${pr.number}`);
      sonarParameters.push(`-Dsonar.pullrequest.base=${pr.base.ref}`);
      sonarParameters.push(`-Dsonar.pullrequest.branch=${pr.head.ref}`);
    }
  }

  if (!onlyConfig) {
    core.startGroup('Running SonarQube');
    core.debug(
      `Running SonarQube with parameters: ${sonarParameters.join(', ')}`,
    );
    const errorCode = await exec('sonar-scanner', sonarParameters);

    if (errorCode === 1) {
      core.setFailed('SonarScanner failed.');
      throw new Error('SonarScanner failed');
    }

    core.endGroup();
  } else {
    core.info('Skipping running scanner.');
    core.setOutput('sonarParameters', sonarParameters.join(' '));
  }
};
