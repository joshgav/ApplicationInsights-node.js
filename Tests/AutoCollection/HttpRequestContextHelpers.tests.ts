import http = require('http');
import assert = require('assert');

import HttpHeaders = require('../../AutoCollection/HttpHeaders');
import HttpRequestContextHelpers = require('../../AutoCollection/HttpRequestContextHelpers');

describe('AutoCollection/HttpRequestContextHelpers', function () {
    let mockUrl = '';
    let appIdValue = 'mock';
    let context = { [HttpHeaders.RequestContext.AppIdKey]: appIdValue };

    function _checkForContextHeader(msg : http.ClientRequest | http.ServerResponse) {
        var found = false;
        let rawHeader = msg.getHeader(HttpHeaders.RequestContext.HeaderName)
        rawHeader.split(/\s*,\s*/).forEach(rawPair => {
            let pair = rawPair.split(/\s*=\s*/);
            if (pair[0] === HttpHeaders.RequestContext.AppIdKey 
                  && pair[1] === appIdValue) {
                found = true;
            }
        });
        assert(found);
    }

    describe('#setRequestContext', function () {
        it('should set Request-Context header for outgoing http request', function () {
            let req = http.request(mockUrl);
            HttpRequestContextHelpers.setRequestContext(req, context);
            _checkForContextHeader(req);
        });

        it('should set Request-Context header for outgoing http response', function () {
            const server = http.createServer();
            server.on('request', function (req, res) {
                HttpRequestContextHelpers.setRequestContext(res, context);
                _checkForContextHeader(res); 
            });
            // send request to server...
        });
    });

    describe('#getRequestContext', function () {
        it('should get context from an incoming http response', function () {
            let req = http.request(mockUrl);
            // server at mockUrl should set Request-Context header...
            req.on('response', function (response) {
                const responseContext = HttpRequestContextHelpers.getRequestContext(response);
                assert(responseContext[HttpHeaders.RequestContext.AppIdKey] === appIdValue);
            });
        });

        it('should get context from an outgoing http request', function () {
            let req = http.request(mockUrl);
            HttpRequestContextHelpers.setRequestContext(req, context);
            const requestContext = HttpRequestContextHelpers.getRequestContext(req);
            assert(requestContext[HttpHeaders.RequestContext.AppIdKey] === appIdValue);
        });

        it('should get context from an outgoing http response', function () {
            const server = http.createServer();
            server.on('request', function (req, res) {
                HttpRequestContextHelpers.setRequestContext(res, context);
                const responseContext = HttpRequestContextHelpers.getRequestContext(res);
                assert(responseContext[HttpHeaders.RequestContext.AppIdKey] === appIdValue);
            });
            // send request to server...
        });
    });
});
