export interface Endpoint {
	method: string;
	url: string;
}

export interface Endpoints {
	[key: string]: Endpoint;
}
