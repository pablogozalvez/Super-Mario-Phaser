const loadingGif = document.querySelectorAll('.loading-gif');
const mobileDevice = isMobileDevice();
const screenWidth = window.innerWidth;
const screenHeight = window.innerHeight * 1.1;
const velocityX = screenWidth / 4.5;
const velocityY = screenHeight / 1.15;
const levelGravity = velocityY * 2;
const worldWidth = screenWidth * 11;
const platformHeight = screenHeight / 5;
const startOffset = screenWidth / 2.5;
const platformPieces = 100;
const platformPiecesWidth = (worldWidth - screenWidth) / platformPieces;

var config = {
    type: Phaser.AUTO,
    width: screenWidth,
    height: screenHeight,
    backgroundColor: 0x8585FF,
    parent: 'game',
    preserveDrawingBuffer: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: levelGravity },
            debug: false
        }
    },
    scene: {
        key: 'level-1',
        preload: preload,
        create: create,
        update: update
    },
    version: '0.7.3'
};

var isLevelOverworld;
var worldHolesCoords = [];
var emptyBlocksList = [];
var player, playerController;
var playerState = 0;
var playerInvulnerable = false;
var playerBlocked = false;
var playerFiring = false;
var fireInCooldown = false;
var furthestPlayerPos = 0;
var flagRaised = false;
var score = 0;
var timeLeft = 300;
var levelStarted = false;
var reachedLevelEnd = false;
var smoothedControls;
var gameOver = false;
var gameWinned = false;

var controlKeys = {
    JUMP: null,
    DOWN: null,
    LEFT: null,
    RIGHT: null,
    FIRE: null,
    PAUSE: null
};

var game = new Phaser.Game(config);

// ======================
// FUNGSI UTILITAS
// ======================
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function generateRandomCoordinate(entitie = false, ground = true) {
    const startPos = entitie ? screenWidth * 1.5 : screenWidth;
    const endPos = entitie ? worldWidth - screenWidth * 3 : worldWidth;
  
    let coordinate = Phaser.Math.Between(startPos, endPos);
  
    if (!ground) return coordinate;
  
    for (let hole of worldHolesCoords) {
      if (coordinate >= hole.start - platformPiecesWidth * 1.5 && coordinate <= hole.end) {
        return generateRandomCoordinate.call(this, entitie, ground);
      }
    }
  
    return coordinate;
}

function addToScore(points, entity) {
    score += points;
    if (this.scoreText) this.scoreText.setText('SCORE: ' + score);
}

function applyPlayerInvulnerability(duration) {
    playerInvulnerable = true;
    player.setTint(0xff0000);
    setTimeout(() => {
        playerInvulnerable = false;
        player.clearTint();
    }, duration);
}

// ======================
// KELAS KONTROL
// ======================
class SmoothedHorionztalControl {
    constructor(speed) {
        this.msSpeed = speed;
        this.value = 0;
    }

    moveLeft(delta) {
        if (this.value > 0) this.reset();
        this.value -= this.msSpeed * 3.5;
        if (this.value < -1) this.value = -1;
        playerController.time.rightDown += delta;
    }

    moveRight(delta) {
        if (this.value < 0) this.reset();
        this.value += this.msSpeed * 3.5;
        if (this.value > 1) this.value = 1;
        playerController.time.leftDown += delta;
    }

    reset() {
        this.value = 0;
    }
}


function preload() {
    setupLoadingScreen.call(this);
    loadFontsAndPlugins.call(this);
    determineLevelStyle.call(this);
    loadGameAssets.call(this);
}

function setupLoadingScreen() {
    var progressBox = this.add.graphics();
    var progressBar = this.add.graphics();
    progressBox.fillStyle(0x222222, 1);
    progressBox.fillRoundedRect(screenWidth / 2.48, screenHeight / 2 * 1.05, screenWidth / 5.3, screenHeight / 20.7, 10);
    
    var percentText = this.make.text({
        x: screenWidth / 2,
        y: screenHeight / 2 * 1.25,
        text: '0%',
        style: {
            font: screenWidth / 96 + 'px pixel_nums',
            fill: '#ffffff'
        }
    });
    percentText.setOrigin(0.5, 0.5);
    
    this.load.on('progress', function (value) {
        percentText.setText(value * 99 >= 99 ? 'Generating world...' : 'Loading... ' + parseInt(value * 99) + '%');
        progressBar.clear();
        progressBar.fillStyle(0xffffff, 1);
        progressBar.fillRoundedRect(screenWidth / 2.45, screenHeight / 2 * 1.07, screenWidth / 5.6 * value, screenHeight / 34.5, 5);
    });
    
    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        percentText.destroy();
        loadingGif.forEach(gif => {gif.style.display = 'none';});
    });
}

