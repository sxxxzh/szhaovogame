define(function() {

    var CloudStorage = Class.extend({
        init: function(options) {
            options = options || {};
            this.apiBase = options.apiBase || 'https://gameapi.szhaovo.cn';
            this.gameKey = options.gameKey || 'browserquest';
            this.TOKEN_KEY = 'auth_token';
        },

        getToken: function() {
            try {
                return localStorage.getItem(this.TOKEN_KEY);
            } catch(e) {
                return null;
            }
        },

        isLoggedIn: function() {
            return !!this.getToken();
        },

        getAuthHeaders: function() {
            var token = this.getToken();
            return token ? { 'Authorization': 'Bearer ' + token } : {};
        },

        saveState: function(state) {
            // Fire-and-forget; caller should not depend on this being synchronous
            if(!this.isLoggedIn()) { return Promise.resolve(false); }
            try {
                return fetch(this.apiBase + '/api/state/save', {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify({ game_key: this.gameKey, state: state })
                }).then(function(resp) {
                    return resp.ok;
                }).catch(function() { return false; });
            } catch(e) {
                return Promise.resolve(false);
            }
        },

        loadState: function() {
            // Returns Promise resolving to state object or null
            if(!this.isLoggedIn()) { return Promise.resolve(null); }
            try {
                var url = this.apiBase + '/api/state/load?game_key=' + encodeURIComponent(this.gameKey);
                return fetch(url, { headers: this.getAuthHeaders() })
                    .then(function(resp) { if(!resp.ok) { throw new Error('Bad response'); } return resp.json(); })
                    .then(function(data) {
                        // Expect data like { state: {...} } or direct object
                        if(data && data.state) { return data.state; }
                        return data || null;
                    })
                    .catch(function() { return null; });
            } catch(e) {
                return Promise.resolve(null);
            }
        }
    });

    return CloudStorage;
});