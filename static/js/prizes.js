window.location.hash = '';

var Cards = function(){

    this.domain = '';
    this.lock = false;

	let self = this;

    this.getPrizes = () => {
        axios.get(`${this.domain}/prizes/get/all`)
            .then(function(resp){
                if(resp.data.code == 200){
                    self.fillCards(resp.data.prizes);
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

    this.fillCards = (prizes) => {
        var _html = '';
        if(prizes.length){
            for(let t of prizes){

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

                switch(t.status){
                    case 'wait_for_sign':
                        var _status_class = 'wait',
                            _status = 'Waiting for confirmation';

                        break;
                    case 'signed':
                        var _status_class = 'done',
                            _status = 'Payed';
                        break;
                }

                _html += `
                        <div class="prize">
                                <div class="prize-header">
                                    <div class="prize-tournament">
                                        <span class="game-icon">${game_icon}</span>
                                        ${t.title}
                                    </div>
                                </div>
                                <div class="prize-content">
                                    <div class="column">
                                        <div class="prize-details">

                                            <div class="prize-date">
                                                ${t.start_time.slice(0,-3)}, ${t.count_teams}/${t.slots} teams, ${platform} platform
                                            </div>
                                            <div class="prize-score">
                                                <div class="prize-prize">You won <span>${t.prize} TON</span></div>
                                                <div class="prize-place">for ${t.place} place</div>
                                            </div>
                                            <div class="prize-team">
                                                with team <b>${t.team_name}</b>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="prize-status ${_status_class}">
                                    ${_status}
                                </div>
                            </div>`;
            }
        }else{
            _html = '<div class="no-prizes">No prizes to show yet</div>';   
        }

        document.getElementById("prizes").innerHTML = _html;
    }

    this.openModal = (modal_id) => {
        document.getElementById(modal_id).style.display = 'block';
    }
    this.closeModal = (modal_id) => {
        document.getElementById(modal_id).style.display = 'none';
    }

    this.withdrawLock = () => {
        this.lock = true;
        document.getElementById('withdraw-modal-wrap').innerHTML += '<div id="withdraw-loading" class="loader-wrap blue-spinner" title="loading"><div class="spinner spinner-bounce-middle"></div></div>';
    }

    this.withdrawUnlock = () => {
        this.lock = false;
        document.getElementById('withdraw-loading').outerHTML = '';
    }

    this.withdrawTon = () => {
        if(this.lock) return;

        let _wallet_id = document.getElementById('withdraw-wallet-id').value.trim();
        let _amount = parseFloat(document.getElementById('withdraw-value').value.trim());

        if(!/^[0:]{2}[a-zA-Z0-9]{64}$/.test(_wallet_id)){
            return;
        }
        if(Number.isNaN(_amount)){
            console.log(11)
            return
        }

        let _balance = parseFloat(document.getElementById('wallet-balance').innerText);
        if(_amount > _balance){
            document.getElementById('withdraw-value').value = _balance;
            _amount = _balance;
        }

        this.withdrawLock();

        axios({
            url: `${this.domain}/prizes/wallets/withdraw`,
            method: 'post',
            data: {wallet_id: _wallet_id, amount: _amount}
          })
            .then(function(resp){
                if(resp.data.code == 200){
                    self.withdrawUnlock();
                    self.closeModal('withdraw-modal');
                    self.openModal('success-modal');  

                    self.balanceRefresh();
                }else{
                    self.withdrawUnlock();
                    console.log(resp.data.message);
                    alert('Error 22');
                }
            })
            .catch(function(error){
                console.log(error)
                alert('Error 23')
            })
    }

    this.balanceLock = () => {
        this.lock = true;
        document.querySelector('.wallet-balance').innerText = '...';
        document.querySelector('.wallet-balance-o').innerText = '...';
    }

    this.balanceUnlock = () => {
        this.lock = false;
        document.querySelector('.wallet-balance').innerText = '...';
        document.querySelector('.wallet-balance-o').innerText = '...';
    }

    this.balanceRefresh = () => {
        if(this.lock) return;

        this.balanceLock();
        axios({
            url: `${this.domain}/prizes/wallets/balance/get`,
          })
            .then(function(resp){
                if(resp.data.code == 200){
                    self.balanceUnlock();

                    document.querySelector('.wallet-balance').innerText = resp.data.balance.available;
                    document.querySelector('.wallet-balance-o').innerText = resp.data.balance.available;
                }else{
                    self.balanceUnlock();
                    console.log(resp.data.message);
                    alert('Error 24');
                }
            })
            .catch(function(error){
                console.log(error)
                alert('Error 25')
            })
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
                alert('Error 24')
            })
    }
}