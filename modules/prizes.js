var express = require('express');
var { v4: uuidv4 } = require('uuid');

var Broxus = require('./broxus.js');
const broxus = new Broxus.API();

var router = express.Router();

router.get('/', [sessionRequired], async function(req, res, next) {
    res.render('prizes.html', {'user':req.session.user});
})

router.get('/get/all', [sessionRequired], async function(req, res, next) {
    
    let prizes = await getTransfers(req.session.user.user_id);

    res.json({'code':200, 'prizes': prizes})
})

// TODO: move to WALLETs namespace
router.get('/wallets/balance/get', [sessionRequired], async function(req, res) {

    let user_data = req.session.user.wallet;
    let {users_balance_response, err} = await broxus.users_balance(user_data);

    if (err) return res.json({'code': 500, 'message': users_balance_response})
    let balance = (users_balance_response.length)
                ?users_balance_response[0]
                :{ currency: 'TON', total: '0', frozen: '0', available: '0' }
    
    req.session.user.wallet.balance = balance;
    req.session.save();

    res.json({'code': 200, 'balance': balance})

})

// TODO: move to WALLETs namespace
router.post('/wallets/withdraw', [sessionRequired], async function(req, res) {

    let wallet_id = req.body.wallet_id || null;
    let amount = req.body.amount || 0;

    if(!wallet_id || !amount) return res.json({'code': 400, 'message': 'Bad request'});

    let { broxus_wallet_data, err } = await validateBroxusWallet(
                                    req.session.user.user_id, 
                                    req.session.user.service, 
                                    req.session.user.wallet.address_type, 
                                    req.session.user.wallet.user_address)

    if(err) return res.json({'code': 403, 'message': 'Wallet not found'});

    let withdraw_transaction = {
        'id': uuidv4(),
        'address_type': broxus_wallet_data['address_type'],
        'user_address': broxus_wallet_data['user_address'],
        'blockchain_address': wallet_id,
        'currency': broxus_wallet_data['currency'],
        'value': amount
    }

    let {ok} = await broxus.withdraw_validate(wallet_id);
    if(!ok) return res.json({'code': 405, 'message': 'Invalid blockchain address'});

    let {withdraw_response, error} = await broxus.withdraw(withdraw_transaction);
    if(error) return res.json({'code': 500, 'message': withdraw_response});

    err = await insertBroxusWithdrawTransaction(
        withdraw_response['transactionId'],
        broxus_wallet_data['address_type'],
        broxus_wallet_data['user_address'],
        req.session.user.user_id, 
        req.session.user.service, 
        req.session.user.id, 
        amount,
        broxus_wallet_data['currency']
    )
    if(err) return res.json({'code': 500, 'message': 'Internal server error'});

    res.json({'code': 200});
})

async function insertBroxusWithdrawTransaction(broxus_transaction_id, address_type, user_address, user_service_id, service, user_id, value, currency) {
    try {
        pgPool.query('BEGIN')

        let _raw_insert = `insert into 
            broxus_withdraw_transactions(broxus_transaction_id, address_type, user_address, user_service_id, service, user_id, value, currency)
            values($1, $2::text, $3::text, $4::text, $5::text, $6::integer, $7::numeric, $8::text)
            ON CONFLICT DO NOTHING`;
        await pgPool.query(_raw_insert, [broxus_transaction_id, address_type, user_address, user_service_id, service, user_id, value, currency])

        await pgPool.query('COMMIT')
        return false;

    } catch(e) {

        await pgPool.query('ROLLBACK')
        console.log(e.stack)
        console.log('Error on insert withdraw to user '+user_address)
        return true;
    } 
}


// TODO: move to WALLETs namespace
async function validateBroxusWallet(user_id, service, address_type, user_address) {

    let _raw = `select address_type, user_address, currency
        from users_broxus_wallets
        where user_id = $1::text
        and user_service = $2::text
        and address_type = $3::text
        and user_address = $4::text
        limit 1`;
    let _resp = await pgPool
                        .query(_raw, [user_id, service, address_type, user_address])
                        .catch((e) => console.log(e.stack))

    var _data = {}, _err = false;
    if(_resp.rowCount){
        _data = _resp.rows[0];
    }else{
        _err = true;
    }

    return {broxus_wallet_data: _data, err: _err };
}

async function getTransfers(user_id) {
    let _raw = `select 
                t.user_id           as user_id,
                t.tournament_id     as tournament_id,
                t.value::REAL       as prize,
                t.status            as status,
                ti.service          as service,
                ti.platform         as platform,
                ti.title            as title,
                to_timestamp(CAST(ti.start_time as bigint))::timestamp      as start_time,
                ti.game             as game,
                ti.game_type        as game_type,
                ti.slots            as slots,
                (select count(t) from jsonb_object_keys(td.teams) as t)     as count_teams,
                jsonb_extract_path(td.players, $1::text)->'team'->>'name'   as team_name,
                jsonb_extract_path(td.players, $1::text)->>'place'          as place
        from users_broxus_wallets_prize_transfer t
        join tournaments ti on ti.tournament_id = t.tournament_id
        join tournaments_data td on td.tournament_id = t.tournament_id
        where t.user_id = $1::text
        and ti.approved_status = 'approved'`;
    let _resp = await pgPool
                        .query(_raw, [user_id])
                        .catch((e) => console.log(e.stack))

    var _data = {}
    if(_resp.rowCount){
        // TODO: serialize
        _data = _resp.rows;
    }
    return _data;
}

module.exports = {
    router: router
};