export interface Frontmatter {
	title: string;
	pubDate: string;
	editDate: string;
	description: string;
	noindex?: boolean;
	/** Record key of the post's site.standard.document record. */
	standardSiteRkey?: string;
}
