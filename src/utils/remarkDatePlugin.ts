import type { RemarkPlugin } from "@astrojs/markdown-remark";

const formatter = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "long",
	day: "numeric",
	timeZone: "America/Denver",
});

function formatDate(date: Date | number) {
	return formatter.format(date);
}

export const remarkDatePlugin: RemarkPlugin = () => {
	return (_, file) => {
		if (file.data.astro?.frontmatter?.pubDate) {
			file.data.astro.frontmatter.pubDate = formatDate(
				file.data.astro.frontmatter.pubDate,
			);
		}

		if (file.data.astro?.frontmatter?.editDate) {
			file.data.astro.frontmatter.editDate = formatDate(
				file.data.astro.frontmatter.editDate,
			);
		}
	};
};
