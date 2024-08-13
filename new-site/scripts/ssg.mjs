import fs from 'node:fs';
import path from 'node:path';
import { Parser } from 'parse5';
import enhance from '@enhance/ssr';

function ExperienceItem({ html, state }) {
    const { attrs } = state
    const { greeting='Hello World' } = attrs;
    return html`
        <li class="mb-8 ms-4 last:mb-0">
            <div class="absolute -start-1.5 h-3 w-3 rounded-full border border-emerald-700 bg-emerald-700 md:h-3.5 md:w-3.5"></div>
            <p class="mb-1 text-xs font-normal leading-none text-gray-400 md:text-sm md:leading-none">${date}</p>
            <h3 class="text-sm font-semibold text-gray-900 md:text-base">${title}</h3>
            <ol class="min-w-0 list-inside list-disc text-xs font-normal text-gray-500 md:text-sm">
                <slot name="description"></slot>
            </ol>
        </li>
    `
}
const html = enhance({
    bodyContent: true,
    elements: {
        'experience-item': ExperienceItem
    }
})

console.log(html`<hello-world></hello-world>`)

// function buildPage(templatePath, outputPath) {
//     const template = fs.readFileSync(templatePath);
//     const html = compileTemplate(template);
//     fs.writeFileSync(outputPath, html);
// }

// function compileTemplate(template) {
//     const doc = new Parser().parse(template);
//     const templates = doc.querySelectorAll('template');

//     templates.forEach(template => {
//         const shadowRoot = document.createElement('div').attachShadow({ mode: 'open' });
//         shadowRoot.innerHTML = tempalte.innerHTML;
//         template.parentNode.replaceChild(shadowRoot, template);
//     });

//     return doc.documentElement.outerHTML;
// }

// buildPage('./../site/experience-item.html', './../site/out.html')