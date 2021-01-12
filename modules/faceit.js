var express = require('express');
var moment = require('moment');

var router = express.Router();

const ORGANIZER_ID = '';

const STEAM_64_ID = 76561197960265728;

const BRACKET_ROUNDS = ['Final','SemiFinals','QuarterFinals','Round of 16','Round of 32','Round of 64','Round of 128'];
const PLACES_TEAMS = ['2nd', '3-4th', '5-8th', '9-16th', '17-32th', '33-64th', '65-128th']

faceit_api.account().then(data => console.log(data));

router.get('/get/championships', [sessionRequired, surfRequired], async function(req, res, next) {
    if (req.session.user == null) {
        res.redirect('/login');    
        return;
    }

    var _statusesAllowed = [];
    let _q = req.query.q || 'finished';
    let _t = req.query.t || 'onlychamp';
    switch(_q){
        case 'all':
            _statusesAllowed = ['finished','started','join']
            break;
        case 'finished':
            _statusesAllowed = ['finished']
            break;
    }

    organizers_championships = await faceit_api.organizers(ORGANIZER_ID,'championships',20).catch(err => {
        return res.json({'code': 404, 'message': 'Not found'});
    });

    var championships = [];
    for(let i in organizers_championships['items']){
        if(['finished'].includes(organizers_championships['items'][i]['status'])){
            let _championship_id = organizers_championships['items'][i]['championship_id'];
            if(_t != 'onlychamp'){
                organizers_championships['items'][i]['user_info'] = await calculateUserPrize(_championship_id);
            }
        }

        if(_statusesAllowed.includes(organizers_championships['items'][i]['status'])){
            championships.push(organizers_championships['items'][i]);
        }
    }
    
    championships = await updateChampionships(championships);

    res.json({'code':200, 'championships': championships})
})

async function calculateUserPrize(championship_id){
    let raw_matches = await faceit_api.championships(championship_id, 'matches', 'past', 100)
    
    let matches = prepareMatches(raw_matches['items']);
    
    let rounds = prepareRounds(matches);
    
    let named_rounds = prepareNamedRounds(rounds);
    
    let teams_places = prepareTeamsPlaces(named_rounds);

    let prizepool_distribution = await getPrizepoolDistribution(championship_id);

    let user_place = getUserPlace(teams_places, req.session.steamid);

    let user_prize = (prizepool_distribution)?prizepool_distribution[user_place]:0;

    return {'place': user_place, 'prize': user_prize, 'team_name': user_team_name};
}

router.get('/get/championships/:championship_id', [sessionRequired, surfRequired], async function(req, res, next) {
    if (req.session.user == null) {
        res.redirect('/login');    
        return;
    }

    let championship_id = req.params['championship_id'];

    championship_info = await faceit_api.championships(championship_id).catch(err => {
        return res.json({'code': 404, 'message': 'Not found'});
    });

    let raw_matches = await faceit_api.championships(championship_id, 'matches', 'past', 100)
    
    let matches = prepareMatches(raw_matches['items']);
    
    let rounds = prepareRounds(matches);
    
    let named_rounds = prepareNamedRounds(rounds);
    
    let teams_places = prepareTeamsPlaces(named_rounds);

    //let user_place = getUserPlace(teams_places, req.session.steamid);
    let {user_place, user_team_name} = getUserPlaceAndTeam(teams_places, '76561198010093511');

    let prizepool_distribution = await getPrizepoolDistribution(championship_id);
    
    res.json({
        'code':200, 
        'info':championship_info, 
        'user_place': user_place, 
        'user_team_name':user_team_name, 
        'rounds': named_rounds,
        'places': teams_places,
        'prizepool_distribution': prizepool_distribution
    });

});

async function getPrizepoolDistribution(championship_id){
    let _raw = `
        select prizepool_distribution
        from championships
        where championship_id = $1::text`;
    let _resp = await pgPool
                        .query(_raw, [championship_id])
                        .catch((e) => console.log(e.stack))
    // response
    let data = {};
    if(_resp.rowCount){
        data = _resp.rows[0]['prizepool_distribution'];
    }

    return data;
}

