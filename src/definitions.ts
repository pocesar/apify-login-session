export interface StepItem {
    /** The selector itself */
    selector: string;
    /** Timeout for this item */
    timeoutMillis?: number;
}

export interface Schema {
    username: string;
    password: string;
    userAgent: string;
    website: Array<{
        url: string;
        method?: string;
    }>;
    cookieDomains: string[];
    sessionConfig: {
        storageName: string;
        maxAgeSecs: number;
        maxUsageCount: number;
        maxPoolSize: number;
    };
    /** CSS selectors. Work with */
    steps: Array<{
        /** Selector for the username input */
        username?: StepItem;
        /** Selector for the password input */
        password?: StepItem;
        /** Selector for the submit button on the login form */
        submit?: StepItem;
        /** Element that should be on the page upon success */
        success?: StepItem;
        /** Element that is usually on the page when it fails */
        failed?: StepItem;
        /**
         * How long to wait, in ms, until trying to get cookies,
         * sessionStorage and localStorage items
         */
        waitForMillis?: number;
    }>;
    proxyConfiguration?: {
        proxyUrls?: string[];
        useApifyProxy?: boolean;
        apifyProxyGroups?: string[];
    };
}

export interface SessionUserData {
    proxyUrl: string;
    sessionStorage: { [index: string]: string };
    localStorage: { [index: string]: string };
    headers: { [index: string]: string };
}
