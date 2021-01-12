var config = require('../config.js');
var express = require('express');
var axios = require('axios').default;
var format = require('pg-format');
var { v4: uuidv4 } = require('uuid');
var sleep = require('sleep');

var Broxus = require('../broxus.js');
const broxus = new Broxus.API();

var router = express.Router();

const GAME_SERVICES = {'dota2': 'steam', 'csgo': 'steam'}

const PLATFORM_AVAILABLE = ['faceit', 'epulze'];

const PLATFORM_API_URL = {
    'faceit': {
        'info': 'https://api.faceit.com/championships/v1/championship/<tournament_id>',
        'data': 'https://api.faceit.com/match/v2/match?entityId=<tournament_id>&entityType=championship&group=1&state=FINISHED&limit=100&offset=<offset>',
        'teams': 'https://api.faceit.com/championships/v1/championship/<tournament_id>/subscription?limit=20&offset=<offset>&group=1'
    },
    'epulze': {
        'info': 'https://epulze.com/api/t/tournaments/<tournament_id>',
        'data': 'https://epulze.com/api/t/tournaments/<tournament_id>/stages',
        'teams': 'https://epulze.com/api/t/tournaments/<tournament_id>/teams'
    }
}

PLATFORM_API_URL_PAGINATION_PARAMS = {
    'faceit': {
        'data': {'limit': 100, 'offset': 0},
        'teams': {'limit': 20, 'offset': 0}
    },
    'epulze': {
    }
}

const PLATFORM_NORMALIZE_FUNC = {
    'faceit': {
        'info': normalizeTournamentInfo_faceit,
        'data': normalizeTournamentData_faceit,
        'teams': null
    },
    'epulze': {
        'info': normalizeTournamentInfo_epulze,
        'data': normalizeTournamentData_epulze,
        'teams': normalizeTournamentTeams_epulze
    }
}

const RGX_STEAMID = /\d{2,}/g;
const STEAM_64_ID = 76561197960265728;
const BRACKET_ROUNDS = ['Final','SemiFinals','QuarterFinals','Round of 16','Round of 32','Round of 64','Round of 128'];
const PLACES_TEAMS = ['2nd', '3-4th', '5-8th', '9-16th', '17-32th', '33-64th', '65-128th']
const PRIZE_POOL_DIST_DEFAULT = {"1st": "0", "2nd": "0", "3-4th": "0", "5-8th": "0", "9-16th": "0", "17-32th": "0", "33-64th": "0", "65-128th": "0"}

var roleAdmin = function(req, res, next) {
    if (req.session.hasOwnProperty('user') && req.session.user.role == 'admin') {
        next();
    }else{
        res.redirect('/');
    }
}
 
router
    .get('/', [sessionRequired, roleAdmin], function(req, res) {
        res.render('admin/tournaments.html', {'user':req.session.user})
    });

router
    .post('/add', [sessionRequired, roleAdmin], async function(req, res) {

        let platform = req.body.platform;
        let link = req.body.link;
        
        if (!checkPlatform(platform)) return res.json({'code':400, 'message': 'Wrong Tournament platform'});

        let tournament_id = getTournamentIdFromUrl(link, platform);
        if (!tournament_id) return res.json({'code':400, 'message': 'Tournament id not found in URL'});

        let tournament_info = await getTournamentFromApi_Request(tournament_id, platform, 'info');
        
        let tournament_data = await getTournamentFromApi_Request(tournament_id, platform, 'data');
        
        await addNewTournament(tournament_info, tournament_data);

        res.json({'code':200})
    });

router
    .get('/get', [sessionRequired, roleAdmin], async function(req, res) {

        let _status = req.query.q;
        
        let tournaments = await getTournaments(_status);

        res.json({'code':200, 'tournaments': tournaments})
    });

router
    .get('/get/:tournament_id', [sessionRequired, roleAdmin], async function(req, res) {

        let tournament_id = req.params['tournament_id'];
        
        let tournament = await getTournament(tournament_id);

        res.json({'code':200, 'tournament': tournament});
    });

router
    .post('/:tournament_id/update', [sessionRequired, roleAdmin], async function(req, res) {

        let tournament_id = req.params['tournament_id'];

        let _query = req.body.q;
        
        switch(_query){
            case 'prize_pool':
                let prize_pool = req.body.prize_pool;
                let prize_pool_distribution = req.body.prize_pool_distribution;
                await updatePrizepool(tournament_id, prize_pool, prize_pool_distribution);
                break;
            case 'approved_status':
                let approved_status = req.body.approved_status;
                await updateApprovedStatus(tournament_id, approved_status);
                break;
            default:
                return res.json({'code':404});
                break;
        }
        
        res.json({'code':200})
    });


