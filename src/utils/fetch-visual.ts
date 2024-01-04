import fs from 'node:fs';
import path from 'node:path';
import simpleGit from 'simple-git';

import { getGitConfig, getGitOrigin } from './config-getters';

export async function fetchVisual(repoPath: string, brand: string, repoName: string) {
	const git = simpleGit(getGitConfig());

	if (!fs.existsSync(path.join(repoPath, '.git'))) {
		return null;
	}

	await git.cwd(repoPath);
	await git.removeRemote('origin');

	const origin = getGitOrigin(brand, repoName);

	await git.addRemote('origin', origin);
	await git.fetch();

	return git;
}
