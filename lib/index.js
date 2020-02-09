"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Apify = __importStar(require("apify"));
const functions_1 = require("./functions");
const sample = require("lodash.sample");
const { log, puppeteer, getRandomUserAgent } = Apify.utils;
Apify.main(async () => {
    var _a, _b;
    const input = await Apify.getInput();
    if (typeof input !== "object") {
        throw new Error("Missing input");
    }
    const { steps, password, sessionConfig, username, website, proxyConfiguration } = input;
    if (!((_a = steps) === null || _a === void 0 ? void 0 : _a.length)) {
        throw new Error("You must provide at least one step");
    }
    const requestList = await Apify.openRequestList(null, website);
    const storage = {
        local: {},
        session: {}
    };
    const sessionPool = await Apify.openSessionPool({
        createSessionFunction: pool => {
            var _a, _b, _c;
            const session = new Apify.Session({
                ...pool.sessionOptions,
                maxAgeSecs: sessionConfig.maxAgeSecs,
                maxUsageCount: sessionConfig.maxUsageCount,
                sessionPool: pool,
                userData: {
                    headers: {
                        "User-Agent": getRandomUserAgent()
                    }
                }
            });
            const proxyUrls = ((_a = proxyConfiguration) === null || _a === void 0 ? void 0 : _a.useApifyProxy) ? [
                Apify.getApifyProxyUrl({
                    groups: (_b = proxyConfiguration) === null || _b === void 0 ? void 0 : _b.apifyProxyGroups,
                    session: session.id
                })
            ]
                : ((_c = proxyConfiguration) === null || _c === void 0 ? void 0 : _c.proxyUrls) || [];
            session.userData.proxyUrl = sample(proxyUrls);
            return session;
        },
        maxPoolSize: sessionConfig.maxPoolSize,
        persistStateKeyValueStoreId: sessionConfig.storageName
    });
    let usedSession;
    const crawler = new Apify.PuppeteerCrawler({
        launchPuppeteerFunction: async () => {
            usedSession = await sessionPool.getSession();
            return Apify.launchPuppeteer({
                proxyUrl: usedSession.userData.proxyUrl,
                apifyProxySession: usedSession.id
            });
        },
        // logins shouldn't take more than 1 request actually
        // redirects are dealt in one pass
        maxRequestsPerCrawl: 3,
        requestList,
        gotoFunction: async ({ page, request }) => {
            await puppeteer.blockRequests(page, {
                extraUrlPatterns: [
                    "fonts.googleapis.com",
                    "hotjar.com",
                    "doubleclick.net",
                    "getblue.io",
                    "googletagmanager.com",
                    "google-analytics.com",
                    "facebook.net",
                    "staticxx.facebook.com",
                    "www.googleadservices.com",
                    "js.intercomcdn.com"
                ]
            });
            await page.setExtraHTTPHeaders({
                ...usedSession.userData.headers
            });
            return page.goto(request.url, {
                waitUntil: "networkidle2",
                timeout: 30000
            });
        },
        handlePageFunction: async ({ page, request, response }) => {
            usedSession.setCookiesFromResponse(response);
            const isMissing = functions_1.missingFromPage(page, request);
            const typer = functions_1.focusAndType(page);
            const waitOn = functions_1.waitForPageActivity(page);
            let currentUrl = null;
            for (const step of steps) {
                request.noRetry = false; // reset retry
                log.debug("Applying step", {
                    step,
                    request
                });
                if (step.username) {
                    await isMissing(step.username, "username");
                    await typer(step.username, username);
                }
                if (step.password) {
                    await isMissing(step.password, "password");
                    await typer(step.password, password);
                }
                // new URL throws on invalid URL, but it
                // should never happen in the real world
                currentUrl = new URL(page.url());
                const race = waitOn(currentUrl, step.waitFor);
                if (step.submit) {
                    await isMissing(step.submit, "submit");
                    log.debug("Tapping submit button", {
                        step,
                        request
                    });
                    // works for mobile and desktop versions
                    await (await page.$(step.submit.selector)).tap();
                }
                await race;
                try {
                    // just making sure it's settled, give some time for the Javascript
                    // to put JWT tokens in storage or assign non-httpOnly cookies
                    await page.waitForNavigation({
                        timeout: step.waitFor || 5000,
                        waitUntil: "networkidle2"
                    });
                }
                catch (e) { }
                if (step.failed) {
                    try {
                        // if it's present, it will throw
                        await isMissing(step.failed, "failed");
                    }
                    catch (e) {
                        throw new Error(`Failed selector "${step.failed.selector}" found on page`);
                    }
                }
                // check if something unique to logged-in users is present on the page
                if (step.success) {
                    await isMissing(step.success, "success");
                }
                log.debug("Done with step", {
                    step,
                    request
                });
            }
            log.debug("Getting sessionStorage items", {
                request
            });
            // get any items that were added by Javascript to the session and local storages
            storage.session = functions_1.fromEntries(await page.evaluate(async () => {
                return Object.entries(window.sessionStorage);
            }));
            log.debug("Getting localStorage items", {
                request
            });
            storage.local = functions_1.fromEntries(await page.evaluate(async () => {
                return Object.entries(window.localStorage);
            }));
            if (currentUrl) {
                log.debug(`Getting cookies from ${currentUrl.origin}`, {
                    request
                });
                // we have to do a brute-force here, to be able to get subdomain
                // cookies
                const domainParts = currentUrl.hostname
                    .split(".")
                    .map((_, index, all) => {
                    return all.slice(index);
                })
                    .filter(s => s.length > 1) // filter at least, valid domains
                    .map(s => s.join("."));
                const cookies = await page.cookies();
                for (const origin of domainParts) {
                    try {
                        usedSession.setPuppeteerCookies(cookies, `${currentUrl.protocol}//${origin}`);
                    }
                    catch (e) {
                        // sometimes fail with "Cookie has domain set to a public suffix"
                    }
                }
            }
        },
        handleFailedRequestFunction: async ({ error }) => {
            log.exception(error);
            usedSession = undefined;
            await Apify.setValue("OUTPUT", {
                session: null,
                error: error.message
            });
        }
    });
    await crawler.run();
    if ((_b = usedSession) === null || _b === void 0 ? void 0 : _b.isUsable()) {
        usedSession.userData = {
            ...usedSession.userData,
            sessionStorage: storage.session,
            localStorage: storage.local
        };
        usedSession.usageCount = 0; // make it brand new
        await usedSession.sessionPool.persistState(); // force saving
        await Apify.setValue("OUTPUT", {
            session: usedSession.getState(),
            error: null
        });
        log.info(`Session "${usedSession.id}" created`);
    }
    else {
        log.info(`Nothing created`);
        process.exit(1); // give an outside world hint that it failed
    }
});
