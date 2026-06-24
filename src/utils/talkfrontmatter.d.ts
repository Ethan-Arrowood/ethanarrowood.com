export interface TalkEvent {
	name: string;
	date: string;
	eventUrl: string;
	talkUrl?: string;
	videoUrl?: string;
	slidesUrl?: string;
}

export interface TalkFrontmatter {
	title: string;
	description: string;
	audienceLevel?: string;
	sessionFormat?: string;
	events: TalkEvent[];
}
