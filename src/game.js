class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.dpad = { up: false, down: false, left: false, right: false };
    }

    preload() {
        this.load.image('player', 'assets/images/main-character.png');
    }

    create() {
        const { width, height } = this.scale;

        // Sky-blue background
        this.add.rectangle(width / 2, height / 2, width, height, 0x87ceeb);

        // Ground strip
        this.add.rectangle(width / 2, height - 20, width, 40, 0x5c8a3c);

        // Physics world bounds
        this.physics.world.setBounds(0, 0, width, height);

        // Player sprite - scale to fit while preserving aspect ratio
        this.player = this.physics.add.image(width / 2, height / 2, 'player');
        const targetWidth = Math.min(80, width * 0.1);
        const aspectRatio = this.player.height / this.player.width;
        this.player.setDisplaySize(targetWidth, targetWidth * aspectRatio);
        this.player.setCollideWorldBounds(true);

        // Keyboard input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // D-pad
        this.createDpad();

        // Resize listener
        this.scale.on('resize', this.onResize, this);
    }

    createDpad() {
        const btnSize = 52;
        const gap = 6;
        const margin = 16;
        const halfBtn = btnSize / 2;
        // Ensure all buttons fit within screen bounds
        const cx = margin + halfBtn + btnSize + gap;
        const cy = this.scale.height - margin - halfBtn - btnSize - gap;

        const positions = [
            { x: cx,             y: cy - btnSize - gap, dir: 'up',    label: '▲' },
            { x: cx - btnSize - gap, y: cy,             dir: 'left',  label: '◀' },
            { x: cx + btnSize + gap, y: cy,             dir: 'right', label: '▶' },
            { x: cx,             y: cy + btnSize + gap, dir: 'down',  label: '▼' }
        ];

        this.dpadButtons = {};

        positions.forEach(({ x, y, dir, label }) => {
            const container = this.add.container(x, y);
            container.setDepth(10);

            const bg = this.add.graphics();
            bg.fillStyle(0x222222, 0.75);
            bg.fillRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 10);
            bg.lineStyle(2, 0xffffff, 0.4);
            bg.strokeRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 10);

            const text = this.add.text(0, 0, label, {
                fontSize: '22px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);

            container.add([bg, text]);

            const hitArea = new Phaser.Geom.Rectangle(-btnSize / 2, -btnSize / 2, btnSize, btnSize);
            container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

            container.on('pointerdown', () => {
                this.dpad[dir] = true;
                bg.clear();
                bg.fillStyle(0x555555, 0.9);
                bg.fillRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 10);
                bg.lineStyle(2, 0xffffff, 0.8);
                bg.strokeRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 10);
            });

            const release = () => {
                this.dpad[dir] = false;
                bg.clear();
                bg.fillStyle(0x222222, 0.75);
                bg.fillRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 10);
                bg.lineStyle(2, 0xffffff, 0.4);
                bg.strokeRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 10);
            };

            container.on('pointerup', release);
            container.on('pointerout', release);

            this.dpadButtons[dir] = container;
        });

        // Allow multi-touch for simultaneous D-pad presses
        this.input.addPointer(3);
    }

    onResize(gameSize) {
        const { width, height } = gameSize;
        this.physics.world.setBounds(0, 0, width, height);
    }

    update() {
        const speed = 220;
        let vx = 0;
        let vy = 0;

        if (this.cursors.left.isDown || this.wasd.left.isDown || this.dpad.left)  vx = -speed;
        if (this.cursors.right.isDown || this.wasd.right.isDown || this.dpad.right) vx = speed;
        if (this.cursors.up.isDown || this.wasd.up.isDown || this.dpad.up)   vy = -speed;
        if (this.cursors.down.isDown || this.wasd.down.isDown || this.dpad.down)  vy = speed;

        // Normalize diagonal movement
        if (vx !== 0 && vy !== 0) {
            const factor = 1 / Math.SQRT2;
            vx *= factor;
            vy *= factor;
        }

        this.player.setVelocity(vx, vy);

        // Flip sprite based on horizontal direction
        if (vx < 0) {
            this.player.setFlipX(true);
        } else if (vx > 0) {
            this.player.setFlipX(false);
        }
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#87ceeb',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: GameScene
};

new Phaser.Game(config);
