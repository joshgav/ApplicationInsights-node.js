import Client = require('../Library/Client');
import Util = require('../Library/Util');

abstract class AIItem {
    private _client: Client;
    protected _properties: { [key: string]: string };

    public get appId () : string {
        if (!this._client) {
            return '';
        } else {
            return this._client.config.appId;
        }
    }

    public get properties () : { [key: string]: string } {
        return this._properties;
    }

    constructor ( client: Client) {
        this._client = client;
        this._properties = <{ [key: string]: string }>{};
    }
}

export = AIItem;
