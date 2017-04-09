import http = require("http");
import https = require("https");
import url = require("url");

import ContractsModule = require("../Library/Contracts");
import Client = require("../Library/Client");
import Logging = require("../Library/Logging");
import Util = require("../Library/Util");
import HttpHeaders = require('./HttpHeaders');
import HttpRequestContextHelpers = require('./HttpRequestContextHelpers');
import HttpAIDependency = require('./HttpAIDependency');

class HttpAIDependencyCollector {
    public static disableOutgoingHttpAutoCollectionOption = 'disableOutgoingHttpAutoCollectionOption';
    // deprecated
    public static disableCollectionRequestOption = 'disableAppInsightsAutoCollection';

    public static INSTANCE: HttpAIDependencyCollector;

    private _client: Client;
    private _isEnabled: boolean;
    private _isInitialized: boolean;

    constructor(client: Client) {
        if (!!HttpAIDependencyCollector.INSTANCE) {
            throw new Error("HTTP dependency tracking should be configured from the applicationInsights object");
        }

        HttpAIDependencyCollector.INSTANCE = this;
        this._client = client;
    }

    public enable(isEnabled: boolean) {
        this._isEnabled = isEnabled;
        if (this._isEnabled && !this._isInitialized) {
            this._initialize();
        }
    }

    public isInitialized() {
        return this._isInitialized;
    }

    private _initialize() {
        this._isInitialized = true;

        const originalRequestFunction = http.request;
        http.request = (options, ...requestArgs) => {
            const requestResult: http.ClientRequest = originalRequestFunction.call(http, options, ...requestArgs);

            if (requestResult && options && !options[HttpAIDependencyCollector.disableOutgoingHttpAutoCollectionOption]) {
                HttpAIDependencyCollector.trackDependency(this._client, options, requestResult);
            }
            return requestResult;
        };

        // On node >= v0.11.12, https.request just calls http.request (with additional options).
        // But on older versions, https.request needs to be patched also.
        // The regex matches versions < 0.11.12 (avoiding a semver package dependency).
        if (/^0\.([0-9]\.)|(10\.)|(11\.([0-9]|10|11)$)/.test(process.versions.node)) {
            const originalHttpsRequestFunction = https.request;
            https.request = (options, ...requestArgs) => {
                const requestResult: http.ClientRequest = originalHttpsRequestFunction.call(
                    https, options, ...requestArgs);
                if (requestResult && options && !options[HttpAIDependencyCollector.disableOutgoingHttpAutoCollectionOption]) {
                    HttpAIDependencyCollector.trackDependency(this._client, options, requestResult);
                }
                return requestResult;
            };
        }
    }


    // TODO: make fully specific
    private static _isRequestOptions(requestOptions: string | http.RequestOptions | https.RequestOptions): boolean {
        return ( requestOptions !== null && typeof requestOptions === 'string' || typeof requestOptions === 'object');
    }
    private static _isClientRequest(request: http.ClientRequest) : boolean {
        return ( request !== null && typeof request === 'object');
    }

    /**
     * Tracks an outgoing request. Because it may set headers this method must be called before
     * writing content to or ending the request.
     */
    public static trackDependency(client: Client, requestOptions: string | http.RequestOptions | https.RequestOptions, request: http.ClientRequest,
            properties?: { [key: string]: string }) {

        if (!HttpAIDependencyCollector._isRequestOptions(requestOptions) || !HttpAIDependencyCollector._isClientRequest(request) || !client) {
            Logging.info("HttpAIDependencyCollector.trackDependency was called with invalid parameters: ", !requestOptions, !request, !client);
            return;
        }

        let httpDependency = new HttpAIDependency(client, requestOptions, request);

        // Add the source ikey hash to the request headers, if a value was not already present in the request.
        // The getHeader/setHeader methods aren't available on very old Node versions, and
        // are not included in the v0.10 type declarations currently used. So check if the
        // methods exist before invoking them.
        // TODO(joshgav): Is this guaranteed to be called *before* sending the outgoing request?
        HttpRequestContextHelpers.setRequestContext(request, { [HttpHeaders.RequestContext.AppIdKey]: httpDependency.appId });

        // Collect dependency telemetry about the request when it finishes.
        if (request.on) {
            request.on('response', (response: http.IncomingMessage) => {
                httpDependency.onResponse(response, properties);
                // TODO(joshgav): Is it okay to change ClientResponse -> IncomingMessage?
                var context : { [name: string]: any; } = { "http.RequestOptions": requestOptions, "http.ClientRequest": request, "http.ClientResponse": response };
                client.track(httpDependency.getDependencyData(), null, context);
            });
            request.on('error', (error: Error) => {
                httpDependency.onError(error, properties);
                var context : { [name: string]: any; } = { "http.RequestOptions": requestOptions, "http.ClientRequest": request, "Error": error };
                client.track(httpDependency.getDependencyData(), null, context);
            });
        }
    }

    public dispose() {
        HttpAIDependencyCollector.INSTANCE = null;
        this._isInitialized = false;
    }
}

export = HttpAIDependencyCollector;
