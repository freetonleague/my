var express = require('express');

var router = express.Router();

 
router.get('/authenticate', steam.authenticate());
 
router.get('/verify', steam.verify(), async function(req, res) {

    let _user = await newOrUpdateUser(req.user._json);
    if (Object.keys(_user).length){
        req.session.user = _user;
        req.session.save();
        res.redirect('/processing');
    }else{
        res.send('Something went wrong ...');
    }
});

async function newOrUpdateUser(user_data){
    
    var _user = {};

    // 1
    let _insert_data = [
        user_data['steamid'], 
        user_data['personaname']
    ];
    let _raw_insert = `
        insert into users 
            (user_id, personaname, role, service)
        values ($1::text, $2::text, 'player', 'steam')
        ON CONFLICT (user_id) DO UPDATE
        SET personaname = $2::text
        RETURNING id`;
    let _resp_insert = await pgPool.query(_raw_insert, _insert_data)
                        .catch((e) => {console.log(e.stack); return _user});
      
    // 2
    let _raw_select = `select 
                            u.id, 
                            u.user_id, 
                            u.personaname, 
                            u.role, 
                            u.service,
                            uw.address_type,
                            uw.user_address
                        from users u
                        left join users_broxus_wallets uw on uw.user_id = u.user_id and u.service = uw.user_service
                        where u.user_id = $1::text
                        and service = 'steam'
                        `;
    let _resp_select = await pgPool
                        .query(_raw_select, [user_data['steamid']])
                        .catch((e) => console.log(e.stack))
    if(_resp_select.rowCount){
        _user = {
            'id': _resp_select.rows[0]['id'],
            'user_id': _resp_select.rows[0]['user_id'],
            'personaname': _resp_select.rows[0]['personaname'],
            'role': _resp_select.rows[0]['role'],
            'service': _resp_select.rows[0]['service']
        }
        if (_resp_select.rows[0]['address_type'] && _resp_select.rows[0]['user_address']){
            _user['wallet'] = {
                'address_type': _resp_select.rows[0]['address_type'],
                'user_address': _resp_select.rows[0]['user_address']
            }
        }
    }
    
    return _user;
}

module.exports = {
    router: router
};