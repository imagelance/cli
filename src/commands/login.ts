import axios from 'axios'
import chalk from 'chalk'
import open from 'open'
import express from 'express'
import randomstring from 'randomstring'
import path from 'node:path'
import * as Sentry from '@sentry/node'
import Listr, {ListrContext, ListrTaskWrapper} from 'listr'
import {Flags} from '@oclif/core'

import BaseCommand from '../base-command'
import accountsUrl from '../utils/accounts-url'
import {setConfig, setUser} from '../utils/config-getters'
import {Token} from '../types/login'

export class Login extends BaseCommand {
	static description = 'Authorize CLI against web application'

	static flags = {
		debug: Flags.boolean({char: 'd', description: 'Debug mode', required: false, default: false}),
		local: Flags.boolean({char: 'l', description: 'Local', required: false, default: false}),
	}

	private OAuthClientId: string | null = null

	private OAuthClientSecret: string | null = null

	private RedirectURI: string | null = null

	private ExpressPort = 8050

	async run(): Promise<void> {
		const {flags} = await this.parse(Login)
		const {local, debug} = flags

		this.OAuthClientId = local ? '963b867a-f8a3-4abf-abc7-9b2cf27376eb' : '963bd29c-5162-4e81-b3c7-e6b22915d68e'
		this.OAuthClientSecret = local ? 'wCeDg2MlEkVURVpVPxxN1cq9R9qhBZcu2lXVK3eY' : 'EDBe481iZWGXk4hnOJUH9FcFqRu7yxzrjDYYj83x'
		this.RedirectURI = 'http://localhost:8050'
		this.ExpressPort = 8050

		const app = express()
		let token: Token | null = null

		app.get('/', async (req, res) => {
			const {code} = req.query

			if (!code) {
				return res.status(400).send('Unable to login')
			}

			try {
				const {data} = await axios.post(accountsUrl('oauth/token', false), {
					grant_type: 'authorization_code',
					code,
					redirect_uri: this.RedirectURI,
					client_id: this.OAuthClientId,
					client_secret: this.OAuthClientSecret,
				})

				token = data
			} catch (error: any) {
				return res.status(400).send(error.message)
			}

			return res.sendFile(path.join(__dirname, '../assets/success.html'))
		})

		const server = await app.listen(this.ExpressPort)

		if (debug) {
			console.log(chalk.green(`Listening on port ${this.ExpressPort}`))
		}

		const state = randomstring.generate({length: 40})
		const challenge = {
			client_id: this.OAuthClientId,
			redirect_uri: this.RedirectURI,
			response_type: 'code',
			scope: '',
			state,
		}

		const endpoint = `oauth/authorize?${(new URLSearchParams(challenge)).toString()}`
		const url: string = accountsUrl(endpoint, false)

		await open(url)
		console.log(chalk.green(`Opening browser ${url}`))

		const runner = new Listr([
			{
				title: 'Awaiting login in browser...',
				task: async (ctx: ListrContext, task: ListrTaskWrapper) => await new Promise<void>(resolve => {
					let checks = 0

					const checkInterval: ReturnType<typeof setInterval> = setInterval(async () => {
						if (debug) {
							task.title = `Awaiting login in browser... (${checks + 1}x)`
						}

						if (checks > 60) { // 2 minutes, check every 2 seconds
							clearInterval(checkInterval)
							throw new Error('Login timed out, please try again')
						}

						checks++

						if (token) {
							this.setToken(token)

							try {
								const {data: user} = await this.performRequest({
									url: accountsUrl('user'),
									method: 'GET',
								})

								setUser(user)

								task.title = chalk.green(`User ${user.email} successfully logged in`)

								clearInterval(checkInterval)
								resolve()
							} catch (error: any) {
								Sentry.captureException(error)

								if (debug) {
									this.reportError(error)
								}

								if (server) {
									await server.close()
								}

								await this.exitHandler(1)
							}
						}
					}, 2000)
				}),
			},
		])

		try {
			await runner.run()
		} catch (error: any) {
			Sentry.captureException(error)

			if (debug) {
				this.reportError(error)
			}
		}

		if (server) {
			await server.close()
		}
	}

	setToken(token: Token): void {
		setConfig('token', token)
	}
}