//TODO: move to WALLETs namespace
router
    .get('/wallets/get/for/tournament/:tournament_id', [sessionRequired, roleAdmin], async function(req, res) {
        
        let tournament_id = req.params['tournament_id'];
        
        let tournament = await getTournament(tournament_id);
        
        if(!Object.keys(tournament).length) return res.json({'code': 404});

        let service = tournament['service'];
        let users_broxus_wallets = await getUsersWalletsByTournamentId_Broxus(service, tournament_id);

        if(Object.keys(users_broxus_wallets).length){
            users_broxus_wallets = arrayToObject(users_broxus_wallets, 'user_id');
        }

        res.json({'code': 200, 'wallets': users_broxus_wallets})
    });

//TODO: move to WALLETs namespace
router
    .get('/wallets/transfer/get/for/tournament/:tournament_id', [sessionRequired, roleAdmin], async function(req, res) {
        
        let tournament_id = req.params['tournament_id'];
        
        let tournament = await getTournament(tournament_id);
        
        if(!Object.keys(tournament).length) return res.json({'code': 404});

        let service = tournament['service'];
        let platform = tournament['platform'];

        let users_broxus_transfers = await getUsersTransferByTournamentId_Broxus(tournament_id, tournament['service'], tournament['platform']);

        if(Object.keys(users_broxus_transfers).length){
            users_broxus_transfers = arrayToObject(users_broxus_transfers, 'user_id');
        }

        res.json({'code': 200, 'transfers': users_broxus_transfers})
        return;
    })

async function getUsersTransferByTournamentId_Broxus (tournament_id, service, platform) {
    let _raw = `select transfer_id, user_id, status
            from users_broxus_wallets_prize_transfer
            where user_id in (      
                select jsonb_object_keys(td.players) as user_id
                from tournaments_data td
                where tournament_id = $1::text
            )
            and tournament_id = $2::text
            and service = $3::text
            and platform = $4::text`;
    let _resp = await pgPool
                        .query(_raw, [tournament_id, tournament_id, service, platform])
                        .catch((e) => console.log(e.stack))

    var _data = {}
    if(_resp.rowCount){
        _data = _resp.rows;
    }

    return _data;
}

//TODO: move to WALLETs namespace
router
    .get('/wallets/create/for/user/:user_id', [sessionRequired, roleAdmin], async function(req, res) {

        let user_id = req.params['user_id'];

        var {service, tournament_id} = req.query;
        
        if(!user_id.length || !tournament_id.length || !service.length) return res.json({'code': 400});
        
        let users_broxus_wallets = await checkOrCreateUsersWallets_Broxus(service, [user_id]);
        
        if(!users_broxus_wallets.hasOwnProperty(user_id)) return res.json({'code': 403});

        res.json({'code': 200})
    })


//TODO: move to WALLETs namespace
router
    .get('/wallets/transfer/prepare/for/user/:user_id', [sessionRequired, roleAdmin], async function(req, res) {

        let user_id = req.params['user_id'];

        var {service, tournament_id} = req.query;
        
        if(!user_id.length || !tournament_id.length || !service.length) return res.json({'code': 400});

        let tournament = await getTournament(tournament_id);
        
        if(!Object.keys(tournament).length) return res.json({'code': 404});

        let users_broxus_wallets = await getUsersWalletsByUsersId_Broxus(service, [user_id]);

        let users_broxus_transfer_data = await mergeTournamentDataToUsersWallet_Broxus(users_broxus_wallets, tournament);
        
        let transfers_transactions = await prepareTransferPrizeTransactions(users_broxus_transfer_data, req.session.user.id);
        
        res.json({
            'code': 200, 
            'transfer': {
                'transfer_id': transfers_transactions[0][0],
                'status': transfers_transactions[0][12]
            }
        })
    })

//TODO: move to WALLETs namespace
router
    .get('/wallets/transfer/sign/:transfer_id', [sessionRequired, roleAdmin], async function(req, res) {
        
        let transfer_id = req.params['transfer_id'];

        let transfer_data = await getTransferData_Broxus(transfer_id);
        
        if(!Object.keys(transfer_data).length) return res.json({'code': 404, 'message': 'Transfer not found'});

        var ok = await insertBroxusTransferTransactionAndUpdateTransferStatus(transfer_id, req.session.user.id);
        if(!ok) return res.json({'code': 500, 'message': 'Internal error'});

        var {transfer_response, _err} = await broxus.transfer(transfer_data);
        
        if(_err) return res.json({'code': 500, 'message': transfer_response});

        res.json({'code': 200})
    })

