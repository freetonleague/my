var config = require('./config.js');
var axios = require('axios').default;
var crypto = require('crypto');

var express = require('express');
var router = express.Router();


var broxusCallbackUrl = function(req, res, next) {
    next();
}
 
router.get('/callbackUrl', [broxusCallbackUrl], function(req, res) {
    res.send('OK');
});


var API = function() {
    /*
        @wallet_data:    
            currency: TON
            addressType: web
            userAddress: <service>_<game_player_id>
    */

    this.domain = config.broxus.domain;

    this.urls = {
        static_addresses_renew: '/v1/static_addresses/renew',
        transfer:               '/v1/transfer',
        users_balance:          '/v1/users/balance',
        withdraw:               '/v1/withdraw',
        withdraw_validate:      '/v1/withdraw/validate'
    }

    this.apiCall = async (opt) => {
        return await axios(opt)
            .then(function(resp){
                if (resp.status == 200) {
                    return {data: resp.data, error: false};
                }
                return {data: {}, error: true};
            })
            .catch(function(error){
                return {data: {'message':error.response.data, 'status':error.response.status}, error: true};
            });
    }

    this.get_sign = (nonce, url, body) => {

        let _message = `${nonce}${url}${body}`;

        _sign = crypto.createHmac('sha256', config.broxus.secret).update(_message).digest('base64');

        return _sign;
    }
    
    
    this.static_addresses_renew = async (userAddress) => {
        
        let nonce = Date.now();

        let url = this.urls['static_addresses_renew'];

        let body = JSON.stringify({
            userAddress: userAddress,
            currency: config.broxus.currency,
            workspaceId: config.broxus.workspaceId,
            addressType: config.broxus.addressType,
        })
        
        let sign = this.get_sign(nonce, url, body);

        var requestOptions = {
            method: 'POST',
            url: `${this.domain}${url}`,
            data: body,
            headers: {
                'Content-type': 'application/json',
                'api-key': config.broxus.apikey,
                'nonce': nonce,
                'sign': sign
            },
            json: true
        };

        var {data, error} = await this.apiCall(requestOptions);
        
        return {broxus_wallet: data, err: error};
    }  

    
    this.transfer = async (transfer_data) => {
        
        let nonce = Date.now();

        let url = this.urls['transfer'];

        let body = JSON.stringify({
            id: transfer_data.transfer_id,
            currency: config.broxus.currency,
            value: transfer_data.value,
            fromAddressType: transfer_data.from_address_type,
            fromUserAddress: transfer_data.from_user_address,
            toAddressType: transfer_data.to_address_type,
            toUserAddress: transfer_data.to_user_address
        })
        
        let sign = this.get_sign(nonce, url, body);

        var requestOptions = {
            method: 'POST',
            url: `${this.domain}${url}`,
            data: body,
            headers: {
                'Content-type': 'application/json',
                'api-key': config.broxus.apikey,
                'nonce': nonce,
                'sign': sign
            },
            json: true
        };

        var {data, error} = await this.apiCall(requestOptions);
        
        return {transfer_response: data, err: error};
    }    

    
    this.users_balance = async (user_data) => {
        
        let nonce = Date.now();

        let url = this.urls['users_balance'];

        let body = JSON.stringify({
            addressType: user_data.address_type,
            userAddress: user_data.user_address
        })
        
        let sign = this.get_sign(nonce, url, body);

        var requestOptions = {
            method: 'POST',
            url: `${this.domain}${url}`,
            data: body,
            headers: {
                'Content-type': 'application/json',
                'api-key': config.broxus.apikey,
                'nonce': nonce,
                'sign': sign
            },
            json: true
        };

        var {data, error} = await this.apiCall(requestOptions);

        return {users_balance_response: data, err: error};
    }   

    
    this.withdraw = async (withdraw_data) => {
        
        let nonce = Date.now();

        let url = this.urls['withdraw'];

        let body = JSON.stringify({
            id: withdraw_data.id,
            currency: config.broxus.currency,
            value: withdraw_data.value,
            addressType: withdraw_data.address_type,
            userAddress: withdraw_data.user_address,
            blockchainAddress: withdraw_data.blockchain_address
        })
        
        let sign = this.get_sign(nonce, url, body);

        var requestOptions = {
            method: 'POST',
            url: `${this.domain}${url}`,
            data: body,
            headers: {
                'Content-type': 'application/json',
                'api-key': config.broxus.apikey,
                'nonce': nonce,
                'sign': sign
            },
            json: true
        };

        var {data, error} = await this.apiCall(requestOptions);
        
        return {withdraw_response: data, error: error};
    }   


    this.withdraw_validate = async (blockchain_address) => {
        
        let nonce = Date.now();

        let url = this.urls['withdraw_validate'];

        let body = JSON.stringify({
            currency: config.broxus.currency,
            blockchainAddress: blockchain_address
        })
        
        let sign = this.get_sign(nonce, url, body);

        var requestOptions = {
            method: 'POST',
            url: `${this.domain}${url}`,
            data: body,
            headers: {
                'Content-type': 'application/json',
                'api-key': config.broxus.apikey,
                'nonce': nonce,
                'sign': sign
            },
            json: true
        };

        var {data, error} = await this.apiCall(requestOptions);
        
        return {ok: data};
    }  
}

module.exports = {
    router_api: router,
    API: API
};