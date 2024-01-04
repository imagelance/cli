export interface Sync {
	createdAt: string;
	deletedAt: string;
	id: number;
	organization: string;
	repo: string;
	updatedAt: string;
	userId: number;
}

export interface Org {
	avatar_url: string;
	description: string;
	full_name: string;
	id: number;
	name: string;
	website: string;
}
