import * as Apify from "apify";
import { ENV_VARS } from "apify-shared/consts";
import { Schema } from "./definitions";
import {
    throwIfMissing,
    waitForPageActivity,
    fromEntries,
    focusAndType,
} from "./functions";

const { log, puppeteer } = Apify.utils;

Apify.main(async () => {
    const input: Schema | null = await Apify.getInput();

    if (!input || typeof input !== "object") {
        throw new Error("Missing input");
    }

    const {
        password,
        sessionConfig = {
            storageName: "login-sessions",
            maxAgeSecs: 86400,
            maxUsageCount: 10000,
            maxPoolSize: 3,
        },
        forceCloud = true,
        username,
        userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36",
        website,
        proxyConfiguration,
        cookieDomains = [],
        maxRequestRetries = 1,
        extraUrlPatterns = [],
        gotoTimeout = 30,
        countryCode,
    } = input;

    if (!input.steps?.length) {
        throw new Error(
            'You must provide at least one step in "steps" parameter'
        );
    }

    if (!cookieDomains?.length) {
        throw new Error('You must provide "cookieDomains" parameter');
    }

    if (forceCloud === true && !Apify.isAtHome()) {
        if (sessionConfig.storageName) {
            delete process.env[ENV_VARS.LOCAL_STORAGE_DIR];
            process.env[ENV_VARS.DEFAULT_KEY_VALUE_STORE_ID] =
                sessionConfig.storageName;
        } else {
            log.warning("To use forceCloud, you need to provide a storageName");
        }
    }

    const requestList = await Apify.openRequestList(null, website);

    const storage = {
        local: {},
        session: {},
    };

    const proxyConfig = proxyConfiguration?.useApifyProxy
        ? await Apify.createProxyConfiguration({
            countryCode,
            ...proxyConfiguration,
          })
        : undefined;

    const sessionPool = await Apify.openSessionPool({
        createSessionFunction: (pool) => {
            const session = new Apify.Session({
                ...pool.sessionOptions,
                id: sessionConfig.id || undefined,
                maxAgeSecs: sessionConfig.maxAgeSecs || 3600,
                maxUsageCount: sessionConfig.maxUsageCount || 100,
                sessionPool: pool,
            });

            session.userData.proxyUrl = proxyConfig?.newUrl(session.id);

            return session;
        },
        maxPoolSize: sessionConfig.maxPoolSize || 100,
        persistStateKeyValueStoreId: sessionConfig.storageName || undefined,
    });

    let usedSession: undefined | Apify.Session;

    const crawler = new Apify.PuppeteerCrawler({
        launchPuppeteerFunction: async (options) => {
            usedSession = await sessionPool.getSession();

            return Apify.launchPuppeteer({
                ...options,
                headless: false,
                proxyUrl: usedSession.userData.proxyUrl,
                stealthOptions: {
                    addPlugins: false,
                    emulateWindowFrame: false,
                    emulateWebGL: false,
                    emulateConsoleDebug: false,
                    addLanguage: false,
                    hideWebDriver: true,
                    hackPermissions: false,
                    mockChrome: false,
                    mockChromeInIframe: false,
                    mockDeviceMemory: false,
                },
                stealth: true,
                args: [
                    ...options.args,
                    "--disable-dev-shm-usage",
                    "--disable-setuid-sandbox",
                    "--disable-notifications",
                ],
                useChrome: Apify.isAtHome(),
                userAgent,
            });
        },
        // logins shouldn't take more than 1 request actually
        // redirects are dealt in one pass
        maxRequestsPerCrawl: +maxRequestRetries + input.steps.length + 3,
        maxRequestRetries,
        requestList,
        autoscaledPoolOptions: {
            maxConcurrency: 1,
        },
        gotoFunction: async ({ page, request, puppeteerPool }) => {
            await puppeteer.blockRequests(page, {
                urlPatterns: [],
                extraUrlPatterns,
            });

            await page.emulate({
                viewport: {
                    height: 1080,
                    width: 1920,
                },
                userAgent,
            });

            try {
                return page.goto(request.url, {
                    waitUntil: "networkidle2",
                    timeout: gotoTimeout * 1000,
                });
            } catch (e) {
                await puppeteerPool.retire(page.browser());
                throw new Error("Goto function failed");
            }
        },
        handlePageTimeoutSecs: 300,
        persistCookiesPerSession: false,
        handlePageFunction: async ({ page, request, response }) => {
            try {
                usedSession!.setCookiesFromResponse(response);
            } catch (e) {
                log.debug(e.message);
            }

            let currentUrl: URL | null = null;

            for (const step of input.steps) {
                request.noRetry = false; // reset retry

                log.debug("Applying step", {
                    step,
                    request,
                });

                if (step.username) {
                    await throwIfMissing(page, step.username, "username");
                    await focusAndType(page, step.username, username);
                }

                if (step.password) {
                    await throwIfMissing(page, step.password, "password");
                    await focusAndType(page, step.password, password);
                }

                // new URL throws on invalid URL, but it
                // should never happen in the real world
                currentUrl = new URL(page.url());

                const race = waitForPageActivity(
                    page,
                    currentUrl,
                    step.waitForMillis
                );

                if (step.submit) {
                    await throwIfMissing(page, step.submit, "submit");

                    log.debug("Tapping submit button", {
                        step,
                        request,
                    });

                    const submitElement = (await page.$(step.submit.selector))!;

                    // works for mobile and desktop versions
                    await submitElement.tap();
                }

                await race;

                try {
                    // just making sure it's settled, give some time for the Javascript
                    // to put JWT tokens in storage or assign non-httpOnly cookies
                    await page.waitForNavigation({
                        timeout: step.waitForMillis || 5000,
                        waitUntil: "networkidle2",
                    });
                } catch (e) {
                    log.info(
                        `Considering page settled after ${
                            step.waitForMillis || 5000
                        }ms`,
                        {
                            step,
                            url: request.url,
                        }
                    );
                }

                if (step.failed) {
                    try {
                        // if it's missing, it will throw, and we expect it
                        await throwIfMissing(page, step.failed, "failed");

                        throw new Error(
                            `Failed selector "${step.failed.selector}" found on page`
                        );
                    } catch (e) {
                        if (e.message.includes("Missing")) {
                            log.info(
                                `Failed selector "${step.failed.selector}" not found on page, all good`
                            );
                        } else {
                            throw e;
                        }
                    }
                }

                // check if something unique to logged-in users is present on the page
                if (step.success) {
                    await throwIfMissing(page, step.success, "success");
                }

                log.debug("Done with step", {
                    step,
                    request,
                });
            }

            log.info("All steps done, getting info from domains");

            log.debug("Getting sessionStorage items", {
                request,
            });

            // get any items that were added by Javascript to the session and local storages
            storage.session = {
                ...storage.session,
                ...fromEntries(
                    await page.evaluate(async () => {
                        return Object.entries(window.sessionStorage);
                    })
                ),
            };

            log.debug("Getting localStorage items", {
                request,
            });

            storage.local = {
                ...storage.local,
                ...fromEntries(
                    await page.evaluate(async () => {
                        return Object.entries(window.localStorage);
                    })
                ),
            };

            const cookies = await page.cookies();

            for (const origin of cookieDomains.sort(
                (a, b) => a.length - b.length
            )) {
                log.debug(`Getting cookies from ${origin}`, {
                    request,
                });

                try {
                    await usedSession!.setPuppeteerCookies(
                        cookies,
                        `${origin}`
                    );
                } catch (e) {
                    // sometimes fail with "Cookie has domain set to a public suffix"
                }
            }
        },
        handleFailedRequestFunction: async ({ error }) => {
            log.exception(error, "All retries failed");

            usedSession = undefined;

            await Apify.setValue("OUTPUT", {
                session: null,
                error: error.message,
            });
        },
    });

    await crawler.run();

    if (usedSession?.isUsable()) {
        usedSession.userData = {
            userAgent,
            ...usedSession.userData,
            sessionStorage: storage.session,
            localStorage: storage.local,
        };
        usedSession.usageCount = 0; // make it brand new

        await usedSession.sessionPool.persistState(); // force saving

        await Apify.setValue("OUTPUT", {
            session: usedSession.getState(),
            error: null,
        });

        log.info(`Session "${usedSession.id}" created`);
    } else {
        await Apify.setValue("OUTPUT", {
            session: null,
            error: `Nothing created`,
        });

        log.info(`Nothing created`);

        process.exit(1); // give an outside world hint that it failed
    }
});
