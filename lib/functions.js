"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// TODO: Use Object.fromEntries when it's well supported
/**
 * Transform entries (Array<[key, value]>) into an object.
 */
exports.fromEntries = (entries) => entries.reduce((out, [key, value]) => ({ ...out, [key]: value }), {});
exports.missingFromPage = (page, request) => async (selector, label) => {
    if (!(await page.$(selector))) {
        request.noRetry = true;
        throw new Error(`Missing selector "${selector}" for "${label}"`);
    }
    return false;
};
exports.focusAndType = async (page, value, selector) => {
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
exports.waitForPageActivity = (page, parsedUrl, timeout = 15000) => Promise.race([
    // for regular form POSTs, check if there's a redirect
    page.waitForNavigation({
        timeout,
        waitUntil: "networkidle2"
    }),
    // for SPAs, check if the url is changing (hash part, etc)
    page.waitForFunction((cUrl) => {
        return document.location.href !== cUrl;
    }, { timeout }, parsedUrl.href),
    // for AJAX in general, check for valid responses
    page.waitForResponse(response => {
        var _a;
        return (response.status() < 400 &&
            // same origin request, usually ajax
            (response.url().includes(parsedUrl.hostname) ||
                !!((_a = response.headers()) === null || _a === void 0 ? void 0 : _a["set-cookie"])) // cookie header presence
        );
    }, {
        timeout
    })
]);
