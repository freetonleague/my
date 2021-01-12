var config = require('./modules/config.js');
var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var pg = require('pg');
var path = require('path');
var { v4: uuidv4 } = require('uuid');
var nunjucks = require('nunjucks');
var bodyParser = require('body-parser');
var cors = require('cors')

var Broxus = require('./modules/broxus.js');
const broxus = new Broxus.API();

var app = express();
var http = require('http').createServer(app);

app.use(cors());

// STEAM
var steam = require('steam-login');
global.steam = steam;
app.use(steam.middleware({
    realm: `${config.host}/steam`, 
    verify: `${config.host}/steam/verify`,
    apiKey: config.steamApiKey
}));

var pgSession = require('connect-pg-simple')(session);

http.listen(3030, '127.0.0.1', function(){    
    console.log('listening on *:3030');
});
http.timeout = 5 * 60 * 1000;

app.use('/static', express.static(path.join(__dirname,'static')));

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ 
    extended: true 
}))

global.pgPool = new pg.Pool(config.postgres)
pgPool
    .connect(function(err){
        if(err){
            console.log('Error connection to Postgres');
            return
        }
        console.log('Connection to Postgress established');
    })

nunjucks
    .configure(path.join(__dirname, 'templates'), {
        autoescape: true,
        express: app,
        watch: true
    });

app
    .use(
        new session({ 
            store: new pgSession({
                pool : pgPool,   
                tableName : 'user_sessions'
            }),
            secret: 'someBodyTallMe!#',
            //resave: true,
            saveUninitialized: true,
            cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
        })
    )
    .use(cookieParser());


var sessionRequired = function(req, res, next) {
    if (req.session.user == null) {
        res.redirect('/login');    
        return;
    }
    next();
}
global.sessionRequired = sessionRequired;

// Deprecated
var surfRequired = function(req, res, next) {
    if (req.session.hasOwnProperty('user') && req.session.user.surf_wallet_id == null) {
        res.redirect('/surf/welcome');   
        return; 
    }
    next();
}
global.surfRequired = surfRequired;

var sessionNotRequired = function(req, res, next) {
    if (req.session.user != null) {
        res.redirect('/');    
        return;
    }
    next();
}

var checkWalletBroxus = async function(req) {
    if (!req.session.user.hasOwnProperty('wallet')) {
        
        let service = req.session.user.service;
        let user_id = req.session.user.user_id;
        let userAddress = `${req.session.user.service}_${req.session.user.user_id}`;

        var {broxus_wallet, err} = await broxus.static_addresses_renew(userAddress);
        if(!err){

            let userAddress = await insertNewBroxusWallet(service, user_id, broxus_wallet);
            if(userAddress){
                req.session.user['wallet'] = {
                    'address_type': broxus_wallet['addressType'],
                    'user_address': broxus_wallet['userAddress']
                }
            }

        }

    }
}

// DRY
// TODO: Move to WALLETs namespace
async function insertNewBroxusWallet(service, user_id, broxus_wallet) {
    /* 
        insert new broxus wallet or do nothing if exists
    */
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

var getBalanceBroxus = async function(req) {
    if (req.session.hasOwnProperty('user')) {
        if (req.session.user.hasOwnProperty('wallet')) {

            let user_data = req.session.user.wallet;
            let {users_balance_response, err} = await broxus.users_balance(user_data);
        
            if (!err) {
                let balance = (users_balance_response.length)
                            ?users_balance_response[0]
                            :{currency: 'TON', total: '0', frozen: '0', available: '0'};
                
                req.session.user.wallet.balance = balance;
                req.session.save();
            }

        }
    }
}

app.get('/login', [sessionNotRequired], function(req, res) {
    res.render('login.html');  
});

app.post('/logout', function(req, res) {
    req.session.destroy();
    res.json({'code':200, 'redirect': '/'});
});

app.get('/', [sessionRequired], function(req, res, next) {
    res.redirect('/prizes');
});

app.get('/processing', [sessionRequired], async function(req, res, next) {

    await checkWalletBroxus(req);
    await getBalanceBroxus(req);
    req.session.save();

    res.redirect('/prizes');
});



/* ROUTES */
var steam_router = require('./modules/steam.js')
app.use('/steam', steam_router.router)

var prizes_router = require('./modules/prizes.js')
app.use('/prizes', prizes_router.router)


/*
    // Deprecated
    var surf_router = require('./modules/surf.js')
    app.use('/surf', surf_router.router)

    var faceit_router = require('./modules/faceit.js')
    app.use('/league', faceit_router.router)

    var tournaments_router = require('./modules/tournaments.js')
    app.use('/tournaments', tournaments_router.router)
*/


/* Admin area */
var admin_tournaments_router = require('./modules/admin/tournaments.js')
app.use('/admin/tournaments', admin_tournaments_router.router)

/* Broxus */
var broxus_router = require('./modules/broxus.js')
app.use('/api/broxus', broxus_router.router_api)