async function insertBroxusTransferTransactionAndUpdateTransferStatus(transfer_id, user_id) {
    try {
        pgPool.query('BEGIN')

        let _raw_insert = `insert into 
            broxus_transfer_transactions(transfer_id, broxus_transaction_id, signed_user_id)
            values($1, $2::text, $3::integer)
            ON CONFLICT DO NOTHING`;
        await pgPool.query(_raw_insert, [transfer_id, transfer_id, user_id])

        let _raw_update = `update users_broxus_wallets_prize_transfer
            set status = 'signed'
            where transfer_id = $1
            and status = 'wait_for_sign'`;
        await pgPool.query(_raw_update, [transfer_id])

        await pgPool.query('COMMIT')

        console.log('Success sign transfer '+transfer_id)
        return true;

    } catch(e) {

        await pgPool.query('ROLLBACK')
        console.log(e.stack)
        console.log('Error on sign transfer '+transfer_id)
        return false;
    } 

}

async function getTransferData_Broxus(transfer_id) {
    let _raw = `select 
                    transfer_id,
                    value,
                    currency,
                    from_address_type,
                    from_user_address,
                    to_address_type,
                    to_user_address
                from users_broxus_wallets_prize_transfer
                where transfer_id = $1
                and status = 'wait_for_sign'
                limit 1`;
    let _resp = await pgPool
                        .query(_raw, [transfer_id])
                        .catch((e) => console.log(e.stack))

    var _data = {}
    if(_resp.rowCount){
        _data = _resp.rows[0];
    }

    return _data;
}

// Utils
function arrayToObject(arr, key) {
    var initialValue = {};
    return arr.reduce((obj, item) => {
        return {
          ...obj,
          [item[key]]: item,
        };
    }, initialValue);
}

//TODO: move to WALLETs namespace
router
    .get('/wallets/create/for/tournament/:tournament_id', [sessionRequired, roleAdmin], async function(req, res) {
        
        let tournament_id = req.params['tournament_id'];
        
        let tournament = await getTournament(tournament_id);
        
        if(!Object.keys(tournament).length) return res.json({'code': 404});

        let service = tournament['service'];
        
        let users_ids = Object.values(tournament['players']).map(_p => _p['game_id']);

        users_ids = await removeUsersWithExistsWallet_Broxus(service, users_ids);

        let users_broxus_wallets = await checkOrCreateUsersWallets_Broxus(service, users_ids);

        res.json({'code': 200})
        return;
    });

//TODO: move to WALLETs namespace
router
    .get('/wallets/transfer/prepare/for/tournament/:tournament_id', [sessionRequired, roleAdmin], async function(req, res) {
        
        let tournament_id = req.params['tournament_id'];
        
        let tournament = await getTournament(tournament_id);
        
        if(!Object.keys(tournament).length) return res.json({'code': 404});

        let service = tournament['service'];
        
        let users_broxus_wallets = await getUsersWalletsByTournamentId_Broxus(service, tournament_id);

        let users_broxus_transfer_data = await mergeTournamentDataToUsersWallet_Broxus(users_broxus_wallets, tournament);
        
        let transfers_transactions = await prepareTransferPrizeTransactions(users_broxus_transfer_data, req.session.user.id);

        res.json({'code': 200})
        return;
    })

//TODO: move to WALLETs namespace
function mergeTournamentDataToUsersWallet_Broxus(users_broxus_wallets, tournament){

    var _delimetr = (tournament['game_type']=='1v1')?1:5;
    for(let _w in users_broxus_wallets){
        // ..
        users_broxus_wallets[_w]['tournament_id'] = tournament['tournament_id'],
        users_broxus_wallets[_w]['service'] = tournament['service'],
        users_broxus_wallets[_w]['platform'] = tournament['platform'],
        users_broxus_wallets[_w]['place'] = tournament['players'][users_broxus_wallets[_w]['user_id']]['place'],
        users_broxus_wallets[_w]['prize'] = parseFloat(tournament['prize_pool_distribution'][users_broxus_wallets[_w]['place']])/_delimetr;
    }

    return users_broxus_wallets;

}

//TODO: move to WALLETs namespace
async function getUsersWalletsByTournamentId_Broxus(service, tournament_id) {

    let _raw = `select user_id, address_type, user_address, currency, blockchain_address
        from users_broxus_wallets ubw
        where ubw.user_id in (
            select jsonb_object_keys(td.players) as user_id
            from tournaments_data td
            where tournament_id = $1::text
        )
        and user_service = $2::text`;
    let _resp = await pgPool
                        .query(_raw, [tournament_id, service])
                        .catch((e) => console.log(e.stack))

    var _data = {}
    if(_resp.rowCount){
        _data = _resp.rows;
    }

    return _data;
}

//TODO: move to WALLETs namespace
async function getUsersWalletsByUsersId_Broxus(service, users_ids) {

    let _raw = `select user_id, static_address_id, address_type, user_address, currency, blockchain_address 
        from users_broxus_wallets
        where user_id = any ($1)
        and user_service = $2::text`;
    let _resp = await pgPool
                        .query(_raw, [users_ids, service])
                        .catch((e) => console.log(e.stack))

    var _data = {}
    if(_resp.rowCount){
        _data = _resp.rows;
    }

    return _data;
}

