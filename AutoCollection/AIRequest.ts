import Client = require('../Library/Client');
import ContractsModule = require('../Library/Contracts');
import Util = require('../Library/Util');

import AIItem = require('./AIItem');

abstract class AIRequest extends AIItem {
    protected _requestId: string;
    protected _startTime: number;
    protected _duration: number;
    protected _theirAppId: string = '';
    protected _parentId: string;
    protected _operationId: string;

    public get requestId () : string {
        return this._requestId;
    }

    public get startTime () : number {
        return this._startTime;
    }

    public get duration () : number {
        return this._duration;
    }

    public set duration (value: number) {
        this._duration = value;
    }

    public get theirAppId () : string {
        return this._theirAppId;
    }

    constructor (client: Client, requestId?: string) {
        super(client);
        this._requestId = requestId || Util.newGuid();
        this._startTime = +new Date();
    }

    public getRequestData(): ContractsModule.Contracts.Data<ContractsModule.Contracts.RequestData> {
        return this._getRequestData();
    }

    public get requestData () : ContractsModule.Contracts.Data<ContractsModule.Contracts.RequestData> {
        return this._getRequestData();
    }

    protected abstract _getRequestData() : ContractsModule.Contracts.Data<ContractsModule.Contracts.RequestData>;
}

export = AIRequest;
