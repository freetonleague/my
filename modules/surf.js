var express = require('express');

var router = express.Router();

var surfNotRequired = function(req, res, next) {
    if (req.session.hasOwnProperty('user') && req.session.user.surf_wallet_id != null) {
        res.redirect('/');   
        return; 
    }
    next();
}
 
router.get('/welcome', [sessionRequired, surfNotRequired], function(req, res) {
    res.render('surf_welcome.html')
});

router.get('/edit', [sessionRequired, surfRequired], function(req, res) {
    res.render('surf_edit.html', {'user': req.session.user})
});

router.post('/update', [sessionRequired], function(req, res) {

    let _from = req.query.from || 'championships';

    var _resp = {'code':200,'redirect':`/${_from}`};

    let walletid = req.body.walletid;

    let user_data = req.session.user;
    
    if(!newOrUpdateSerfWallet(walletid, user_data)){
        _resp = {'code':500, 'message':'Can not update user with surf wallet id'}
    }

    req.session.user.surf_wallet_id = walletid;
    req.session.save();
    
    res.json(_resp)
});

async function newOrUpdateSerfWallet(walletid, user_data){
    
    let _raw = `
        update users  
            set surf_wallet_id = $1::text
        where steamid = $2::text
        RETURNING id`;
    let _resp = await pgPool.query(_raw, [walletid, user_data['steamid']])
                        .catch((e) => {console.log(e.stack); return false});
    if(_resp.rowCount){
        
    }          
    console.log(`User update surf_wallet_id: ${user_data['personaname']} -> ${walletid}`);
    
    return true;
}

module.exports = {
    router: router
};