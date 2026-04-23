export interface TalkEvent {
	name: string;
	date: string;
	eventUrl: string;
	talkUrl?: string;
}

export interface TalkFrontmatter {
	title: string;
	description: string;
	audienceLevel?: string;
	sessionFormat?: string;
	events: TalkEvent[];
}
