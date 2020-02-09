import { Page } from "puppeteer";
import { Request } from "apify";
import { StepItem } from './definitions';

// TODO: Use Object.fromEntries when it's well supported
/**
 * Transform entries (Array<[key, value]>) into an object.
 */
export const fromEntries = (
    entries: [string, string][]
): { [index: string]: string } =>
    entries.reduce((out, [key, value]) => ({ ...out, [key]: value }), {});

export const missingFromPage = (page: Page, request: Request) => async (
    step: StepItem,
    label: string
) => {
    if (!step.timeout) {
        if (!(await page.$(step.selector))) {
            request.noRetry = true;

            throw new Error(
                `Missing selector "${step.selector}" for "${label}"`
            );
        }
    } else if (!(await page.$(step.selector))) {
        // only wait if the selector isn't on page
        try {
            await page.waitForSelector(step.selector, {
                timeout: step.timeout
            });
        } catch (e) {
            throw new Error(
                `Missing selector "${step.selector}" for "${label}" after ${step.timeout}ms timeout`
            );
        }
    }
};

/**
 * Find an input element on the page, focus then type on it
 */
export const focusAndType = (page: Page) => async (
    step: StepItem,
    value?: string
) => {
    if (!step.selector || !value) {
        return;
    }

    if (step.timeout && !(await page.$(step.selector))) {
        await page.waitForSelector(step.selector, {
            timeout: step.timeout
        });
    }

    await page.focus(step.selector);
    await page.type(step.selector, value, { delay: 30 });
};

/**
 * Wait for common page activity, such as redirecting,
 * AJAX requests after submitting a form, history.push / hash
 * change
 */
export const waitForPageActivity = (page: Page) => (
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
                        !!(response.headers()?.["set-cookie"])) // cookie header presence
                );
            },
            {
                timeout
            }
        )
    ]);