//TODO: move to WALLETs namespace
async function removeUsersWithExistsWallet_Broxus(service, users_ids) {
    let _raw = `select user_id
                from users_broxus_wallets
                where user_service = $1::text`;
    let _resp = await pgPool
                        .query(_raw, [service])
                        .catch((e) => console.log(e.stack))

    var _data = {}
    if(_resp.rowCount){
        _data = _resp.rows.map(row => row['user_id']);
    }

    let diff = users_ids.filter(x => !_data.includes(x));

    return diff;
}

//TODO: move to WALLETs namespace
async function checkOrCreateUsersWallets_Broxus(service, users_ids) {
    
    var users_broxus_wallets = {};

    for(let _uid of users_ids){
        let userAddress = `${service}_${_uid}`;
        var {broxus_wallet, err} = await broxus.static_addresses_renew(userAddress);
        if(!err){
            let userAddress = await insertNewBroxusWallet(service, _uid, broxus_wallet);
            if(userAddress){
                users_broxus_wallets[_uid] = broxus_wallet;
            }
        }
        sleep.msleep(1000);    
    }
    return users_broxus_wallets;
}

//TODO: move to WALLETs namespace
async function insertNewBroxusWallet(service, user_id, broxus_wallet) {
    var _data = [
        user_id,
        service,
        broxus_wallet['id'],
        broxus_wallet['addressType'],
        broxus_wallet['userAddress'],
        broxus_wallet['currency'],
        broxus_wallet['blockchainAddress']
    ]

    let _raw_insert = `
        insert into users_broxus_wallets 
            (user_id, user_service, static_address_id, address_type, user_address, currency, blockchain_address)
        values ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text)
        ON CONFLICT (user_address) DO NOTHING
        RETURNING user_address`;
    let _resp_insert = await pgPool.query(_raw_insert, _data)
                        .catch((e) => {console.log(e.stack); return null});

    if(_resp_insert.rowCount){
        console.log(`SUCCESS: Insert new user waller: ${broxus_wallet['userAddress']}`);
    }else{
        console.log(`SUCCESS: User already has waller: ${broxus_wallet['userAddress']}`);
    }
    
    return broxus_wallet['userAddress'];
}

//TODO: move to WALLETs namespace
async function prepareTransferPrizeTransactions(users_broxus_transfer_data, user_id) {

    var txns = [];

    /*txn schema
        0:transfer_id
        1:user_id
        2:tournament_id
        3:service
        4:platform
        5:value
        6:currency
        7:from_address_type
        8:from_user_address
        9:to_address_type
        10:to_user_address
        11:application_id
        12:status
        13:tournament_place
        14:created_user_id
    */

    for(let _t of users_broxus_transfer_data){
        var txn = [
            uuidv4(),
            _t['user_id'],
            _t['tournament_id'],
            _t['service'],
            _t['platform'],
            _t['prize'],
            config.broxus.masterWallet.currency,
            config.broxus.masterWallet.addressType,
            config.broxus.masterWallet.userAddress,
            _t['address_type'],
            _t['user_address'],
            config.broxus.applicationId,
            'wait_for_sign',
            _t['place'],
            user_id
        ]
        txns.push(txn);
    }

    let _raw_insert = format(`insert into users_broxus_wallets_prize_transfer (transfer_id, user_id, tournament_id, service, platform, value, currency, from_address_type, from_user_address, to_address_type, to_user_address, application_id, status, tournament_place, created_user_id)
        values %L
        ON CONFLICT (user_id, tournament_id, service, platform, to_user_address) DO NOTHING`, txns)
    let _resp_insert = await pgPool
                        .query(_raw_insert, [])
                        .catch((e) => {console.log(e.stack); return null});

    return txns;
}

//CURRENT NAMESPACE
async function updateApprovedStatus(tournament_id, approved_status) {

    let approved = (approved_status)?'approved':'notapproved';
    let _raw = `
        update tournaments 
            set approved_status = $1
        where tournament_id = $2::text
        RETURNING id`;
    let _resp_insert = await pgPool.query(_raw, [approved, tournament_id])
                        .catch((e) => {console.log(e.stack); return false});
    return true;
}

async function updatePrizepool(tournament_id, prize_pool, prize_pool_distribution) {
    let _raw = `
        update tournaments 
            set prize_pool = $1, prize_pool_distribution = $2
        where tournament_id = $3::text
        RETURNING id`;
    let _resp_insert = await pgPool.query(_raw, [prize_pool, prize_pool_distribution, tournament_id])
                        .catch((e) => {console.log(e.stack); return false});
    return true;
}

