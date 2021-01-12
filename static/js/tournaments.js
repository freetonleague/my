window.location.hash = '';

var Card = function(){

    this.domain = '';

	let self = this;

	this.openModal = (tournament_id, prize) => {
		let _html = `<div class="wrap">
					    <a onclick="card.closeModal()" title="Close" class="modal-close">Close</a>
					    <div class="title">Your prize ${prize} TON</div>
					    <div class="sub-title">TON wallet id</div>
					    <div class="wallet-id">
					    	{{user.surf_wallet_id}}
					    </div>
					    <div class="request" onclick="requestPrize('${tournament_id}')">
					    	Request prize to TON wallet id 
					    </div>
					</div><div class="backside" onclick="card.closeModal()"></div>`;
		document.getElementById("open-modal").innerHTML = _html;
		window.location.hash = 'open-modal';
	}

	this.closeModal = () => {
		document.getElementById("open-modal").innerHTML = '';
		window.location.hash = '_';
	}

    this.getTournaments = () => {
        axios.get(`${this.domain}/tournaments/get/all`)
            .then(function(resp){
                if(resp.data.code == 200){
                    self.fillTournaments(resp.data.tournaments);
                }else{
                    alert(resp.data.message);
                }
            })
            .catch(function(error){
                console.log(error)
                alert('Error')
            })
            .then(function(){
            })
    }

    this.fillTournaments = (tournaments) => {

        var _html = '';
        if(tournaments.length){
            for(let t of tournaments){

                if(typeof t.user_data.place === 'undefined') continue;

                switch(t.platform){
                    case 'faceit':
                        var platform = 'FACEIT';
                }

                switch(t.game){
                    case 'csgo':
                        var game_icon = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 28 28" class="icon--24 icon-disciplines">
                                            <g class="icon-game--cs-go" fill="none" fill-rule="nonzero">
                                                <rect class="icon-game__fill--E9A21A" width="28" height="28" rx="4"></rect>
                                                <path class="icon-game__fill--313E77" d="M4 0h10v17l3.758 11H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4z"></path>
                                                <path class="icon-game__fill--FF-and-FF" d="M27 4.201h-2.747v-.33h-.217v-.88h-.324v.99h-.325v-.22H17.44v-.22h-.65l-1.319.33-.108-.66.779-.44V1.65l-.109-.22-.108-.22V.88C15.621.44 14.54 0 13.956 0c-.606 0-1.147.066-1.752.99-.606.924-.217 2.001-.217 2.001v.55c-.281-.242-.887-.33-.887-.33-1.6 0-2.314 2.486-2.314 3.322 0 .835.108 1.451.108 1.451h-.887c-.281 0-.325.594-.325 1.21-.021.616-.194 1.584-.108 1.782.065.176.779.22.779.22s-.195.088-.433.44c-.26.373 0 1.341 0 1.341v1.562l-.151.088-.216.22v.33l.108.22-.108.33v.44l.216.33s-.087.571-.216 1.21c-.13.66-.109 2.33-.109 2.33-.302.023-.324.44-.324.44s-.065.089-.433.66c-.39.572-.497 1.144-.54 1.562-.065.418-.347.726-.65 1.21-.324.484.217 1.1.217 1.1-.563 1.385-.692 2.375-.714 2.969h2.098a3.838 3.838 0 0 1-.173-1.1c0-.616.541-1.671.541-1.671l.433-.11.108-.44c.086-.374.476-1.166.779-1.782.28-.616 0-.99 0-.99l.216-.55.324-.33.433-.55.325-.44.108-.55s.238-.725.324-1.209c.087-.506.779-1.21.779-1.21l.108-.55.541.88.649.11 1.428 2.332h.778l.217.22v.99l-.325.44.217 1.671.108 1.21.216.22.216 1.671-.324.22-.108 1.54h4.283v-.088l-.108-.33-.433-.22-.54-.22-1.104-1.21.108-1.561.217-.44v-.77l-.217-.44.217-1.1.108-2.111-.217-.11v-.66h-.216s-.433-1.254-.649-1.892c-.238-.637-1.038-1.781-1.428-2.111-.389-.33-.41-.902-.432-1.1-.022-.22.216-.44.216-.44s.108.066.325.11c.216.044.216-.11.216-.11l.216-.44.216-.33.109-.99V9.987c-.065-.55-.541-.77-.541-.77l.108-.44.433.22.54.22.65.33.778.22.541-.11.54-.33.542-.77.216-.99.324-.11.109-.22-.109-.44v-.99l.433-.33.108-.22.325-.22h2.53v-.329h3.527v-.506H27zm-9.02 2.552l-.325-.66.887.11-.563.55zm.778-.88h-.649l.216-.44h.433v.44z"></path>
                                            </g>
                                        </svg>`;
                        break;
                    case 'dota2':
                        var game_icon = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 28 28" class="icon--24 icon-disciplines">
                                            <g class="icon-game--dota2" fill="none" fill-rule="nonzero">
                                                <rect class="icon-game__fill--A51C0F" width="28" height="28" rx="4"></rect>
                                                <path class="icon-game__fill--FF-and-FF" d="M20.21 4l1.685 1.669-.72 3.887-4.543-4.173L20.21 4zM6.345 24L4 21.126l1.644-4.904 4.672 5.77L6.346 24zm16.135-1.378l-3.3.267L4 5.136 5.26 4h1.02L24 17.52l-1.52 5.102z"></path>
                                            </g>
                                        </svg>`;
                        break;
                }

                _html += `
                        <div class="match" data-tournament="${t.tournament_id}">
                                <div class="match-header">
                                    <div class="match-tournament">
                                        <span class="game-icon">${game_icon}</span>
                                        ${t.title}
                                    </div>
                                </div>
                                <div class="match-content">
                                    <div class="column">
                                        <div class="match-details">

                                            <div class="match-date">
                                                ${t.start_time}, ${Object.keys(t.teams).length}/${t.slots} teams, ${platform} platform
                                            </div>
                                            <div class="match-score">
                                                <div class="match-prize">You won <span>${t.user_data.prize} TON</span></div>
                                                <div class="match-place">for ${t.user_data.place} place</div>
                                            </div>
                                            <div class="match-team">
                                                with team <b>${t.user_data.team.name}</b>
                                            </div>
                                            
                                            <!--button class="match-bet-place" onclick="card.openModal('${t.tournament_id}',${t.user_data.prize});">Get my prize</button-->
                                        </div>
                                    </div>
                                </div>
                            </div>`;
            }
        }else{
            _html = '<div class="no-matches">No tournament to show yet</div>';   
        }

        document.getElementById("matches").innerHTML = _html;
    }
}