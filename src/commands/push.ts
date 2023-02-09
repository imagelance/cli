import path from 'node:path'
import fs from 'node:fs'
import simpleGit from 'simple-git'
import inquirer from 'inquirer'
import chalk from 'chalk'
import * as Sentry from '@sentry/node'
import {Flags} from '@oclif/core'
import Listr, {ListrContext, ListrTask, ListrTaskWrapper} from 'listr'

import AuthenticatedCommand from '../authenticated-command'
import getDirectories from '../utils/get-directories'
import {getRoot} from '../utils/config-getters'

export class Push extends AuthenticatedCommand {
	static description = 'Push all local templates'

	static flags = {
		debug: Flags.boolean({char: 'd', description: 'Debug mode', required: false, default: false}),
	}

	async run(): Promise<void> {
		const {flags} = await this.parse(Push)
		const {debug} = flags

		const root: string = getRoot()
		const git = simpleGit()
		const brandFolders: string[] = await getDirectories(path.join(root, 'src'))
		const tasks: ListrTask[] = []
		const changedVisuals: any[] = []
		const brands: string[] = brandFolders.filter((folder: string) => {
			return folder[0] !== '.'
		})

		for (const brandIndex in brands) {
			if (!brands.hasOwnProperty(brandIndex)) {
				continue
			}

			const brand: string = brands[brandIndex]
			const visualFolders: string[] = await getDirectories(path.join(root, 'src', brand))
			const visuals: string[] = visualFolders.filter((folder: string) => {
				return folder[0] !== '.'
			})

			for (const visualIndex in visuals) {
				if (!visuals.hasOwnProperty(visualIndex)) {
					continue
				}

				const visual: string = visuals[visualIndex]
				const visualPath: string = path.join(root, 'src', brand, visual)

				try {
					await git.cwd(visualPath)

					const status = await git.status()

					if (status.files.length === 0) {
						continue
					}

					changedVisuals.push({
						name: `${visual} (Changed ${status.files.length} files)`,
						value: visualPath,
						checked: true,
					})
				} catch (error: any) {
					Sentry.captureException(error)

					if (debug) {
						this.reportError(error)
					}
				}
			}
		}

		const visualChoices = {
			type: 'checkbox',
			name: 'selectedVisuals',
			message: 'Select templates to be pushed',
			choices: changedVisuals,
		}

		const visualAnswers = await inquirer.prompt([visualChoices])
		const {selectedVisuals} = visualAnswers

		for (const visualPath of selectedVisuals) {
			// ToDo: prompt commit message?
			tasks.push({
				title: chalk.blue(`Pushing "${visualPath}"...`),
				task: async (ctx: ListrContext, task: ListrTaskWrapper) => await this.push(visualPath, task),
			})
		}

		if (tasks.length === 0) {
			console.log(chalk.red('No templates selected'))
			await this.exitHandler(1)
		}

		const runner = new Listr(tasks, {
			concurrent: true,
			exitOnError: false,
			renderer: debug ? 'verbose' : 'default',
		})

		try {
			await runner.run()
		} catch (error) {
			Sentry.captureException(error)

			if (debug) {
				this.reportError(error)
			}
		}
	}

	async push(visualPath: string, task: ListrTaskWrapper): Promise<void> {
		const git = simpleGit()

		if (!fs.existsSync(path.join(visualPath, '.git'))) {
			return
		}

		await git.cwd(visualPath)

		await git.add('./*')
		await git.commit('Changes')
		await git.push('origin', 'master')

		task.title = chalk.green(`Pushed "${visualPath}"`)
	}
}