async function getTournament(tournament_id) {
    let _raw = `select 
                    t.tournament_id, t.title, t.description, t.logo, t.platform, t.game, t.join_policy, t.slots, t.total_rounds, t.start_time, t.game_type, t.status, t.prize_pool, t.prize_pool_distribution, t.service,
                    td.players, td.teams, to_json(td.matches) as matches, td.rounds, td.named_rounds, td.places_teams
                from tournaments t
                join tournaments_data td on td.tournament_id = t.tournament_id
                where t.tournament_id = $1::text`;
    let _resp = await pgPool
                        .query(_raw, [tournament_id])
                        .catch((e) => console.log(e.stack))

    var _data = {}
    if(_resp.rowCount){
        _data = _resp.rows[0];
    }
    return _data;
}

async function getTournaments(status) {
    switch(status){
        case 'all':
            status_expression = 'WHERE True';
            break;
        case 'finished':
            status_expression = "WHERE t.status = 'finished'";
            break;
        default:
            status_expression = '';
    }
    let _raw = `select 
                    t.tournament_id, t.title, t.description, t.logo, t.platform, t.game, 
                    t.join_policy, t.slots, t.total_rounds, t.start_time, t.game_type, t.status, 
                    t.prize_pool, t.prize_pool_distribution, t.service
                from tournaments t
                ${status_expression}
                order by t.start_time desc`;
    let _resp = await pgPool
                        .query(_raw)
                        .catch((e) => console.log(e.stack))

    var _data = {}
    if(_resp.rowCount){
        _data = _resp.rows;
    }

    return _data;
}

async function addNewTournament(tournament_info, tournament_data) {
    await addOrUpdateTournamentInfo(tournament_info);
    await addOrUpdateTournamentData(tournament_info, tournament_data);
}

async function addOrUpdateTournamentInfo(tournament_info) {
    let _raw_insert = `
        insert into tournaments 
            (tournament_id, title, description, logo, platform, game, join_policy, slots, 
                total_rounds, start_time, game_type, status, prize_pool_distribution, service)
        values ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::integer, 
            $9::integer, $10::integer, $11::text, $12::text, $13, $14::text)
        ON CONFLICT (tournament_id) DO UPDATE
        SET title = $2::text, description = $3::text, logo = $4::text, platform = $5::text, game = $6::text, join_policy = $7::text, 
        slots = $8::integer, total_rounds = $9::integer, start_time = $10::integer, game_type = $11::text, status = $12::text, service = $14::text
        RETURNING id`;
    let _resp_insert = await pgPool.query(_raw_insert, Object.values(tournament_info))
                        .catch((e) => {console.log(e.stack); return false});
    return true;
}

async function addOrUpdateTournamentData(tournament_info, tournament_data) {
    tournament_data['tournament_id'] = tournament_info['tournament_id'];

    let _raw_insert = `
        insert into tournaments_data
            (players, teams, matches, rounds, named_rounds, places_teams, raw_data, tournament_id)
        values ($1, $2, $3, $4, $5, $6, $7, $8::text)
        ON CONFLICT (tournament_id) DO UPDATE
        SET players = $1, teams = $2, matches = $3, rounds = $4, named_rounds = $5, places_teams = $6, raw_data = $7
        RETURNING id`;
    let _resp_insert = await pgPool.query(_raw_insert, Object.values(tournament_data))
                        .catch((e) => {console.log(e.stack); return false});
    return true;
}