function loadFontsAndPlugins() {
    this.load.bitmapFont('carrier_command', 'assets/fonts/carrier_command.png', 'assets/fonts/carrier_command.xml');
    this.load.plugin('rexvirtualjoystickplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js', true);
    this.load.plugin('rexcheckboxplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexcheckboxplugin.min.js', true);
    this.load.plugin('rexsliderplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexsliderplugin.min.js', true);
    this.load.plugin('rexkawaseblurpipelineplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexkawaseblurpipelineplugin.min.js', true);
}

function determineLevelStyle() {
    isLevelOverworld = Phaser.Math.Between(0, 100) <= 84;
}

function loadGameAssets() {
    loadCharacterSprites.call(this);
    loadEnvironmentAssets.call(this);
    loadAudioAssets.call(this);
}

function loadCharacterSprites() {
    let levelStyle = isLevelOverworld ? 'overworld' : 'underground';
    
    this.load.spritesheet('mario', 'assets/entities/mario.png', { frameWidth: 18, frameHeight: 16 });
    this.load.spritesheet('mario-grown', 'assets/entities/mario-grown.png', { frameWidth: 18, frameHeight: 32 });
    this.load.spritesheet('mario-fire', 'assets/entities/mario-fire.png', { frameWidth: 18, frameHeight: 32 });
    this.load.spritesheet('goomba', 'assets/entities/' + levelStyle + '/goomba.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('koopa', 'assets/entities/koopa.png', { frameWidth: 16, frameHeight: 24 });
    this.load.spritesheet('shell', 'assets/entities/shell.png', { frameWidth: 16, frameHeight: 15 });
    this.load.spritesheet('fireball', 'assets/entities/fireball.png', { frameWidth: 8, frameHeight: 8 });
    this.load.spritesheet('fireball-explosion', 'assets/entities/fireball-explosion.png', { frameWidth: 16, frameHeight: 16 });
}

function loadEnvironmentAssets() {
    let levelStyle = isLevelOverworld ? 'overworld' : 'underground';
    
    // Load props
    this.load.image('cloud1', 'assets/scenery/overworld/cloud1.png');
    this.load.image('cloud2', 'assets/scenery/overworld/cloud2.png');
    this.load.image('mountain1', 'assets/scenery/overworld/mountain1.png');
    this.load.image('mountain2', 'assets/scenery/overworld/mountain2.png');
    this.load.image('fence', 'assets/scenery/overworld/fence.png');
    this.load.image('bush1', 'assets/scenery/overworld/bush1.png');
    this.load.image('bush2', 'assets/scenery/overworld/bush2.png');
    this.load.image('castle', 'assets/scenery/castle.png');
    this.load.image('flag-mast', 'assets/scenery/flag-mast.png');
    this.load.image('final-flag', 'assets/scenery/final-flag.png');
    this.load.image('sign', 'assets/scenery/sign.png');

    // Load tubes
    this.load.image('horizontal-tube', 'assets/scenery/horizontal-tube.png');
    this.load.image('horizontal-final-tube', 'assets/scenery/horizontal-final-tube.png');
    this.load.image('vertical-extralarge-tube', 'assets/scenery/vertical-large-tube.png');
    this.load.image('vertical-small-tube', 'assets/scenery/vertical-small-tube.png');
    this.load.image('vertical-medium-tube', 'assets/scenery/vertical-medium-tube.png');
    this.load.image('vertical-large-tube', 'assets/scenery/vertical-large-tube.png');
    
    // Load HUD images
    this.load.image('gear', 'assets/hud/gear.png');
    this.load.image('settings-bubble', 'assets/hud/settings-bubble.png');
    this.load.spritesheet('npc', 'assets/hud/npc.png', { frameWidth: 16, frameHeight: 24 });

    // Load platform bricks and structures
    this.load.image('floorbricks', 'assets/scenery/' + levelStyle + '/floorbricks.png');
    this.load.image('start-floorbricks', 'assets/scenery/overworld/floorbricks.png');
    this.load.image('block', 'assets/blocks/' + levelStyle + '/block.png');
    this.load.image('block2', 'assets/blocks/underground/block2.png');
    this.load.image('emptyBlock', 'assets/blocks/' + levelStyle + '/emptyBlock.png');
    this.load.image('immovableBlock', 'assets/blocks/' + levelStyle + '/immovableBlock.png');
    this.load.spritesheet('brick-debris', 'assets/blocks/' + levelStyle + '/brick-debris.png', { frameWidth: 8, frameHeight: 8 });
    this.load.spritesheet('mistery-block', 'assets/blocks/' + levelStyle + '/misteryBlock.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('custom-block', 'assets/blocks/overworld/customBlock.png', { frameWidth: 16, frameHeight: 16 });

    // Load collectibles
    this.load.spritesheet('coin', 'assets/collectibles/coin.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('ground-coin', 'assets/collectibles/underground/ground-coin.png', { frameWidth: 10, frameHeight: 14 });
    this.load.spritesheet('fire-flower', 'assets/collectibles/' + levelStyle + '/fire-flower.png', { frameWidth: 16, frameHeight: 16 });
    this.load.image('live-mushroom', 'assets/collectibles/live-mushroom.png');
    this.load.image('super-mushroom', 'assets/collectibles/super-mushroom.png');
}

function loadAudioAssets() {
    let levelStyle = isLevelOverworld ? 'overworld' : 'underground';
    
    this.load.audio('music', 'assets/sound/music/overworld/theme.mp3');
    this.load.audio('underground-music', 'assets/sound/music/underground/theme.mp3');
    this.load.audio('hurry-up-music', 'assets/sound/music/' + levelStyle +'/hurry-up-theme.mp3');
    this.load.audio('gameoversong', 'assets/sound/music/gameover.mp3');
    this.load.audio('win', 'assets/sound/music/win.wav');
    this.load.audio('jumpsound', 'assets/sound/effects/jump.mp3');
    this.load.audio('coin', 'assets/sound/effects/coin.mp3');
    this.load.audio('powerup-appears', 'assets/sound/effects/powerup-appears.mp3');
    this.load.audio('consume-powerup', 'assets/sound/effects/consume-powerup.mp3');
    this.load.audio('powerdown', 'assets/sound/effects/powerdown.mp3');
    this.load.audio('goomba-stomp', 'assets/sound/effects/goomba-stomp.wav');
    this.load.audio('flagpole', 'assets/sound/effects/flagpole.mp3');
    this.load.audio('fireball', 'assets/sound/effects/fireball.mp3');
    this.load.audio('kick', 'assets/sound/effects/kick.mp3');
    this.load.audio('time-warning', 'assets/sound/effects/time-warning.mp3');
    this.load.audio('here-we-go', Phaser.Math.Between(0, 100) < 98 ? 'assets/sound/effects/here-we-go.mp3' : 'assets/sound/effects/cursed-here-we-go.mp3');
    this.load.audio('pauseSound', 'assets/sound/effects/pause.wav');
    this.load.audio('block-bump', 'assets/sound/effects/block-bump.wav');
    this.load.audio('break-block', 'assets/sound/effects/break-block.wav');
}

function initSounds() {
    initializeMusicGroup.call(this);
    initializeSoundEffects.call(this);
}

function initializeMusicGroup() {
    this.musicGroup = this.add.group();
    
    this.musicTheme = this.sound.add('music', { volume: 0.15 });
    this.musicTheme.play({ loop: -1 });
    this.musicGroup.add(this.musicTheme);

    this.undergroundMusicTheme = this.sound.add('underground-music', { volume: 0.15 });
    this.musicGroup.add(this.undergroundMusicTheme);

    this.hurryMusicTheme = this.sound.add('hurry-up-music', { volume: 0.15 });
    this.musicGroup.add(this.hurryMusicTheme);

    this.gameOverSong = this.sound.add('gameoversong', { volume: 0.3 });
    this.musicGroup.add(this.gameOverSong);
        
    this.winSound = this.sound.add('win', { volume: 0.3 });
    this.musicGroup.add(this.winSound);
}

function initializeSoundEffects() {
    this.effectsGroup = this.add.group();

    this.jumpSound = this.sound.add('jumpsound', { volume: 0.10 });
    this.effectsGroup.add(this.jumpSound);

    this.coinSound = this.sound.add('coin', { volume: 0.2 });
    this.effectsGroup.add(this.coinSound);

    this.powerUpAppearsSound = this.sound.add('powerup-appears', { volume: 0.2 });
    this.effectsGroup.add(this.powerUpAppearsSound);

    this.consumePowerUpSound = this.sound.add('consume-powerup', { volume: 0.2 });
    this.effectsGroup.add(this.consumePowerUpSound);

    this.powerDownSound = this.sound.add('powerdown', { volume: 0.3 });
    this.effectsGroup.add(this.powerDownSound);

    this.goombaStompSound = this.sound.add('goomba-stomp', { volume: 1 });
    this.effectsGroup.add(this.goombaStompSound);

    this.flagPoleSound = this.sound.add('flagpole', { volume: 0.3 });
    this.effectsGroup.add(this.flagPoleSound);

    this.fireballSound = this.sound.add('fireball', { volume: 0.3 });
    this.effectsGroup.add(this.fireballSound);

    this.kickSound = this.sound.add('kick', { volume: 0.3 });
    this.effectsGroup.add(this.kickSound);

    this.timeWarningSound = this.sound.add('time-warning', { volume: 0.2 });
    this.effectsGroup.add(this.timeWarningSound);

    this.hereWeGoSound = this.sound.add('here-we-go', { volume: 0.17 });
    this.effectsGroup.add(this.hereWeGoSound);

    this.pauseSound = this.sound.add('pauseSound', { volume: 0.17 });
    this.effectsGroup.add(this.pauseSound);

    this.blockBumpSound = this.sound.add('block-bump', { volume: 0.3 });
    this.effectsGroup.add(this.blockBumpSound);

    this.breakBlockSound = this.sound.add('break-block', { volume: 0.5 });
    this.effectsGroup.add(this.breakBlockSound);
}

// ======================
// ANIMASI
// ======================
function createAnimations() {
    createPlayerAnimations.call(this);
    createEnemyAnimations.call(this);
    createEffectAnimations.call(this);
    createBlockAnimations.call(this);
}

function createPlayerAnimations() {
    this.anims.create({
        key: 'idle',
        frames: this.anims.generateFrameNumbers('mario', { start: 0, end: 0 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'run',
        frames: this.anims.generateFrameNumbers('mario', { start: 1, end: 2 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'jump',
        frames: this.anims.generateFrameNumbers('mario', { start: 3, end: 3 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'grown-mario-idle',
        frames: this.anims.generateFrameNumbers('mario-grown', { start: 0, end: 0 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'grown-mario-run',
        frames: this.anims.generateFrameNumbers('mario-grown', { start: 1, end: 3 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'grown-mario-jump',
        frames: this.anims.generateFrameNumbers('mario-grown', { start: 4, end: 4 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'fire-mario-idle',
        frames: this.anims.generateFrameNumbers('mario-fire', { start: 0, end: 0 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'fire-mario-run',
        frames: this.anims.generateFrameNumbers('mario-fire', { start: 1, end: 3 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'fire-mario-jump',
        frames: this.anims.generateFrameNumbers('mario-fire', { start: 4, end: 4 }),
        frameRate: 10,
        repeat: -1
    });
}

function createEnemyAnimations() {
    this.anims.create({
        key: 'goomba-walk',
        frames: this.anims.generateFrameNumbers('goomba', { start: 0, end: 1 }),
        frameRate: 5,
        repeat: -1
    });

    this.anims.create({
        key: 'goomba-dead',
        frames: this.anims.generateFrameNumbers('goomba', { start: 2, end: 2 }),
        frameRate: 5,
        repeat: -1
    });

    this.anims.create({
        key: 'koopa-walk',
        frames: this.anims.generateFrameNumbers('koopa', { start: 0, end: 1 }),
        frameRate: 5,
        repeat: -1
    });

    this.anims.create({
        key: 'koopa-hide',
        frames: this.anims.generateFrameNumbers('koopa', { start: 2, end: 2 }),
        frameRate: 5,
        repeat: -1
    });

    this.anims.create({
        key: 'npc-default',
        frames: this.anims.generateFrameNumbers('npc', { start: 0, end: 1 }),
        frameRate: 3,
        repeat: -1
    });
}

function createEffectAnimations() {
    this.anims.create({
        key: 'fireball-default',
        frames: this.anims.generateFrameNumbers('fireball', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'fireball-explosion',
        frames: this.anims.generateFrameNumbers('fireball-explosion', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: 0
    });

    this.anims.create({
        key: 'brick-debris',
        frames: this.anims.generateFrameNumbers('brick-debris', { start: 0, end: 3 }),
        frameRate: 15,
        repeat: 0
    });

    this.anims.create({
        key: 'coin-default',
        frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'ground-coin-default',
        frames: this.anims.generateFrameNumbers('ground-coin', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'fire-flower-default',
        frames: this.anims.generateFrameNumbers('fire-flower', { start: 0, end: 3 }),
        frameRate: 5,
        repeat: -1
    });
}

function createBlockAnimations() {
    this.anims.create({
        key: 'mistery-block-default',
        frames: this.anims.generateFrameNumbers('mistery-block', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'mistery-block-hit',
        frames: this.anims.generateFrameNumbers('mistery-block', { start: 4, end: 4 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'custom-block-default',
        frames: this.anims.generateFrameNumbers('custom-block', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });
}

// ======================
// PEMBUATAN PLAYER
// ======================
function createPlayer() {
    player = this.physics.add.sprite(screenWidth / 2, screenHeight - platformHeight * 1.5, 'mario');
    player.setBounce(0);
    player.setCollideWorldBounds(true);
    player.body.setSize(14, 16).setOffset(2, 0);
    
    playerController = {
        time: {
            leftDown: 0,
            rightDown: 0
        },
        direction: {
            positive: true
        },
        speed: {
            run: velocityX,
        }
    };
}


function generateLevel() {
    initializeLevelGroups.call(this);
    generatePlatform.call(this);
    setupLevelCollisions.call(this);
}

function initializeLevelGroups() {
    this.platformGroup = this.add.group();
    this.fallProtectionGroup = this.add.group();
    this.blocksGroup = this.add.group();
    this.constructionBlocksGroup = this.add.group();
    this.misteryBlocksGroup = this.add.group();
    this.immovableBlocksGroup = this.add.group();
    this.groundCoinsGroup = this.add.group();

    if (!isLevelOverworld) {
        this.blocksGroup.add(this.add.tileSprite(screenWidth, screenHeight - platformHeight / 1.2, 16, screenHeight - platformHeight, 'block2').setScale(screenHeight / 345).setOrigin(0, 1));
        this.undergroundRoof = this.add.tileSprite(screenWidth * 1.2, screenHeight / 13, worldWidth / 2.68, 16, 'block2').setScale(screenHeight / 345).setOrigin(0);
        this.blocksGroup.add(this.undergroundRoof);
    }
}

function generatePlatform() {
    let pieceStart = screenWidth;
    let lastWasHole = 0;
    let lastWasStructure = 0;

    for (let i = 0; i <= platformPieces; i++) {
        let number = Phaser.Math.Between(0, 100);

        if (pieceStart >= (lastWasHole > 0 || lastWasStructure > 0 || worldWidth - platformPiecesWidth * 4) || number <= 0 || pieceStart <= screenWidth * 2 || pieceStart >= worldWidth - screenWidth * 2) {
            lastWasHole--;

            let Npiece = this.add.tileSprite(pieceStart, screenHeight, platformPiecesWidth, platformHeight, 'floorbricks').setScale(2).setOrigin(0, 0.5);
            this.physics.add.existing(Npiece);
            Npiece.body.immovable = true;
            Npiece.body.allowGravity = false;
            Npiece.isPlatform = true;
            Npiece.depth = 2;
            this.platformGroup.add(Npiece);
            this.physics.add.collider(player, Npiece);

            if (!(pieceStart >= (worldWidth - screenWidth * (isLevelOverworld ? 1 : 1.5)))) {
                lastWasStructure = generateStructure.call(this, pieceStart);
            } else {
                lastWasStructure--;
            }
        } else {
            worldHolesCoords.push({ 
                start: pieceStart, 
                end: pieceStart + platformPiecesWidth * 2
            });
            
            lastWasHole = 2;
            this.fallProtectionGroup.add(this.add.rectangle(pieceStart + platformPiecesWidth * 2, screenHeight - platformHeight, 5, 5).setOrigin(0, 1));
            this.fallProtectionGroup.add(this.add.rectangle(pieceStart, screenHeight - platformHeight, 5, 5).setOrigin(1, 1));
        }
        pieceStart += platformPiecesWidth * 2;
    }

    createLevelTriggers.call(this);
}

function generateStructure(pieceStart) {
    let structureType = Phaser.Math.Between(0, 100);
    let structureHeight = Phaser.Math.Between(1, 3);
    
    if (structureType <= 60) {
        // Generate blocks
        for (let i = 0; i < structureHeight; i++) {
            let block = this.add.tileSprite(pieceStart + platformPiecesWidth, screenHeight - (platformHeight * (i + 1)), 16, 16, 'block').setScale(screenHeight / 345).setOrigin(0, 1);
            this.blocksGroup.add(block);
        }
        return 2;
    } else if (structureType <= 80) {
        // Generate mistery blocks
        let misteryBlock = this.add.sprite(pieceStart + platformPiecesWidth, screenHeight - (platformHeight * 1.5), 'mistery-block').setScale(screenHeight / 345).setOrigin(0, 1);
        this.misteryBlocksGroup.add(misteryBlock);
        return 2;
    } else if (structureType <= 90) {
        // Generate immovable blocks
        for (let i = 0; i < structureHeight; i++) {
            let immovableBlock = this.add.tileSprite(pieceStart + platformPiecesWidth, screenHeight - (platformHeight * (i + 1)), 16, 16, 'immovableBlock').setScale(screenHeight / 345).setOrigin(0, 1);
            this.immovableBlocksGroup.add(immovableBlock);
        }
        return 2;
    } else {
        // Generate ground coins
        let groundCoin = this.add.sprite(pieceStart + platformPiecesWidth, screenHeight - (platformHeight * 1.1), 'ground-coin').setScale(screenHeight / 345).setOrigin(0, 1);
        this.groundCoinsGroup.add(groundCoin);
        return 1;
    }
}

function setupLevelCollisions() {
    setupFallProtections.call(this);
    setupMisteryBlocksCollisions.call(this);
    setupBlocksCollisions.call(this);
    setupConstructionBlocksCollisions.call(this);
    setupImmovableBlocksCollisions.call(this);
    setupGroundCoinsCollisions.call(this);
}

function setupFallProtections() {
    let fallProtections = this.fallProtectionGroup.getChildren();
    for (let i = 0; i < fallProtections.length; i++) {
        this.physics.add.existing(fallProtections[i]);
        fallProtections[i].body.allowGravity = false;
        fallProtections[i].body.immovable = true;
    }
}

function setupMisteryBlocksCollisions() {
    let misteryBlocks = this.misteryBlocksGroup.getChildren();
    for (let i = 0; i < misteryBlocks.length; i++) {
        this.physics.add.existing(misteryBlocks[i]);
        misteryBlocks[i].body.allowGravity = false;
        misteryBlocks[i].body.immovable = true;
        misteryBlocks[i].depth = 2;
        misteryBlocks[i].anims.play('mistery-block-default', true);
        this.physics.add.collider(player, misteryBlocks[i], revealHiddenBlock, null, this);
    }
}

function setupBlocksCollisions() {
    let blocks = this.blocksGroup.getChildren();
    for (let i = 0; i < blocks.length; i++) {
        this.physics.add.existing(blocks[i]);
        blocks[i].body.allowGravity = false;
        blocks[i].body.immovable = true;
        blocks[i].depth = 2;
        this.physics.add.collider(player, blocks[i], destroyBlock, null, this);
    }
}

function setupConstructionBlocksCollisions() {
    let constructionBlocks = this.constructionBlocksGroup.getChildren();
    for (let i = 0; i < constructionBlocks.length; i++) {
        this.physics.add.existing(constructionBlocks[i]);
        constructionBlocks[i].isImmovable = true;
        constructionBlocks[i].body.allowGravity = false;
        constructionBlocks[i].body.immovable = true;
        constructionBlocks[i].depth = 2;
        this.physics.add.collider(player, constructionBlocks[i], destroyBlock, null, this);
    }
}

function setupImmovableBlocksCollisions() {
    let immovableBlocks = this.immovableBlocksGroup.getChildren();
    for (let i = 0; i < immovableBlocks.length; i++) {
        this.physics.add.existing(immovableBlocks[i]);
        immovableBlocks[i].body.allowGravity = false;
        immovableBlocks[i].body.immovable = true;
        immovableBlocks[i].depth = 2;
        this.physics.add.collider(player, immovableBlocks[i]);
    }
}

function setupGroundCoinsCollisions() {
    let groundCoins = this.groundCoinsGroup.getChildren();
    for (let i = 0; i < groundCoins.length; i++) {
        this.physics.add.existing(groundCoins[i]);
        groundCoins[i].anims.play('ground-coin-default', true);
        groundCoins[i].body.allowGravity = false;
        groundCoins[i].body.immovable = true;
        groundCoins[i].depth = 2;
        this.physics.add.overlap(player, groundCoins[i], collectCoin, null, this);
    }
}

function createLevelTriggers() {
    this.startScreenTrigger = this.add.tileSprite(screenWidth, screenHeight - platformHeight, 32, 28, 'horizontal-tube').setScale(screenHeight / 345).setOrigin(1, 1);
    this.startScreenTrigger.depth = 4;
    this.physics.add.existing(this.startScreenTrigger);
    this.startScreenTrigger.body.allowGravity = false;
    this.startScreenTrigger.body.immovable = true;
    this.physics.add.collider(player, this.startScreenTrigger, startLevel, null, this);

    let invisibleWall2 = this.add.rectangle(screenWidth, screenHeight - platformHeight, 1, screenHeight).setOrigin(0.5, 1);
    this.physics.add.existing(invisibleWall2);
    invisibleWall2.body.allowGravity = false;
    invisibleWall2.body.immovable = true;
    this.physics.add.collider(player, invisibleWall2);
    this.fallProtectionGroup.add(invisibleWall2);

    if (!isLevelOverworld) {
        this.verticalTube = this.add.tileSprite(worldWidth - screenWidth, screenHeight - platformHeight, 32, screenHeight, 'vertical-extralarge-tube').setScale(screenHeight / 345).setOrigin(1, 1);
        this.verticalTube.depth = 2;
        this.physics.add.existing(this.verticalTube);
        this.verticalTube.body.allowGravity = false;
        this.verticalTube.body.immovable = true;
        this.physics.add.collider(player, this.verticalTube);

        this.finalTrigger = this.add.tileSprite(worldWidth - screenWidth * 1.03, screenHeight - platformHeight, 40, 31, 'horizontal-final-tube').setScale(screenHeight / 345).setOrigin(1, 1);
        this.finalTrigger.depth = 2;
        this.physics.add.existing(this.finalTrigger);
        this.finalTrigger.body.allowGravity = false;
        this.finalTrigger.body.immovable = true;
        this.physics.add.collider(player, this.finalTrigger, teleportToLevelEnd, null, this);

        let invisibleWall1 = this.add.rectangle(worldWidth - screenWidth, screenHeight - platformHeight, 1, screenHeight).setOrigin(0.5, 1);
        this.physics.add.existing(invisibleWall1);
        invisibleWall1.body.allowGravity = false;
        invisibleWall1.body.immovable = true;
        this.physics.add.collider(player, invisibleWall1);
        this.fallProtectionGroup.add(invisibleWall1);
    }
}

// ======================
// DRAW WORLD
// ======================
function drawWorld() {
    drawBackground.call(this);
    drawScenery.call(this);
    drawFinalElements.call(this);
}

function drawBackground() {
    this.add.rectangle(screenWidth, 0, worldWidth, screenHeight, isLevelOverworld ? 0x8585FF : 0x000000).setOrigin(0).depth = -1;
}

function drawScenery() {
    let propsY = screenHeight - platformHeight;

    if (isLevelOverworld) {
        // Draw clouds
        for (let i = 0; i < Phaser.Math.Between(Math.trunc(worldWidth / 760), Math.trunc(worldWidth / 380)); i++) {
            let x = generateRandomCoordinate(false, false);
            let y = Phaser.Math.Between(screenHeight / 80, screenHeight / 2.2);
            if (Phaser.Math.Between(0, 10) < 5) {
                this.add.image(x, y, 'cloud1').setOrigin(0).setScale(screenHeight / 1725);
            } else {
                this.add.image(x, y, 'cloud2').setOrigin(0).setScale(screenHeight / 1725);
            }
        }

        // Draw mountains
        for (let i = 0; i < Phaser.Math.Between(worldWidth / 6400, worldWidth / 3800); i++) {
            let x = generateRandomCoordinate();

            if (Phaser.Math.Between(0, 10) < 5) {
                this.add.image(x, propsY, 'mountain1').setOrigin(0, 1).setScale(screenHeight / 517);
            } else {
                this.add.image(x, propsY, 'mountain2').setOrigin(0, 1).setScale(screenHeight / 517);
            }
        }
        
        // Draw bushes
        for (let i = 0; i < Phaser.Math.Between(Math.trunc(worldWidth / 960), Math.trunc(worldWidth / 760)); i++) {
            let x = generateRandomCoordinate();

            if (Phaser.Math.Between(0, 10) < 5) {
                this.add.image(x, propsY, 'bush1').setOrigin(0, 1).setScale(screenHeight / 609);
            } else {
                this.add.image(x, propsY, 'bush2').setOrigin(0, 1).setScale(screenHeight / 609);
            }
        }

        // Draw fences
        for (let i = 0; i < Phaser.Math.Between(Math.trunc(worldWidth / 4000), Math.trunc(worldWidth / 2000)); i++) {
            let x = generateRandomCoordinate();
            this.add.tileSprite(x, propsY, Phaser.Math.Between(100, 250), 35, 'fence').setOrigin(0, 1).setScale(screenHeight / 863);
        }
    }
}

function drawFinalElements() {
    let propsY = screenHeight - platformHeight;

    // Final flag mast
    this.finalFlagMast = this.add.tileSprite(worldWidth - (worldWidth / 30), propsY, 16, 167, 'flag-mast').setOrigin(0, 1).setScale(screenHeight / 400);
    this.physics.add.existing(this.finalFlagMast);
    this.finalFlagMast.immovable = true;
    this.finalFlagMast.allowGravity = false;
    this.finalFlagMast.body.setSize(3, 167);
    this.physics.add.overlap(player, this.finalFlagMast, null, raiseFlag, this);
    this.physics.add.collider(this.platformGroup.getChildren(), this.finalFlagMast);

    // Final flag
    this.finalFlag = this.add.image(worldWidth - (worldWidth / 30), propsY * 0.93, 'final-flag').setOrigin(0.5, 1);
    this.finalFlag.setScale(screenHeight / 400);

    // Castle
    this.add.image(worldWidth - (worldWidth / 75), propsY, 'castle').setOrigin(0.5, 1).setScale(screenHeight / 300);
}

// ======================
// GAME FUNCTIONS
// ======================
function startLevel(player, trigger) {
    if (!player.body.blocked.right && !trigger.body.blocked.left)
        return;

    this.powerDownSound.play();
    this.physics.world.setBounds(screenWidth, 0, worldWidth, screenHeight);
    applyPlayerInvulnerability.call(this, 4000);

    playerBlocked = true;
    player.setVelocityX(5);
    player.anims.play('run', true).flipX = false;

    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.hereWeGoSound.play();

    setTimeout(() => {
        if (!isLevelOverworld) {
            player.y = screenHeight / 5;
            this.musicTheme.stop();
            this.undergroundMusicTheme.play({ loop: -1 });
        }

        player.x = screenWidth * 1.1;
        this.cameras.main.pan(screenWidth * 1.5, 0, 0);
        playerBlocked = false;
        this.cameras.main.fadeIn(500, 0, 0, 0);
        createHUD.call(this);
        updateTimer.call(this);
        this.startScreenTrigger.destroy();
        levelStarted = true;
        if (this.settingsMenuOpen) hideSettings.call(this);
    }, 1100);
}

function teleportToLevelEnd(player, trigger) {
    if (!player.body.blocked.right && !trigger.body.blocked.left)
        return;
    
    playerBlocked = true;
    this.cameras.main.stopFollow();
    this.powerDownSound.play();

    this.tweens.add({
        targets: player,
        duration: 75,
        alpha: 0
    });

    this.cameras.main.fadeOut(450, 0, 0, 0);
    player.anims.play(playerState > 0 ? playerState == 1 ? 'grown-mario-run' : 'fire-mario-run' : 'run', true).flipX = false;
    this.undergroundRoof.destroy();

    setTimeout(() => {
        this.physics.world.setBounds(worldWidth - screenWidth, 0, worldWidth, screenHeight);
        this.tpTube = this.add.tileSprite(worldWidth - screenWidth / 1.089, screenHeight - platformHeight, 32, 32, 'vertical-medium-tube').setScale(screenHeight / 345).setOrigin(1);
        this.tpTube.depth = 4;
        this.physics.add.existing(this.tpTube);
        this.tpTube.body.allowGravity = false;
        this.tpTube.body.immovable = true;
        this.physics.add.collider(player, this.tpTube);
        this.add.rectangle(worldWidth - screenWidth, 0, worldWidth, screenHeight, 0x8585FF).setOrigin(0).depth = -1;
        this.add.tileSprite(worldWidth - screenWidth, screenHeight, screenWidth, platformHeight, 'start-floorbricks').setScale(2).setOrigin(0, 0.5).depth = 2;
    }, 500);

    setTimeout(() => {
        player.alpha = 1;
        player.x = worldWidth - screenWidth / 1.08;
        this.cameras.main.pan(worldWidth - screenWidth / 2, 0, 0);
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.powerDownSound.play();
        this.finalTrigger.destroy();
        this.tweens.add({
            targets: player,
            duration: 500,
            y: this.tpTube.getBounds().y
        });
        setTimeout(() => {
            playerBlocked = false;
        }, 500);
    }, 1100);
}

function raiseFlag() {
    if (flagRaised) return false;

    this.cameras.main.stopFollow();
    this.timeLeftText.stopped = true;

    this.musicTheme.stop();
    this.undergroundMusicTheme.stop();
    this.hurryMusicTheme.stop();
    this.flagPoleSound.play();

    this.tweens.add({
        targets: this.finalFlag,
        duration: 1000,
        y: screenHeight / 2.2
    });

    setTimeout(() => {
        this.winSound.play();
    }, 1000);
    
    flagRaised = true;
    playerBlocked = true;
    addToScore.call(this, 2000, player);
    return false;
}

function update(delta) {
    if (gameOver || gameWinned) return;

    updatePlayer.call(this, delta);

    const playerVelocityX = player.body.velocity.x;
    const camera = this.cameras.main;

    if (playerVelocityX > 0 && levelStarted && !reachedLevelEnd && !camera.isFollowing &&
        player.x >= screenWidth * 1.5 && player.x >= (camera.worldView.x + camera.width / 2)) {
        camera.startFollow(player, true, 0.1, 0.05);
        camera.isFollowing = true;
    }

    if (playerVelocityX < 0 && furthestPlayerPos < player.x && levelStarted && !reachedLevelEnd && camera.isFollowing) {
        furthestPlayerPos = player.x;
        this.physics.world.setBounds(camera.worldView.x, 0, worldWidth, screenHeight);
        camera.setBounds(camera.worldView.x, 0, worldWidth, screenHeight);
        camera.stopFollow();
        camera.isFollowing = false;
    }

    if (!reachedLevelEnd && !isLevelOverworld && camera.isFollowing && player.x >= worldWidth - screenWidth * 1.5) {
        reachedLevelEnd = true;
        camera.stopFollow();
    }
}