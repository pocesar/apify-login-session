import { Page } from "puppeteer";
import { Request } from "apify";

// TODO: Use Object.fromEntries when it's well supported
/**
 * Transform entries (Array<[key, value]>) into an object.
 */
export const fromEntries = (
    entries: [string, string][]
): { [index: string]: string } =>
    entries.reduce((out, [key, value]) => ({ ...out, [key]: value }), {});

export const missingFromPage = (page: Page, request: Request) => async (
    selector: string,
    label: string
) => {
    if (!(await page.$(selector))) {
        request.noRetry = true;

        throw new Error(`Missing selector "${selector}" for "${label}"`);
    }

    return false;
};

export const focusAndType = async (
    page: Page,
    value: string,
    selector?: string
) => {
    if (!selector) {
        return;
    }

    await page.focus(selector);
    await page.type(selector, value, { delay: 30 });
};

/**
 * Wait for common page activity, such as redirecting,
 * AJAX requests after submitting a form, history.push / hash
 * change
 */
export const waitForPageActivity = (
    page: Page,
    parsedUrl: URL,
    timeout = 15000
) =>
    Promise.race([
        // for regular form POSTs, check if there's a redirect
        page.waitForNavigation({
            timeout,
            waitUntil: "networkidle2"
        }),
        // for SPAs, check if the url is changing (hash part, etc)
        page.waitForFunction(
            (cUrl: string) => {
                return document.location.href !== cUrl;
            },
            { timeout },
            parsedUrl.href
        ),
        // for AJAX in general, check for valid responses
        page.waitForResponse(
            response => {
                return (
                    response.status() < 400 &&
                    // same origin request, usually ajax
                    (response.url().includes(parsedUrl.hostname) ||
                        !!response.headers()?.["set-cookie"]) // cookie header presence
                );
            },
            {
                timeout
            }
        )
    ]);