function normalizeTournamentData_faceit(resp, platform, tournament_id) {
    
    this.prepareMatches = (data) => {
        var matches = [];
        var i = 0;
        for (let _m of data) {
            i++
            let match = {}
            match['round'] = _m['entityCustom']['round'];
            match['status'] = _m['status'];
            match['start_datetime'] = _m['startedAt'];

            var rosters = {'faction1':[], 'faction2':[]};
            for(let _f of ['faction1','faction2'].values()){
                if (_m['teams'][_f]['id'] == 'bye') continue;

                for(let _p of _m['teams'][_f]['roster'].values()){
                    switch(_m['game']){
                        case 'csgo':
                            var steam_id = _p['gameId']
                            break;
                        case 'dota2':
                            let matchSteamId = _p['gameId'].match(RGX_STEAMID);
                            var steam_id = (BigInt(STEAM_64_ID) + BigInt(parseInt(matchSteamId[0]))).toString();
                            break;
                    }
                    rosters[_f].push({
                        'platform_id': _p['id'],
                        'nickname': _p['nickname'],
                        'game_id': steam_id,
                        'game_name': (typeof _p['gameName'] !== 'undefined')?_p['gameName']:_p['nickname']
                    })
                }
            }

            match['team1'] = {
                'roster': rosters['faction1'],
                'name': _m['teams']['faction1']['name'],
                'id': _m['teams']['faction1']['id'],
            }
            match['team2'] = {
                'roster': rosters['faction2'],
                'name': _m['teams']['faction2']['name'],
                'id': _m['teams']['faction2']['id'],
            }

            var scores = {'team1': 0, 'team2': 0}
            for (let _r of _m['results']) {
                scores[_r['winner'].replace('faction','team')]++;
            }

            for (let _s in scores) {
                if (scores[_s] == _m['matchCustom']['overview']['round']['to_win']){
                    match['team_win'] = _s;
                    break;
                }
            }

            match['team_win_name'] = match[match['team_win']]['name'];
            match['team_lose'] = (match['team_win']=='team1')?'team2':'team1';
            match['team_lose_name'] = (match['team_win']=='team1')?match['team2']['name']:match['team1']['name'];

            match[match['team_win']]['win'] = 1;
            match[match['team_lose']]['win'] = 0;
            
            matches.push(match);  
        }

        return matches;
    }

    this.prepareRounds = (matches) => {
        var rounds = {};
        for(let _m of matches.values()){
            rounds[_m['round']] = rounds[_m['round']] || {'matches':[]};
            rounds[_m['round']]['matches'].push(_m);
        }
        return rounds;
    }

    this.prepareNamedRounds = (rounds) => {
        
        var named_rounds = [];
        Object.keys(rounds).sort().reverse().forEach(function(key, i) {
            named_rounds.push({
                'title': BRACKET_ROUNDS[i],
                'matches': rounds[key]['matches']
            })
        });

        return named_rounds;
    }

    this.prepareTeamsPlaces = (rounds) => {
        var places = {'1st': [], '2nd': [], '3-4th': [], '5-8th': [], '9-16th': [], '17-32th': [], '33-64th': [], '65-128th': []}
        
        places['1st'].push(rounds[0]['matches'][0][rounds[0]['matches'][0]['team_win']]);

        for(let i=rounds.length-1;i>=0;i--){
            for(let m in rounds[i]['matches']){
                if (rounds[i]['matches'][m]['team_lose_name'] == 'bye') continue;
                let _team = rounds[i]['matches'][m]['team_lose'];
                places[PLACES_TEAMS[i]].push(rounds[i]['matches'][m][_team]);
            }

        }

        Object.entries(places).map((p)=>{if(!p[1].length) delete places[p[0]]})

        return places;
    }
    
    this.parsePlayers = (data, places_teams) => {
        var players = {};
        for (let _m of data) { 
            for(let _f of ['faction1','faction2'].values()){
                if (_m['teams'][_f]['id'] == 'bye') continue;
                for(let _p of _m['teams'][_f]['roster'].values()){

                    switch(_m['game']){
                        case 'csgo':
                            var steam_id = _p['gameId']
                            break;
                        case 'dota2':
                            let matchSteamId = _p['gameId'].match(RGX_STEAMID);
                            var steam_id = (BigInt(STEAM_64_ID) + BigInt(parseInt(matchSteamId[0]))).toString();
                            break;
                    }

                    let _player = {
                        'nickname': _p['nickname'],
                        'game_id': steam_id,
                        'game_name': (typeof _p['gameName'] !== 'undefined')?_p['gameName']:_p['nickname'],
                        'platform_id': _p['id']
                    }

                    for(let _pt in places_teams) {
                        for(let _m of places_teams[_pt].values()){
                            for(let _pls of _m['roster'].values()){
                                if (_pls['game_id']==_player['game_id']) {
                                    _player['place'] = _pt;
                                    _player['team'] = {
                                        'id': _m['id'],
                                        'name': _m['name']
                                    }
                                }
                            }
                        }
                    }

                    if(_player.hasOwnProperty('place')) players[_player['game_id']] = _player;                    
                }
            }
        }
        return players;
    }

    this.parseTeams = (data, places_teams) => {
        var teams = {};
        for (let _m of data) {   
            for(let _f of ['faction1','faction2'].values()){
                if (_m['teams'][_f]['id'] == 'bye') continue;
                
                let _team = {
                    'name': _m['teams'][_f]['name'],
                    'id': _m['teams'][_f]['id'],
                }
                // update with roster and win place
                for (let _p in places_teams) { 
                    for (let _t of places_teams[_p].values()) { 
                        if(_t['id'] == _team['id']) {
                            _team['place'] = _p;
                            _team['roster'] = _t['roster'];
                        }
                    }
                } 

                teams[_team['id']] = _team;
            }
        }
        return teams;
    }
    
    let _data = resp;

    let raw_data = _data;

    let matches = this.prepareMatches(_data);

    let rounds = this.prepareRounds(matches);
    
    let named_rounds = this.prepareNamedRounds(rounds);
    
    let places_teams = this.prepareTeamsPlaces(named_rounds);

    let teams = this.parseTeams(_data, places_teams);

    let players = this.parsePlayers(_data, places_teams);

    return {
        'players': players,
        'teams': teams,
        'matches': matches,
        'rounds': rounds,
        'named_rounds': named_rounds,
        'places_teams': places_teams,
        'raw_data': raw_data
    }

}

