import http = require('http');
import https = require('https');
import url = require('url');

import ContractsModule = require('../Library/Contracts');
import Client = require('../Library/Client');
import Logging = require('../Library/Logging');
import Util = require('../Library/Util');
import HttpHeaders = require('./HttpHeaders');
import HttpRequestContextHelpers = require('./HttpRequestContextHelpers');
import HttpAIRequest = require('./HttpAIRequest');
import { CorrelationContextManager, CorrelationContext } from './CorrelationContextManager';

class HttpAIRequestCollector {

    public static INSTANCE: HttpAIRequestCollector;

    private _client: Client;
    private _isEnabled: boolean;
    private _isInitialized: boolean;
    private _isAutoCorrelating: boolean;

    constructor(client: Client) {
        if (!!HttpAIRequestCollector.INSTANCE) {
            throw new Error("Server request tracking should be configured from the applicationInsights object");
        }

        HttpAIRequestCollector.INSTANCE = this;
        this._client = client;
    }

    public enable(isEnabled: boolean) {
        this._isEnabled = isEnabled;

        // Autocorrelation requires automatic monitoring of incoming server requests
        // Disabling autocollection but enabling autocorrelation will still enable
        // request monitoring but will not produce request events
        if ((this._isAutoCorrelating || this._isEnabled) && !this._isInitialized) {
            this.useAutoCorrelation(this._isAutoCorrelating);
            this._initialize();
        }
    }

    public useAutoCorrelation(isEnabled:boolean) {
        if (isEnabled && !this._isAutoCorrelating) {
            CorrelationContextManager.enable();
        } else if (!isEnabled && this._isAutoCorrelating) {
            CorrelationContextManager.disable();
        }
        this._isAutoCorrelating = isEnabled;
    }

    public isInitialized() {
        return this._isInitialized;
    }

    public isAutoCorrelating() {
        return this._isAutoCorrelating;
    }

    private _generateCorrelationContext(httpAiRequest: HttpAIRequest): CorrelationContext {
        if (!this._isAutoCorrelating) {
            return;
        }

        return CorrelationContextManager.generateContextObject(
            httpAiRequest.requestId,
            httpAiRequest.getOperationName(this._client.context.tags),
            httpAiRequest.getOperationId(this._client.context.tags)
        );
    }

    private _initialize() {
        this._isInitialized = true;

        var originalCreateServer = http.createServer;
        http.createServer = function patchedCreateServer (onRequest) {
            // todo: get a pointer to the server so the IP address can be read from server.address
            return originalCreateServer((request:http.IncomingMessage, response:http.ServerResponse) => {
                var httpAiRequest = new HttpAIRequest(this._client, request);
                // Set up correlation context
                var correlationContext = this._generateCorrelationContext(httpAiRequest);

                CorrelationContextManager.runWithContext(correlationContext, () => {
                    if (this._isEnabled) {
                        // Auto collect request
                        HttpAIRequestCollector.trackRequest(this._client, request, response, null, httpAiRequest);
                    }

                    if (typeof onRequest === "function") {
                        onRequest(request, response);
                    }
                });
            });
        }

        var originalCreateHttpsServer = https.createServer;
        https.createServer = function patchedCreateHttpsServer (options, onRequest) {
            return originalCreateHttpsServer(options, (request:http.IncomingMessage, response:http.ServerResponse) => {
                var httpAiRequest = new HttpAIRequest(this._client, request);
                // Set up correlation context
                var correlationContext = this._generateCorrelationContext(httpAiRequest);

                CorrelationContextManager.runWithContext(correlationContext, () => {
                    if (this._isEnabled) {
                        HttpAIRequestCollector.trackRequest(this._client, request, response, null, httpAiRequest);
                    }

                    if (typeof onRequest === "function") {
                        onRequest(request, response);
                    }
                });
            });
        }
    }

