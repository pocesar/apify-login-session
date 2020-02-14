"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// TODO: Use Object.fromEntries when it's well supported
/**
 * Transform entries (Array<[key, value]>) into an object.
 */
exports.fromEntries = (entries) => {
    return entries.reduce((out, [key, value]) => ({
        ...out,
        [key]: value
    }), {});
};
/**
 * Checks for the existence or waits for it to be available
 * depending on user input for "timeout".
 *
 * Throws a descriptive error with the label if it's missing
 */
exports.throwIfMissing = async (page, step, label) => {
    if (!step.timeoutMillis) {
        if (!(await page.$(step.selector))) {
            throw new Error(`Missing selector "${step.selector}" for "${label}"`);
        }
    }
    else if (!(await page.$(step.selector))) {
        // only wait if the selector isn't on page
        try {
            await page.waitForSelector(step.selector, {
                timeout: step.timeoutMillis
            });
        }
        catch (e) {
            throw new Error(`Missing selector "${step.selector}" for "${label}" after ${step.timeoutMillis}ms timeout`);
        }
    }
};
/**
 * Find an input element on the page, focus then type on it
 */
exports.focusAndType = async (page, step, value) => {
    if (!step.selector || !value) {
        return;
    }
    if (step.timeoutMillis && !(await page.$(step.selector))) {
        await page.waitForSelector(step.selector, {
            timeout: step.timeoutMillis
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
exports.waitForPageActivity = (page, parsedUrl, timeoutMillis = 15000) => Promise.race([
    // for regular form POSTs, check if there's a redirect
    page.waitForNavigation({
        timeout: timeoutMillis,
        waitUntil: "networkidle2"
    }),
    // for SPAs, check if the url is changing (hash part, etc)
    page.waitForFunction((cUrl) => {
        return document.location.href !== cUrl;
    }, { timeout: timeoutMillis }, parsedUrl.href),
    // for AJAX in general, check for valid responses
    page.waitForResponse(response => {
        var _a;
        return (response.status() < 400 &&
            // same origin request, usually ajax
            (response.url().includes(parsedUrl.hostname) ||
                !!((_a = response.headers()) === null || _a === void 0 ? void 0 : _a["set-cookie"])) // cookie header presence
        );
    }, {
        timeout: timeoutMillis
    })
]);