async function getTournamentFromApi_Request(tournament_id, platform, request_type){
    
    _resp = {};

    var api_link = PLATFORM_API_URL[platform][request_type].replace('<tournament_id>', tournament_id);

    if(!api_link) return _resp;
    
    var _resp = null, page = 0, result = [], next_page = false;
    do {

        let request_url = api_link;
        
        if(PLATFORM_API_URL_PAGINATION_PARAMS[platform].hasOwnProperty(request_type)){
            request_url = request_url
                            .replace('<limit>', PLATFORM_API_URL_PAGINATION_PARAMS[platform][request_type]['limit'])
                            .replace('<offset>', PLATFORM_API_URL_PAGINATION_PARAMS[platform][request_type]['limit'] * page++)
        }
        
        _resp = await axios.get(request_url)
                .then(function(resp){
                    return resp;
                })
                .catch(function(err){
                    console.log(`Axios error request on getTournamentDataFromApi: ${request_url}: ${err.response.status}`);
                    return {};
                })

        switch(platform){
            case 'faceit':
                if (_resp['data']['errors']) {
                    return {};
                } else if (_resp['data']['payload']) {  
                    var _data = _resp['data']['payload'];
                } 

                next_page = _resp['data']['pageNumber'] < _resp['data']['totalPages'];
                break;

            case 'epulze':
                // response
                if (_resp['data'].hasOwnProperty('httpStatus') && _resp['data']['httpStatus'] == 404) {
                    return {};
                }else{
                    var _data = _resp['data']['data'] || _resp['data'][0] || _resp['data'];
                }

                next_page = false;
                break;
        }
        result = result.concat(_data);
        
    } while(next_page)
    
    return PLATFORM_NORMALIZE_FUNC[platform][request_type](result, platform, tournament_id);
}


async function normalizeTournamentData_epulze(resp, platform, tournament_id) {
    
    this.prepareMatches = (data) => {
        var _teams = data['teams'];
        _teams['bye'] = {"id": "bye", "name":"bye", "roster":[]}
        var matches = [];

        for (let _r of data['rounds']) {

            for (let _m of _r['matches']){
                let match = {}
                match['round'] = _m['roundNumber'];
                match['status'] = _m['state'];
                match['start_datetime'] = new Date(_m['startsAt']).getTime() / 1000; // <-- to datetime

                let _teamId1 = _m['teamIds'][0];
                let _teamId2 = (_m['teamIds'].length==2)?_m['teamIds'][1]:"bye";

                match['team1'] = _teams[_teamId1]
                match['team2'] = _teams[_teamId2]

                match['team_win'] = (_teamId1==_m['winningTeamIds'][0])?'team1':'team2';

                match['team_win_name'] = match[match['team_win']]['name'];
                match['team_lose'] = (match['team_win']=='team1')?'team2':'team1';
                match['team_lose_name'] = (match['team_win']=='team1')?match['team2']['name']:match['team1']['name'];

                match[match['team_win']]['win'] = 1;
                match[match['team_lose']]['win'] = 0;
                
                matches.push(match);  
            }
        }

        return matches;
    }

    this.prepareRounds = (matches) => {
        var rounds = {};
        for(let _m of matches.values()){
            rounds[_m['round']] = rounds[_m['round']] || {'matches':[]};
            rounds[_m['round']]['matches'].push(_m);
        }
        return rounds;
    }

    this.prepareNamedRounds = (rounds) => {
        
        var named_rounds = [];
        Object.keys(rounds).sort().reverse().forEach(function(key, i) {
            named_rounds.push({
                'title': BRACKET_ROUNDS[i],
                'matches': rounds[key]['matches']
            })
        });

        return named_rounds;
    }

    this.prepareTeamsPlaces = (rounds) => {
        var places = {'1st': [], '2nd': [], '3-4th': [], '5-8th': [], '9-16th': [], '17-32th': [], '33-64th': [], '65-128th': []}
        
        places['1st'].push(rounds[0]['matches'][0][rounds[0]['matches'][0]['team_win']]);

        for(let i=rounds.length-1;i>=0;i--){
            for(let m in rounds[i]['matches']){
                if (rounds[i]['matches'][m]['team_lose_name'] == 'bye') continue;
                let _team = rounds[i]['matches'][m]['team_lose'];
                places[PLACES_TEAMS[i]].push(rounds[i]['matches'][m][_team]);
            }

        }

        Object.entries(places).map((p)=>{if(!p[1].length) delete places[p[0]]})

        return places;
    }

    this.parsePlayers = (data, places_teams) => {
        var players = {};

        for (let _t of Object.values(data['teams'])) { 
            for(_p of _t['roster']){
                for(let _pt in places_teams) {
                    for(let _m of places_teams[_pt].values()){
                        for(let _pls of _m['roster'].values()){
                            if (_pls['game_id']==_p['game_id']) {
                                _p['place'] = _pt;
                                _p['team'] = {
                                    'id': _m['id'],
                                    'name': _m['name']
                                }
                                break;
                            }
                        }
                    }
                    if(_p.hasOwnProperty('place')) players[_p['game_id']] = _p;
                }
            }

        }
        return players;
    }

    this.parseTeams = (data, places_teams) => {

        for (let _p in places_teams) { 
            for (let _t of places_teams[_p].values()) { 
                data['teams'][_t['id']]['place'] = _p;
                }
        }
        
        if (data['teams'].hasOwnProperty('bye')) delete data['teams']['bye']

        return data['teams'];

    }
    
    let _data = resp[0];

    _data['teams'] = await getTournamentFromApi_Request(tournament_id, platform, 'teams');

    let raw_data = [_data];

    let matches = this.prepareMatches(_data);

    let rounds = this.prepareRounds(matches);
    
    let named_rounds = this.prepareNamedRounds(rounds);
    
    let places_teams = this.prepareTeamsPlaces(named_rounds);
    
    let teams = this.parseTeams(_data, places_teams);

    let players = this.parsePlayers(_data, places_teams);

    return {
        'players': players,
        'teams': teams,
        'matches': matches,
        'rounds': rounds,
        'named_rounds': named_rounds,
        'places_teams': places_teams,
        'raw_data': raw_data
    }

}

