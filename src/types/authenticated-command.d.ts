export interface User {
	id: number;
	invited_by_user_id: number | null;
	name: string;
	role: string;
	email: string;
	email_verified_at: string | null;
	current_team_id: number | null;
	profile_photo_path: string | null;
	company: string | null;
	phone: string | null;
	note: string | null;
	git_username: string | null;
	git_password: string | null;
	last_login_at: string | null;
	last_used_cli_at: string | null;
	last_used_devstack_at: string | null;
	created_at: string | null;
	updated_at: string | null;
	deleted_at: string | null;
	profile_photo_url: string | null;
}
