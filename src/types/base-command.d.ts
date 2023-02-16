import { CancelTokenSource } from 'axios';

export interface CancelTokens {
	[key: string]: CancelTokenSource;
}
