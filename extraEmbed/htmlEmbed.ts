import { editor } from "$sb/silverbullet-syscall/mod.ts";
import type { WidgetContent } from "$sb/app_event.ts";


// a bit ugly function; ChatGPT helped here. So feel free to rewrite :)
function extractScripts(htmlString: string): { inlineScripts: string[], scriptSrcs: string[], htmlWithoutScripts: string } {
  // Regular expression to match script tags and capture their content
  const scriptTagRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;

  // Regular expression to extract src attribute from script tag
  const scriptSrcRegex = /<script.*?src=["'](.*?)["'].*?>.*?<\/script>/i;

  // Regular expression to extract the contents of a script tag
  const scriptContentRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/i;

  // Extract script contents and src attributes
  let match: RegExpExecArray | null;
  const inlineScripts: string[] = [];
  const scriptSrcs: string[] = [];
  while ((match = scriptTagRegex.exec(htmlString)) !== null) {
    const scriptTag = match[0];
    const srcMatch = scriptSrcRegex.exec(scriptTag);
    if (srcMatch && srcMatch[1]) {
      // Script tag with src attribute
      scriptSrcs.push(srcMatch[1]);
    } else {
      // Inline script
      const contentMatch = scriptContentRegex.exec(scriptTag);
      if (contentMatch && contentMatch[1]) {
        inlineScripts.push(contentMatch[1].trim());
      }
    }
  }

  // Remove script tags from the HTML string
  const htmlWithoutScripts = htmlString.replace(scriptTagRegex, '');

  // Return the extracted script contents, src attributes, and modified HTML
  return { inlineScripts, scriptSrcs, htmlWithoutScripts };
}


export async function htmlEmbed(
    bodyText: string,
): Promise<WidgetContent> {
  // https://github.com/silverbulletmd/silverbullet/blob/8448a578fc59ed2ff607bd39bbd01c7ba1710e78/web/components/panel_html.ts
  const result = extractScripts(bodyText);

  const externalScriptLoaders = result.scriptSrcs.map(src=> `loadJsByUrl(${JSON.stringify(src)})`);
  // There seems to be a race condition in Tailwind CDN Play. e.g. if including
  // <script src="https://cdn.tailwindcss.com/3.4.1"></script> it works in maybe 1 of 20 cases,
  // so very rarely. I figured out that https://github.com/beyondcode/tailwindcss-jit-cdn is very
  // likely the predecessor of the ("closed source") cdn.tailwindcss.com; and then reverse engineered
  // that I need to change a tailwind Config to force-initialize Tailwind.
  // => this is what we do here if we find Tailwind CSS :)
  const convertedScript =
      `Promise.all([${externalScriptLoaders.join(', ')}]).then(() => {
        if (window.tailwind && window.tailwind.config) {
          window.tailwind.config["hack_force_refresh"] = (new Date()).getTime();
        }
      });`
      + result.inlineScripts.join(";");

  //console.log(convertedScript);

  return {
    html: result.htmlWithoutScripts,
    script: convertedScript
  };
}
