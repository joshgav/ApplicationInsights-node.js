import http = require('http');
import HttpHeaders = require('./HttpHeaders');

type HttpOutgoingMessage = http.ClientRequest | http.ServerResponse;
type HttpIncomingMessage = http.IncomingMessage;
type HttpMessage = HttpOutgoingMessage | HttpIncomingMessage;

function _getHttpHeaderValue ( message: HttpMessage, headerName: string ) : string {
    var headerValue = undefined;
    if (message.hasOwnProperty('getHeader')) {
        headerValue = (<any>message).getHeader(headerName);
    } else if (message.hasOwnProperty('headers')) {
        headerValue = (<any>message).headers[headerName];
    }

    return headerValue;
}

function _setHttpHeaderValue ( message: HttpOutgoingMessage, headerName: string, headerValue: string ) : void {
    if (message.hasOwnProperty('setHeader')) {
        (<any>message).setHeader(headerName, headerValue);
    }
}

function getRequestContext ( message: HttpMessage ) : object {
    const requestContext = {};
    const rawHeaderValue = _getHttpHeaderValue(message, HttpHeaders.RequestContext.HeaderName);
    if (rawHeaderValue) {
        rawHeaderValue.split(/\s*,\s*/).forEach( rawPair => {
            var pair = rawPair.split(/\s*=\s*/);
            // if no value provided, use key name as value (truthy)
            requestContext[pair[0]] = pair[1] || pair[0];
        });
    }
    return requestContext;
}

function setRequestContext ( message: HttpOutgoingMessage, context: object ) : void {
    var rawValues = [];
    Object.keys(context).forEach( key => {
        rawValues.push(`${key}=${context[key]}`);
    });
    const rawHeaderValue = rawValues.join(',');

    _setHttpHeaderValue(message, HttpHeaders.RequestContext.HeaderName, rawHeaderValue);
}

export = {
    getRequestContext,
    setRequestContext
}