async function normalizeTournamentTeams_epulze(resp, platform, tournament_id) {
    return arrayToObject(resp.map((t) => {
        return {
            'roster': t['users'].map((p) => {
                return {
                    'platform_id': p['id'],
                    'nickname': p['username'],
                    'game_id': p['steamId'],
                    'game_name': p['username']
                }
            }),
            'name': t['name'],
            'id': t['id']
        }
    }), 'id');
}


function normalizeTournamentInfo_epulze(resp, platform, tournament_id) {
    
    this.parseData = (data, platform) => {

        switch(data['state']){
            case 1:
                var _status = '???'; //created?
                break;
            case 2:
                var _status = 'join';
                break;
            case 3:
                var _status = '???'; //canceled?
                break;
            case 4:
                var _status = 'started'; //ongoing
                break;
            case 5:
                var _status = 'finished';
                break;
        }

        return {
            'tournament_id': data['id'],
            'title': data['name'],
            'description': '',
            'logo': (data['logoImage'])?data['logoImage']['uri']:'',
            'platform': platform,
            'game': data['game'],
            'join_policy': 'public',
            'slots': data['size'],
            'total_rounds': 0,
            'start_time': new Date(data['startDate']).getTime() / 1000,
            'game_type': (data['pageSlugRules'] == '5v5-tournament-rules')?'5v5':'1v1',
            'status': _status, 
            'prize_pool_distribution': PRIZE_POOL_DIST_DEFAULT,
            'service': GAME_SERVICES[data['game']]
        }
    }
    
    let _data = resp[0];
    return this.parseData(_data, platform);

}


function normalizeTournamentInfo_faceit(resp, platform, tournament_id) {

    this.parseData = (data, platform) => {
        return {
            'tournament_id': data['id'],
            'title': data['name'],
            'description': data['description'],
            'logo': data['avatar'],
            'platform': platform,
            'game': data['game'],
            'join_policy': data['joinChecks']['joinPolicy'],
            'slots': data['slots'],
            'total_rounds': data['totalRounds'],
            'start_time': data['championshipStart']/1000,
            'game_type': data['matchConfiguration']['overview']['elo_mode'],
            'status': data['status'],
            'prize_pool_distribution': PRIZE_POOL_DIST_DEFAULT,
            'service': GAME_SERVICES[data['game']]
        }
    }

    let _data = resp[0];
    return this.parseData(_data, platform);
}

function getTournamentIdFromUrl(link, platform) {
    switch(platform){
        case 'faceit':
            var regex = new RegExp(/[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}/gm);
            break;
        case 'epulze':
            var regex = new RegExp(/\d{2,}/gm);
            break;
    }
    
    return (link.match(regex))?link.match(regex)[0]:null;
}

function checkPlatform(platform) {
    return (PLATFORM_AVAILABLE.includes(platform))?true:false;
}

module.exports = {
    router: router
};