    /**
     * Tracks a request synchronously (doesn't wait for response 'finish' event)
     */
    public static trackRequestSync(client: Client, request: http.IncomingMessage, response:http.ServerResponse, elapsedMilliseconds: number, properties?:{ [key: string]: string; }, error?: any) {
        if (!request || !response || !client) {
            Logging.info("HttpAIRequestCollector.trackRequestSync was called with invalid parameters: ", !request, !response, !client);
            return;
        }

        HttpRequestContextHelpers.setRequestContext(response, { [HttpHeaders.RequestContext.AppIdKey]: client.config.appId });

        // store data about the request
        var correlationContext = CorrelationContextManager.getCurrentContext();
        var httpAiRequest = new HttpAIRequest(client, request, (correlationContext && correlationContext.operation.parentId) || Util.newGuid());

        // Overwrite correlation context with request parser results
        if (correlationContext) {
            correlationContext.operation.id = httpAiRequest.getOperationId(client.context.tags) || correlationContext.operation.id;
            correlationContext.operation.name = httpAiRequest.getOperationName(client.context.tags) || correlationContext.operation.name;
            correlationContext.operation.parentId = httpAiRequest.requestId || correlationContext.operation.parentId;
        }

        HttpAIRequestCollector.endRequest(client, httpAiRequest, request, response, elapsedMilliseconds, properties, error);
    }

    /**
     * Tracks a request by listening to the response 'finish' event
     */
    public static trackRequest(client:Client, request:http.IncomingMessage, response:http.ServerResponse, properties?:{ [key: string]: string; }, httpAiRequest?:HttpAIRequest) {
        if (!request || !response || !client) {
            Logging.info("HttpAIRequestCollector.trackRequest was called with invalid parameters: ", !request, !response, !client);
            return;
        }

        // store data about the request
        var correlationContext = CorrelationContextManager.getCurrentContext();
        var internalHttpAiRequest = httpAiRequest || new HttpAIRequest(client, request, correlationContext && correlationContext.operation.parentId || Util.newGuid());

        if (Util.canIncludeCorrelationHeader(client, internalHttpAiRequest.url)) {
            HttpRequestContextHelpers.setRequestContext(response, { [HttpHeaders.RequestContext.AppIdKey]: internalHttpAiRequest.appId });
        }

        // Overwrite correlation context with request parser results (if not an automatic track. we've already precalculated the correlation context in that case)
        if (correlationContext && !internalHttpAiRequest) {
            correlationContext.operation.id = internalHttpAiRequest.getOperationId(client.context.tags) || correlationContext.operation.id;
            correlationContext.operation.name = internalHttpAiRequest.getOperationName(client.context.tags) || correlationContext.operation.name;
            correlationContext.operation.parentId = internalHttpAiRequest.getOperationParentId(client.context.tags) || correlationContext.operation.parentId;
        }

        // response listeners
        if (response.once) {
            response.once("finish", () => {
                HttpAIRequestCollector.endRequest(client, internalHttpAiRequest, request, response, null, properties, null);
            });
        }

        // track a failed request if an error is emitted
        if (request.on) {
            request.on("error", (error:any) => {
                HttpAIRequestCollector.endRequest(client, internalHttpAiRequest, request, response, null, properties, error);
            });
        }
    }

    private static endRequest(client: Client, httpAiRequest: HttpAIRequest, request: http.IncomingMessage, response: http.ServerResponse, elapsedMilliseconds?: number, properties?: { [key: string]: string}, error?: any) {
        if (error) {
            httpAiRequest.onError(error, properties);
        } else {
            httpAiRequest.onResponse(response, properties);
        }
        if (elapsedMilliseconds) { httpAiRequest.duration = elapsedMilliseconds; }

        // TODO(joshgav): http.ServerRequest -> http.IncomingMessage
        var context : { [name: string]: any; } = {"http.ServerRequest": request, "http.ServerResponse": response};
        var data = httpAiRequest.getRequestData();
        var tags = httpAiRequest.getRequestTags(client.context.tags);        

        client.track(data, tags, context);
    }

    public dispose() {
         HttpAIRequestCollector.INSTANCE = null;
         this._isInitialized = false;
    }
}

export = HttpAIRequestCollector;
