
define(function() {

    var Storage = Class.extend({
        init: function(cloud) {
            this.cloud = cloud || null;
            if(this.hasLocalStorage() && localStorage.data) {
                this.data = JSON.parse(localStorage.data);
            } else {
                this.resetData();
            }
        },
    
        resetData: function() {
            this.data = {
                hasAlreadyPlayed: false,
                player: {
                    name: "",
                    weapon: "",
                    armor: "",
                    image: "",
                    // Progression
                    level: 1,
                    xp: 0
                },
                achievements: {
                    unlocked: [],
                    ratCount: 0,
                    skeletonCount: 0,
                    totalKills: 0,
                    totalDmg: 0,
                    totalRevives: 0
                }
            };
        },
    
        hasLocalStorage: function() {
            return Modernizr.localstorage;
        },
    
        save: function() {
            if(this.hasLocalStorage()) {
                localStorage.data = JSON.stringify(this.data);
            }
            if(this.cloud && this.cloud.isLoggedIn) {
                try { this.cloud.saveState(this.data); } catch(e) {}
            }
        },
    
        clear: function() {
            if(this.hasLocalStorage()) {
                localStorage.data = "";
                this.resetData();
            }
        },

        // Cloud sync helpers
        syncFromCloud: function() {
            var self = this;
            if(!this.cloud || !this.cloud.isLoggedIn || !this.cloud.isLoggedIn()) {
                return Promise.resolve(false);
            }
            return this.cloud.loadState().then(function(state) {
                if(state && typeof state === 'object') {
                    // Shallow merge into local data schema
                    if(state.player) {
                        self.data.player.name = state.player.name || self.data.player.name;
                        self.data.player.weapon = state.player.weapon || self.data.player.weapon;
                        self.data.player.armor = state.player.armor || self.data.player.armor;
                        self.data.player.image = state.player.image || self.data.player.image;
                        if(typeof state.player.level === 'number') self.data.player.level = state.player.level;
                        if(typeof state.player.xp === 'number') self.data.player.xp = state.player.xp;
                    }
                    if(state.achievements) {
                        self.data.achievements.unlocked = state.achievements.unlocked || self.data.achievements.unlocked;
                        self.data.achievements.ratCount = state.achievements.ratCount || self.data.achievements.ratCount;
                        self.data.achievements.skeletonCount = state.achievements.skeletonCount || self.data.achievements.skeletonCount;
                        self.data.achievements.totalKills = state.achievements.totalKills || self.data.achievements.totalKills;
                        self.data.achievements.totalDmg = state.achievements.totalDmg || self.data.achievements.totalDmg;
                        self.data.achievements.totalRevives = state.achievements.totalRevives || self.data.achievements.totalRevives;
                    }
                    self.data.hasAlreadyPlayed = true;
                    self.save();
                    return true;
                }
                return false;
            });
        },
    
        // Player
    
        hasAlreadyPlayed: function() {
            return this.data.hasAlreadyPlayed;
        },
    
        initPlayer: function(name) {
            this.data.hasAlreadyPlayed = true;
            this.setPlayerName(name);
        },
        
        setPlayerName: function(name) {
            this.data.player.name = name;
            this.save();
        },
    
        setPlayerImage: function(img) {
            this.data.player.image = img;
            this.save();
        },

        setPlayerArmor: function(armor) {
            this.data.player.armor = armor;
            this.save();
        },
    
        setPlayerWeapon: function(weapon) {
            this.data.player.weapon = weapon;
            this.save();
        },

        savePlayer: function(img, armor, weapon) {
            this.setPlayerImage(img);
            this.setPlayerArmor(armor);
            this.setPlayerWeapon(weapon);
        },

        // Progression (XP/Level)
        getPlayerLevel: function() {
            return this.data.player.level || 1;
        },

        setPlayerLevel: function(level) {
            this.data.player.level = level;
            this.save();
        },

        getPlayerXp: function() {
            return this.data.player.xp || 0;
        },

        setPlayerXp: function(xp) {
            this.data.player.xp = xp;
            this.save();
        },
    
        // Achievements
    
        hasUnlockedAchievement: function(id) {
            return _.include(this.data.achievements.unlocked, id);
        },
    
        unlockAchievement: function(id) {
            if(!this.hasUnlockedAchievement(id)) {
                this.data.achievements.unlocked.push(id);
                this.save();
                return true;
            }
            return false;
        },
    
        getAchievementCount: function() {
            return _.size(this.data.achievements.unlocked);
        },
    
        // Angry rats
        getRatCount: function() {
            return this.data.achievements.ratCount;
        },
    
        incrementRatCount: function() {
            if(this.data.achievements.ratCount < 10) {
                this.data.achievements.ratCount++;
                this.save();
            }
        },
        
        // Skull Collector
        getSkeletonCount: function() {
            return this.data.achievements.skeletonCount;
        },

        incrementSkeletonCount: function() {
            if(this.data.achievements.skeletonCount < 10) {
                this.data.achievements.skeletonCount++;
                this.save();
            }
        },
    
        // Meatshield
        getTotalDamageTaken: function() {
            return this.data.achievements.totalDmg;
        },
    
        addDamage: function(damage) {
            if(this.data.achievements.totalDmg < 5000) {
                this.data.achievements.totalDmg += damage;
                this.save();
            }
        },
        
        // Hunter
        getTotalKills: function() {
            return this.data.achievements.totalKills;
        },

        incrementTotalKills: function() {
            if(this.data.achievements.totalKills < 50) {
                this.data.achievements.totalKills++;
                this.save();
            }
        },
    
        // Still Alive
        getTotalRevives: function() {
            return this.data.achievements.totalRevives;
        },
    
        incrementRevives: function() {
            if(this.data.achievements.totalRevives < 5) {
                this.data.achievements.totalRevives++;
                this.save();
            }
        },
    });
    
    return Storage;
});
