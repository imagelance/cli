export interface Sync {
	id: number;
	authorId: number;
	repo: string;
	organization: string;
	createdAt: string;
	updatedAt: string;
	deletedAt: string;
}

export interface Org {
	id: number;
	full_name: string;
	name: string;
	description: string;
	website: string;
	avatar_url: string;
}