async function updateChampionships(championships){
    let _raw = `
        select 
            championship_id, approve_status, prizepool
        from championships`;
    let _resp = await pgPool
                        .query(_raw, [])
                        .catch((e) => console.log(e.stack))
    
    for(var row of _resp.rows.values()){
        for(c in championships){
            let _c = championships[c];
            if(_c['championship_id'] == row['championship_id']){
                _c['prizepool'] = row['prizepool'];
                _c['approve_status'] = row['approve_status'];
                _c['start_datetime'] = moment(_c['championship_start']).format("YYYY/MM/DD HH:mm");

                championships[c] = _c;
                continue;
            }
        }
    }

    championships.reverse();

    return championships;
}

function getUserPlaceAndTeam(places, steamid){

    for(let place in places){
        let teams = places[place];
        for(let team of teams){
            for(let player of team['roster']){
                if(steamid == player['steam_id']){
                    return {user_place: place, user_team_name: team['name']};
                }
            }
        }
    }
    return 'not_found';
}

function prepareTeamsPlaces(r){
    var places = {'1st': [], '2nd': [], '3-4th': [], '5-8th': [], '9-16th': [], '17-32th': [], '33-64th': [], '65-128th': []}
    
    places['1st'].push(r[0]['matches'][0][r[0]['matches'][0]['team_win']]);

    for(let i=r.length-1;i>=0;i--){
        for(let m in r[i]['matches']){
            if (r[i]['matches'][m]['team_lose_name'] == 'bye') continue;
            let _team = r[i]['matches'][m]['team_lose'];
            places[PLACES_TEAMS[i]].push(r[i]['matches'][m][_team]);
        }

    }

    Object.entries(places).map((p)=>{if(!p[1].length) delete places[p[0]]})

    return places;
}

function prepareNamedRounds(r){
    
    named_rounds = [];
    Object.keys(r).sort().reverse().forEach(function(key, i) {
        named_rounds.push({
            'title': BRACKET_ROUNDS[i],
            'matches': r[key]['matches']
        })
    });

    return named_rounds;
}

function prepareRounds(r){
    var rounds = {};
    for(let m of r.values()){
        rounds[m['round']] = rounds[m['round']] || {'matches':[]};
        rounds[m['round']]['matches'].push(m);
    }
    return rounds;
}

function prepareMatches(r){
    var matches = [];
    var rgxSteamId = /\d{2,}/g;

    for(let i in r){
        let m = r[i];

        var rosters = {'faction1':[], 'faction2':[]};
        for(f of ['faction1','faction2'].values()){
            for(let l in m['teams'][f]['roster']){
                let player = m['teams'][f]['roster'][l];
                let matchSteamId = player['game_player_id'].match(rgxSteamId);
                let steam_id = BigInt(STEAM_64_ID) + BigInt(parseInt(matchSteamId[0]));
                rosters[f].push({
                    'nickname': player['nickname'],
                    'steam_id': steam_id.toString(),
                    'game_player_id': player['game_player_id'],
                    'game_player_name': player['game_player_name'],
                    'game_skill_level': player['game_skill_level']
                })
            }
        }

        let match = {
            'team1': {
                'roster': rosters['faction1'],
                'name': m['teams']['faction1']['name'],
            },
            'team2': {
                'roster': rosters['faction2'],
                'name': m['teams']['faction2']['name'],
            },
            'round': m['round'],
            'team_win': m['results']['winner'].replace('faction','team'),
            'team_win_name': m['teams'][m['results']['winner']]['name'],
            'team_lose': (m['results']['winner']=='faction1')?'team2':'team1',
            'team_lose_name': (m['results']['winner']=='faction1')?m['teams']['faction2']['name']:m['teams']['faction1']['name'],
            'time_start': m['configured_at'],
            'time_duration': m['finished_at'] - m['configured_at']
        }
        matches.push(match);
    }
    return matches;
}

module.exports = {
    router: router
};