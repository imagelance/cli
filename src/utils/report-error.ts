export function reportError(error: any): void {
	if (error.response && error.response.data) {
		console.error(error.response.data);
	} else if (error.message) {
		console.error(error.message);
	} else {
		console.error(error);
	}
}
