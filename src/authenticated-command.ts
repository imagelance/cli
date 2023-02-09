import BaseCommand from './base-command'
import accountsUrl from './utils/accounts-url'
import {setUser} from './utils/config-getters'
import {User} from './types/authenticated-command'

export default abstract class AuthenticatedCommand extends BaseCommand {
	protected user: User | null = null

	async init(): Promise<void> {
		await super.init()

		try {
			const {data: user} = await this.performRequest({
				url: accountsUrl('user'),
				method: 'GET',
			})

			this.user = user as User

			setUser(this.user)
		} catch (error: any) {
			// ToDo: attempt to refresh token
			this.reportError(error)

			return this.exitHandler(1)
		}
	}
}
