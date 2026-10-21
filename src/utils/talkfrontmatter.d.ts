export interface TalkEvent {
	name: string;
	date: string;
	eventUrl: string;
	talkUrl?: string;
	videoUrl?: string;
	slidesUrl?: string;
}

// A version of a talk's deck that isn't tied to an event, such as a new
// edition in development.
export interface TalkEdition {
	name: string;
	slidesUrl: string;
	draft?: boolean;
}

export interface TalkFrontmatter {
	title: string;
	description: string;
	audienceLevel?: string;
	sessionFormat?: string;
	events?: TalkEvent[];
	editions?: TalkEdition[];
}
