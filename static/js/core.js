var Championships = function() {

	this.domain = '';

	let self = this;

	let loading_div = `<div class="loader-wrap" title="loading">
						  <div class="loader-overlay"></div>
						  <div class="loader-spin">
							  <svg version="1.1" class="svg-loader" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
							     width="24px" height="30px" viewBox="0 0 24 30" style="enable-background:new 0 0 50 50;" xml:space="preserve">
							    <rect x="0" y="10" width="4" height="10" fill="#333" opacity="0.2">
							      <animate attributeName="opacity" attributeType="XML" values="0.2; 1; .2" begin="0s" dur="0.6s" repeatCount="indefinite" />
							      <animate attributeName="height" attributeType="XML" values="10; 20; 10" begin="0s" dur="0.6s" repeatCount="indefinite" />
							      <animate attributeName="y" attributeType="XML" values="10; 5; 10" begin="0s" dur="0.6s" repeatCount="indefinite" />
							    </rect>
							    <rect x="8" y="10" width="4" height="10" fill="#333"  opacity="0.2">
							      <animate attributeName="opacity" attributeType="XML" values="0.2; 1; .2" begin="0.15s" dur="0.6s" repeatCount="indefinite" />
							      <animate attributeName="height" attributeType="XML" values="10; 20; 10" begin="0.15s" dur="0.6s" repeatCount="indefinite" />
							      <animate attributeName="y" attributeType="XML" values="10; 5; 10" begin="0.15s" dur="0.6s" repeatCount="indefinite" />
							    </rect>
							    <rect x="16" y="10" width="4" height="10" fill="#333"  opacity="0.2">
							      <animate attributeName="opacity" attributeType="XML" values="0.2; 1; .2" begin="0.3s" dur="0.6s" repeatCount="indefinite" />
							      <animate attributeName="height" attributeType="XML" values="10; 20; 10" begin="0.3s" dur="0.6s" repeatCount="indefinite" />
							      <animate attributeName="y" attributeType="XML" values="10; 5; 10" begin="0.3s" dur="0.6s" repeatCount="indefinite" />
							    </rect>
							  </svg>
							</div>
						</div>`;

	this.addLoader = (_target) => {
		if($(_target).find('.loader-wrap').length) return;
		$(_target).append(loading_div);
	}
	this.removeLoader = (_target) => {
		$(_target).find('.loader-wrap').remove();
	}

	this.getChapmionships = () => {
		this.addLoader('#my-league-sidebar');
		axios.get(`${this.domain}/league/get/championships/`)
			.then(function(resp){
				if(resp.data.code == 200){
					self.fillSidebar(resp.data.championships);
				}else{
					alert(resp.data.message);
				}
			})
			.catch(function(error){
				console.log(error)
				alert('Error')
			})
			.then(function(){
				self.bindClick();
				setTimeout(function(){
					self.removeLoader('#my-league-sidebar');
				}, 300);
			})
	}

	this.loadChampionship = (championship_id) => {
		if(championship_id == $('#championship-details .championship-details').data("championship-id")) return;
		this.addLoader('#championship-details-container');
		$('.place-history-placeholder').addClass('is-hidden');
		axios.get(`${this.domain}/league/get/championships/${championship_id}`)
			.then(function(resp){
				if(resp.data.code == 200){
					self.fillContent(resp.data);
				}else{
					alert(resp.data.message);
				}
			})
			.catch(function(error){
				$('.place-history-placeholder').removeClass('is-hidden');
				console.log(error)
				alert('Error')
			})
			.then(function(){
				setTimeout(function(){
					self.removeLoader('#championship-details-container');
				}, 300);
			})
	}

	this.fillContent = (championship) => {
		let _places = '';
		for(var _p in championship['places']){
			var _place = championship['places'][_p];
			for(let _team of _place){
				let _roster = _team['roster'].map((_player)=>_player['nickname']).join(' · ');
				var _yourteam_cl = '',_yourteam_tag = '';
				if(championship['user_team_name'] == _team['name']){
					_yourteam_cl = ' your-team',
					_yourteam_tag = '<span class="team">your team</span>';
				}
				_places += `<div class="place${_yourteam_cl}">
								<div class="place-details">
									<div class="place-title">
										${_team['name']}
										<span class="prize">💎 ${championship['prizepool_distribution'][_p]}</span>
										${_yourteam_tag}
									</div>
									<div class="place-date">${_roster}</div>
								</div>
								<div class="place-value">
									<div class="value-unit">
										${_p.slice(0,-2)}<sup class="value-subunit">${_p.slice(-2)}</sup>
									</div>
								</div>
							</div>`;
			}
		}

		if(typeof championship['user_place'] !== 'undefined'){
			let user_prize = championship['prizepool_distribution'][championship['user_place']];
			var _header = `<div class="row championship_title">
							${championship['info']['name']}
						</div>
						<div class="row">
							Your Place <b>${championship['user_place']}</b> 
							<span class="prize">YOU WIN 💎 ${user_prize}</span>
						</div>
						<!--div class="row">
							<div class="btn-get-prize">PICK UP MY PRIZE</div>
						</div-->`;
		}else{
			var _header = `<div class="row championship_title">
							${championship['info']['name']}
						</div>
						<div class="row mute">You did not play this tournament</div>`;
		}
		
		let _html = `<div class="championship-details" data-championship-id="${championship['info']['championship_id']}">
						<div class="championship-detail">
							${_header}
						</div>
						<div class="places-title">Tournament places</div>
						<div class="place-history">
							${_places}
						</div>
					</div>`;
		document.getElementById("championship-details").innerHTML = _html;
		setTimeout(function(){
			$("#championship-details .championship-details").addClass('is-selected');
		},10)
	}

	this.fillSidebar = (championships) => {
		var _html = '';
		for(let c of championships){

			switch(c.game_id){
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

			_html += `<div class="championship" data-championship="${c.championship_id}" onclick="champs.loadChampionship('${c.championship_id}')">
						<div class="championship-game-type">
							${game_icon}
						</div>
						<div class="championship-title">${c.name}</div>
						<div class="championship-prize row-span">Prizepool <span>💎 ${c.prizepool}</span></div>
						<div class="championship-teams row-span">Teams <span>${c.current_subscriptions} / ${c.slots}</span></div>
						<div class="championship-date row-span">Date <span>${c.start_datetime}</span></div>
						<div class="championship-status row-span"><span>${c.status}</div></div>
					</div>`
		}

		document.getElementById("championships-container").innerHTML = _html;
		setTimeout(function(){
			$("#championships-container .championship").addClass('is-loaded');
		},10)
	}

	this.bindClick = () => {
		// Set active championship
		$(document).on('click','.my-league-sidebar .championship:not(.is-selected)', function() {
			var game = $(this),
				championship = $('[data-championship="' + $(this).attr('data-championship') +'"]'),
				championships = $("#championships-container .championship"),
				selected = $('.is-selected');
				notselected = $('.not-selected');
			
			championships.addClass('not-selected');
			championship.addClass('is-selected').removeClass('not-selected');
			selected.removeClass('is-selected');
	
		});
	}

	this.openUserModal = () => {
		$('#user-modal').fadeIn("fast");
	}
	this.closeUserModal = () => {
		$('#user-modal').fadeOut("fast");
	}
	
	this.logout = () => {
    	axios({
        	url: `${this.domain}/logout`,
        	method: 'post'
    	  })
        	.then(function(resp){
        		if(resp.data.code == 200){
        			window.location = resp.data.redirect;
        		}else{
        			alert(resp.data.message);
        		}
        	})
        	.catch(function(error){
        		console.log(error)
        		alert('Error')
        	})
    }

}



var Surf = function() {

	this.domain = '';
	this._from = new URLSearchParams(window.location.search).get('from') || 'championships';

	let self = this;

	let loading_div = `<div class="loader-wrap" title="loading">
						  <div class="loader-overlay"></div>
						  <div class="loader-spin">
							  <svg version="1.1" class="svg-loader" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
							     width="24px" height="30px" viewBox="0 0 24 30" style="enable-background:new 0 0 50 50;" xml:space="preserve">
							    <rect x="0" y="10" width="4" height="10" fill="#333" opacity="0.2">
							      <animate attributeName="opacity" attributeType="XML" values="0.2; 1; .2" begin="0s" dur="0.6s" repeatCount="indefinite" />
							      <animate attributeName="height" attributeType="XML" values="10; 20; 10" begin="0s" dur="0.6s" repeatCount="indefinite" />
							      <animate attributeName="y" attributeType="XML" values="10; 5; 10" begin="0s" dur="0.6s" repeatCount="indefinite" />
							    </rect>
							    <rect x="8" y="10" width="4" height="10" fill="#333"  opacity="0.2">
							      <animate attributeName="opacity" attributeType="XML" values="0.2; 1; .2" begin="0.15s" dur="0.6s" repeatCount="indefinite" />
							      <animate attributeName="height" attributeType="XML" values="10; 20; 10" begin="0.15s" dur="0.6s" repeatCount="indefinite" />
							      <animate attributeName="y" attributeType="XML" values="10; 5; 10" begin="0.15s" dur="0.6s" repeatCount="indefinite" />
							    </rect>
							    <rect x="16" y="10" width="4" height="10" fill="#333"  opacity="0.2">
							      <animate attributeName="opacity" attributeType="XML" values="0.2; 1; .2" begin="0.3s" dur="0.6s" repeatCount="indefinite" />
							      <animate attributeName="height" attributeType="XML" values="10; 20; 10" begin="0.3s" dur="0.6s" repeatCount="indefinite" />
							      <animate attributeName="y" attributeType="XML" values="10; 5; 10" begin="0.3s" dur="0.6s" repeatCount="indefinite" />
							    </rect>
							  </svg>
							</div>
						</div>`;

	this.addLoader = (_target) => {
		if($(_target).find('.loader-wrap').length) return;
		$(_target).append(loading_div);
	}
	this.removeLoader = (_target) => {
		$(_target).find('.loader-wrap').remove();
	}

	this.sendWalletId = (from_url) => {
        let _walletid = document.getElementById("wallet-id").value;
        if(!/^[0:]{2}[a-zA-Z0-9]{64}$/.test(_walletid)){
        	var _s = document.getElementById("wront-surf");
            _s.style.display = 'block';
            return;
        }

        this.addLoader('body');
        axios({
        	url: `${this.domain}/surf/update?from=${self._from}`,
        	method: 'post',
        	data: {'walletid': _walletid}
    	  })
        	.then(function(resp){
        		if(resp.data.code == 200){
        			window.location = resp.data.redirect;
        		}else{
        			alert(resp.data.message);
        		}
        	})
        	.catch(function(error){
        		console.log(error)
        		alert('Error')
        	})
        	.then(function(){
        		setTimeout(function(){
        			self.removeLoader('body');
        		}, 300);
        	})
        
    }

    this.getBack = () => {
    	window.location = `/${this._from}`;
    }

    this.checkWalletId = () => {
        var _s = document.getElementById("wront-surf");
        _s.style.display = 'none';
    }


}